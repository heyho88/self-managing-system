# 텔레그램 인입 — 토스 스크린샷 → 가계부 자동 기록

토스 사용내역 스크린샷을 텔레그램 봇으로 보내면, vision API가 거래를 추출해 D1 `transactions`에 자동 기록한다. 사용자는 금액 하나하나 입력하지 않는다.

---

## 사용 시나리오

1. 토스 앱에서 "사용내역" 화면 캡처.
2. 텔레그램 봇 채팅에 사진 전송 (캡션 불필요).
3. 잠시 후 봇이 회신:
   ```
   ✅ 6건 기록됨 (-₩42,500)
     04.26  스타벅스        식비    -6,500
     04.26  김밥천국        식비    -12,000
     04.26  서울교통공사    교통    -2,500
     04.26  무신사          쇼핑    -20,000
     04.25  GS25            식비    -3,500
     04.25  CU              식비    -2,000
   잘못된 게 있으면 /undo
   ```
4. 가계부 페이지 새로고침하면 그대로 반영.

---

## 흐름

```
[토스 캡처]
   │
   ▼
Telegram 봇 ────webhook POST────► Cloudflare Worker
                                       │
                                       │  1. file_id 추출
                                       │  2. getFile → file_path
                                       │  3. 이미지 바이트 다운로드
                                       │  4. Vision API 호출 (structured output)
                                       │  5. dedupe + category 매핑
                                       │  6. D1 transactions insert
                                       │  7. Telegram 회신 (sendMessage)
                                       ▼
                                    D1 (transactions)
```

---

## Telegram 봇 셋업

1. `@BotFather`에서 봇 생성 → 토큰 발급.
2. Wrangler secret 등록:
   ```
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put TELEGRAM_WEBHOOK_SECRET   # 임의 random string
   wrangler secret put TELEGRAM_ALLOWED_CHAT_ID  # 본인 chat_id (단일 사용자)
   ```
3. webhook 등록 (한 번만):
   ```
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<worker-domain>/api/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
     -d "allowed_updates=[\"message\"]"
   ```

---

## 워커 라우트

### `POST /api/telegram/webhook`

Telegram이 호출. **Cloudflare Access 우회 경로** — Access bypass 규칙으로 이 path만 열어두고, 자체 인증으로 보호.

#### 인증 (3중 게이트)

1. `X-Telegram-Bot-Api-Secret-Token` 헤더 == `TELEGRAM_WEBHOOK_SECRET` 검증.
2. payload의 `message.chat.id` == `TELEGRAM_ALLOWED_CHAT_ID` 검증.
3. 사진이 없는 메시지(텍스트만, /undo 등 명령 제외)는 무시.

세 조건 중 하나라도 실패하면 200 OK + 본문 비움(텔레그램이 재시도하지 않게).

#### 처리 단계

```ts
1. update.message.photo[-1].file_id     // 가장 큰 해상도
2. GET https://api.telegram.org/bot<T>/getFile?file_id=<id>
   → result.file_path
3. GET https://api.telegram.org/file/bot<T>/<file_path>
   → ArrayBuffer (이미지)
4. base64 인코딩 후 OpenAI vision call (아래 schema 참고)
5. 추출된 transactions[] 각각:
   - dedupe: (date, amount, merchant) SHA-256 해시 → ingest_dedupe 테이블 조회
   - category 매핑: merchant_category_map 조회 (없으면 모델 추측 사용)
   - account_id = 'toss' 고정
6. D1에 batch insert
7. POST https://api.telegram.org/bot<T>/sendMessage
   → 결과 요약 회신 (reply_to_message_id로 원본 사진에 답장)
```

---

## Vision API 호출

모델: SPEC에 이미 있는 OpenAI 키 재사용. `gpt-5-mini` (vision 지원, 저비용).

### 시스템 프롬프트

```
You extract transaction rows from a Toss app screenshot.

Output a JSON array. Each item:
- date: "YYYY-MM-DD"  (스크린샷에 보이는 날짜 그대로)
- amount: integer in KRW (지출은 양수, 절댓값)
- type: "expense" | "income"   (대부분 expense)
- merchant: string             (가맹점명, 보이는 그대로)
- category_guess: one of [식비, 주거, 교통, 통신, 의료, 쇼핑, 문화, 교육, 경조사, 기타]
- raw_text: string             (그 행의 원문)

Rules:
- 같은 화면에 여러 날짜가 있으면 모두 추출.
- 환불/취소 행은 type=income, amount는 양수.
- 잔액 행, 헤더, 광고 배너는 무시.
- 카테고리가 애매하면 "기타".
- 콤마/원 표시 제거하고 정수로.
- 결과는 JSON 배열만 반환, 다른 텍스트 금지.
```

### 호출 (OpenAI Chat Completions)

```ts
{
  model: "gpt-5-mini",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: "이 토스 사용내역 스크린샷을 추출해." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }
      ]
    }
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "toss_transactions",
      strict: true,
      schema: {
        type: "object",
        properties: {
          transactions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                amount: { type: "integer", minimum: 0 },
                type: { type: "string", enum: ["expense", "income"] },
                merchant: { type: "string" },
                category_guess: {
                  type: "string",
                  enum: ["식비","주거","교통","통신","의료","쇼핑","문화","교육","경조사","기타"]
                },
                raw_text: { type: "string" }
              },
              required: ["date","amount","type","merchant","category_guess","raw_text"],
              additionalProperties: false
            }
          }
        },
        required: ["transactions"],
        additionalProperties: false
      }
    }
  }
}
```

