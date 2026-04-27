# 배포 가이드

개인용 웹앱이라 인증/도메인이 필수는 아니지만, 외부에 띄울 거면
Cloudflare Access(SSO)로 잠그는 걸 권장.

## ⚠️ 처음 배포 시 반드시 — 인증 우회 함정

`wrangler.jsonc`의 기본값은 다음과 같아 **그대로 배포하면 모든 `/api/*` 가
인증 없이 공개**된다:

```jsonc
"vars": {
  "ENVIRONMENT": "development",        // ← prod 배포 시 우회 트리거
  "ACCESS_TEAM_DOMAIN": "<team>...",   // ← placeholder도 우회 트리거
  "ACCESS_AUD": "<aud-tag>"
}
```

워커의 `shouldBypassAccess`는
- `ENVIRONMENT === "development"` 이거나
- `ACCESS_*` 둘 중 하나라도 비었거나 `<…>`로 시작하면

검증을 건너뛴다 (로컬 dev 편의용). 배포 전에 4-2 단계에서 반드시 실제 값으로 교체.

## 0. 사전 준비

- Cloudflare 계정 (Workers + D1 활성)
- `wrangler` CLI: `npm i -g wrangler` 또는 `npx wrangler`
- 노드 18+ / pnpm·npm 중 하나

## 권장 배포 순서 (체크리스트)

처음 배포라면 아래 순서를 그대로 따라가면 된다.

1. **D1 생성** → `database_id`를 `wrangler.jsonc`에 박기 (1번 항목)
2. **Cloudflare Access 앱 등록** → AUD / Team domain 메모 (4-1)
3. **`wrangler.jsonc` 변수 3개 실제 값으로 교체** (4-2) ← 🔴 빠뜨리면 인증 우회
4. **OpenAI 시크릿 등록** (코파일럿 쓸 거면 — 2번)
5. **`npm run deploy`** (자동 빌드 포함, 3번)
6. **`wrangler d1 migrations apply --remote`** (스키마)
7. **`wrangler d1 execute --remote --file=migrations/seed.sql`** (최초 1회 시드 — ⚠️ 자동 적용 안 됨)
8. 워커 URL 또는 커스텀 도메인 접속 → Access 로그인 화면 뜨면 OK

## 1. D1 데이터베이스 생성

```bash
wrangler d1 create self_managing_system
```

출력의 `database_id`를 `wrangler.jsonc`의
`d1_databases[0].database_id`에 박아넣음.

마이그레이션 적용:

```bash
wrangler d1 migrations apply self_managing_system --remote
```

로컬 dev용 동일:

```bash
wrangler d1 migrations apply self_managing_system --local
```

### 1-1. 시드 (카테고리 기본값) — ⚠️ 자동 적용 안 됨

`wrangler d1 migrations apply`는 `NNNN_*.sql` 패턴만 추적하므로
`migrations/seed.sql`은 **별도로 한 번** 실행해야 한다. 안 하면 가계부/이벤트
카테고리 드롭다운이 비어 있어 UI가 빈 상태로 시작.

```bash
wrangler d1 execute self_managing_system --remote --file=migrations/seed.sql

# 로컬 dev DB에도
wrangler d1 execute self_managing_system --local --file=migrations/seed.sql
```

이미 시드된 DB에 다시 실행하면 PRIMARY KEY 충돌로 실패하므로 한 번만.

## 2. 시크릿 (옵션)

코파일럿 쓰려면 OpenAI 키 등록.

```bash
wrangler secret put OPENAI_API_KEY
```

(미등록 시 코파일럿 호출은 503 — 다른 기능은 정상)

### 2-2. 비밀번호 한 줄 보호 (Cloudflare Access 대신 쓰는 간단 모드)

도메인 살 필요 없이 워커 URL 그대로 쓰면서 본인만 접근하게 하려면 비밀번호
시크릿 한 줄로 끝낼 수 있다.

```bash
wrangler secret put APP_PASSWORD
# 프롬프트에 비밀번호 입력 (영문 + 숫자 12자 이상 권장)
```

이렇게 하면:
- 모든 `/api/*` 요청은 `X-App-Password` 헤더가 일치해야 통과
- 프론트는 `AuthGate` 컴포넌트가 첫 진입 시 비번을 받아 `localStorage`에 저장
- 이후 자동 첨부 → 새로고침해도 다시 안 묻는다
- 401 응답 시 자동으로 잠금 화면 복귀
- 설정 페이지에 "잠금 / 로그아웃" 버튼이 있어 수동 종료 가능

`wrangler.jsonc`의 `ENVIRONMENT`는 그대로 `"production"`이어야 하지만,
`ACCESS_*` 변수는 placeholder로 둬도 된다 (워커가 비번 모드를 우선 적용).

⚠️ 비밀번호 회전: `wrangler secret put APP_PASSWORD`로 다시 등록하면 즉시 모든
브라우저가 자동으로 잠금 화면으로 떨어진다.

### 2-1. 🔴 `.dev.vars`는 절대 커밋 금지

로컬 `wrangler dev` 환경에서 시크릿을 쓰려면 프로젝트 루트에 `.dev.vars`
파일을 두는 게 표준 방식이다. 형식은 dotenv와 동일:

```
# .dev.vars  (로컬 전용, git에 절대 올리지 말 것)
OPENAI_API_KEY=sk-proj-...
```

이 파일은 **API 키 평문이 그대로 들어 있으므로 노출되면 즉시 키가 도용된다.**

