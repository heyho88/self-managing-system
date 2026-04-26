# 자기관리 시스템

개인용 일상 관리 + 가계부 웹앱. Cloudflare Workers + D1 + React.

## 스택

- React 18 + Vite + TypeScript
- Tailwind CSS
- Hono (API on Workers)
- Cloudflare D1 (SQLite) + Drizzle ORM
- TanStack Query
- Recharts

## 기능

- 오늘 화면: 할 일, 시간 블록, 빠른 지출 입력, 월 예산 진척
- 가계부: 수입/지출, 카테고리, 메모, 결제수단, 월별 보기
- 습관 트래커: 14일 그리드 + 연속일수
- 회고/일기: 날짜별 한 줄, 기분 이모지
- 목표: 주간/월간
- 통계: 카테고리별 파이, 일별 막대 차트

## 처음 한 번 셋업

```bash
npm install
npx wrangler login
npx wrangler d1 create self-managing-system
```

마지막 명령이 출력하는 `database_id`를 `wrangler.jsonc`의 `PLACEHOLDER_REPLACE_AFTER_CREATE` 자리에 붙여넣기.

```bash
npm run db:migrate:local
npm run db:seed:local
npm run db:migrate:remote
npm run db:seed:remote
```

## 개발

```bash
npm run dev
```

`http://localhost:5173` (Vite + Workers 통합 dev)

## 배포

```bash
npm run deploy
```

Cloudflare에서 `*.workers.dev` URL 받고 끝. 핸드폰에서도 그 URL로 접속 가능.

## DB 스키마 변경 시

```bash
# schema.ts 수정 후
npm run db:generate           # 새 마이그레이션 SQL 생성
npm run db:migrate:local      # 로컬 적용
npm run db:migrate:remote     # 원격 적용
```