---

## DB 추가 스키마

기존 `transactions` 테이블은 그대로 사용. 인입용 보조 테이블 두 개 추가:

```sql
-- 가맹점 → 카테고리 학습형 매핑.
-- 한 번 분류된 merchant는 다음부터 자동 같은 카테고리.
CREATE TABLE merchant_category_map (
  merchant     TEXT PRIMARY KEY,        -- 정규화된 가맹점명 (소문자, 공백 제거)
  category_id  TEXT NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 1,
  updated_at   INTEGER NOT NULL
);

-- 같은 거래 중복 인입 방지.
CREATE TABLE ingest_dedupe (
  hash         TEXT PRIMARY KEY,        -- sha256(date|amount|merchant)
  txn_id       TEXT NOT NULL,           -- transactions.id
  source       TEXT NOT NULL,           -- 'telegram' | ...
  created_at   INTEGER NOT NULL
);

-- 인입 로그 (디버깅 + /undo 지원).
CREATE TABLE ingest_log (
  id              TEXT PRIMARY KEY,
  source          TEXT NOT NULL,        -- 'telegram'
  telegram_msg_id INTEGER,
  inserted_count  INTEGER NOT NULL,
  skipped_count   INTEGER NOT NULL,     -- dedupe로 스킵된 수
  txn_ids         TEXT NOT NULL,        -- JSON array of inserted txn ids
  raw_response    TEXT,                 -- vision API 응답 원본
  created_at      INTEGER NOT NULL
);
```

`transactions` 테이블에 컬럼 한 개 추가:

```sql
ALTER TABLE transactions ADD COLUMN source TEXT;   -- 'manual' | 'telegram'
```

가계부 UI에서 `source = 'telegram'`인 행은 우측 끝에 작은 회색 `T` 마커로 표시 (자동 인입된 거래 식별용).

---

## 카테고리 매핑 우선순위

```
1. merchant_category_map[정규화(merchant)] 가 있으면 → 그것 사용
2. 없으면 vision의 category_guess 사용
3. 둘 다 없으면 '기타'
```

새로 결정된 매핑은 항상 `merchant_category_map`에 upsert (`hits++`). 사용자가 가계부에서 카테고리를 수동 변경하면 그 매핑도 업데이트하면 좋음(선택).

가맹점명 정규화: 소문자 + 공백 제거 + 흔한 접미사 제거 (`주식회사`, `(주)`, 지점명 일부).

---

## 명령어

봇 채팅에 사진 외에 텍스트 명령도 지원:

| 명령 | 동작 |
|------|------|
| `/undo` | 가장 최근 인입(`ingest_log` 마지막 행)의 `txn_ids`를 모두 삭제 |
| `/today` | 오늘자 합계 회신 (`-₩42,500 ...`) |
| `/sum 04-25` | 특정 날짜 합계 |
| `/cat <merchant> <category>` | merchant_category_map 수동 수정 (예: `/cat 무신사 쇼핑`) |

명령은 워커가 webhook payload의 `message.text`로 분기.

---

## Cloudflare Access 처리

SPEC에서 `/api/*`는 Access 게이트 뒤. Telegram은 사람이 아니므로 Access 통과 못 함.

해결: Access Application 설정에서 `/api/telegram/webhook` path만 **Bypass policy** 추가 (Action: `Bypass`, Include: `Everyone`). 보안은 위에 적은 3중 게이트(secret_token + chat_id + payload 검증)로 자체 처리.

---

## 비용

- gpt-5-mini vision: 이미지 1장 ≈ 1,000~2,000 input tokens + 출력 ~500 tokens.
- 1회 호출 ≈ ₩5~15원.
- 하루 5번 캡처해도 월 ₩1,000~2,000원 수준.

---

## 구현 순서

SPEC의 구현 우선순위 3단계(가계부 풀패키지) 완료 후 추가:

1. `merchant_category_map`, `ingest_dedupe`, `ingest_log` 테이블 마이그레이션 + `transactions.source` 컬럼.
2. `/api/telegram/webhook` 라우트 (인증 → 이미지 다운로드 → vision 호출 → insert → 회신).
3. 가맹점 정규화 + 카테고리 매핑 헬퍼.
4. `/undo`, `/today` 등 명령 처리.
5. 가계부 UI에 `source=telegram` 마커 표시.
6. BotFather에서 봇 생성 + Wrangler secret 등록 + setWebhook 호출.

---

## 미해결

- **다중 결제수단** — 토스 화면에 토스카드/토스페이/계좌이체가 섞이면 `account_id`를 어떻게 분기할지. 1차는 모두 `'toss'` 단일 계좌로 묶고, 필요해지면 vision이 추가로 결제수단 라벨까지 추출하도록 schema 확장.
- **이미 가계부에 수동 입력한 거래와의 중복** — dedupe 해시가 `(date, amount, merchant)` 기준이라 수동 입력 때 메모를 다르게 적었으면 중복 통과 가능. 인입 시 같은 (date, amount) 쌍이 이미 있으면 봇이 회신에 ⚠ 표시하고 사용자가 `/undo`로 처리.
- **자동 insert vs propose** — SPEC의 에이전트는 항상 propose 강제지만, 가계부 인입은 즉시 insert + `/undo` 패턴이 더 실용적. 일단 즉시 insert로 가고, 오인입이 잦으면 인라인 버튼(✅/❌) 확인 단계 추가.