- `.gitignore`에 `.dev.vars`가 이미 등록되어 있다 — 그대로 둘 것.
- 절대 `git add -A` / `git add .` 같은 광범위 추가로 실수 커밋 금지.
  파일 단위로 명시 추가 권장.
- 만에 하나 커밋되었다면:
  1. 즉시 OpenAI 대시보드에서 해당 키 **revoke**
  2. 새 키 발급 → `wrangler secret put`으로 프로덕션 재등록 + 로컬 `.dev.vars` 갱신
  3. git 히스토리에서 제거 (`git filter-repo` 등) 후 `git push --force`
     — public/팀 레포면 이미 새서 나갔다고 가정하고 키 회전이 우선.
- 원격(프로덕션)에는 `.dev.vars` 대신 `wrangler secret put`만 사용한다.
  이 명령은 키를 Cloudflare 측에 암호화 저장하고 로컬 파일을 만들지 않는다.

같은 원칙으로 `.env`, `.env.local`도 `.gitignore`에 들어 있다 — 새 시크릿
추가 시 항상 이 두 곳(또는 `.dev.vars`) 중 하나만 쓰고 커밋 검토 시 확인.

## 3. 빌드 + 배포

```bash
npm run build         # vite build → dist/
wrangler deploy
```

배포 후 `https://self-managing-system.<account>.workers.dev` 에서 동작.

## 4. Cloudflare Access (SSO 잠금) 설정

워커 URL을 Zero Trust 대시보드에서 보호하면 본인 외 접근 차단됨.

### 4-1. Application 등록

1. Cloudflare Zero Trust → **Access → Applications → Add an application → Self-hosted**
2. **Application domain**:
   - 워커 기본 도메인을 쓰는 경우 → `*.workers.dev`는 직접 보호 불가하므로
     커스텀 도메인이 필요. `wrangler.jsonc`에 `routes` 추가하거나
     워커 대시보드에서 커스텀 도메인 라우팅.
   - 커스텀 도메인 예: `me.example.com`.
3. **Identity providers**: Google / GitHub / One-time PIN 중 택일.
4. **Policy**: `Include → Emails → baly.hanchoi@gmail.com` (본인 이메일만 허용).
5. 저장 후 **AUD tag** 메모.
6. **Team domain**도 메모 (보통 `<team>.cloudflareaccess.com`).

### 4-2. wrangler.jsonc 갱신 — 🔴 필수

```jsonc
"vars": {
  "ENVIRONMENT": "production",
  "ACCESS_TEAM_DOMAIN": "yourteam.cloudflareaccess.com",
  "ACCESS_AUD": "abc123…(실제 AUD)"
}
```

세 값 **모두** 교체해야 한다. 하나라도 placeholder(`<…>`)거나
`ENVIRONMENT`가 `"development"`로 남아있으면 워커가 검증을 건너뛴다
(로컬 편의 코드 — `worker/index.ts:157` `shouldBypassAccess` 참고).

배포 후 검증 — 인증되지 않은 호출은 401이어야 정상:

```bash
curl -i https://your-domain/api/health
# → HTTP/1.1 401 {"error":"access_required"}
```

200이 떨어지면 위 변수가 placeholder 상태라는 뜻 → 다시 확인.

### 4-3. (선택) 워커 측 추가 검증

Cloudflare Access는 도메인 진입 시점에서 토큰을 강제하지만,
워커가 `Cf-Access-Jwt-Assertion` 헤더를 추가 검증하면 우회 차단에 안전.
지금 코드는 그 검증을 강제하지 않음 — 필요해지면
[`@cloudflare/workers-access-jwt`](https://www.npmjs.com/package/@cloudflare/workers-access-jwt) 같은
헬퍼로 미들웨어 한 줄.

## 5. 백업 / 복원

UI: 설정 페이지 → **JSON 내보내기** / **JSON 가져오기**

CLI:

```bash
# 원격 DB 덤프
wrangler d1 export self_managing_system --remote --output=backup.sql

# 로컬로 가져와서 적용
wrangler d1 execute self_managing_system --local --file=backup.sql
```

## 6. 흔한 실수

- 🔴 **인증 우회한 채로 배포** — `wrangler.jsonc`의 `ENVIRONMENT`,
  `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` 셋 다 실제 값으로 바꿨는지 확인.
  `curl /api/health`가 401이 나와야 정상.
- 🔴 **`.dev.vars` 커밋 사고** — API 키 평문이 들어있는 파일.
  `.gitignore`에 등록되어 있지만 `git add -A`로 우회될 수 있으니
  커밋 직전 `git status`에 `.dev.vars`가 안 보이는지 확인.
  실수했으면 즉시 키 revoke + 회전 (2-1 참고).
- `wrangler.jsonc`의 `database_id`가 비어있으면 `wrangler dev`가
  실패함. 1번에서 생성한 ID를 반드시 채울 것.
- 마이그레이션을 `--remote` 빠뜨리고 적용하면 로컬만 갱신됨 →
  배포 후 500 발생. `--remote`도 같이 적용.
- 시드(`seed.sql`)는 자동 적용 안 됨 (1-1) — 안 하면 카테고리 드롭다운이 빔.
- 코파일럿 응답이 503: `OPENAI_API_KEY` 시크릿 미등록.
  `wrangler secret list`로 확인.
- `dist/`가 비어있으면 자산 라우팅 실패 → `npm run build` 먼저.
- 커스텀 도메인 없이 `*.workers.dev` URL에 Access를 직접 못 붙임 (4-1 참고).
- 시드를 두 번 실행하면 카테고리 PK 충돌 — 한 번만.
