# 라이프OS

개인용 데스크탑 웹앱. 30분 단위 시간 플래너 + 가계부 + Claude 코파일럿.

전체 설계는 [SPEC.md](./SPEC.md) 참고.

## 스택

- React 18 + Vite + TypeScript + Tailwind
- Cloudflare Workers (Assets binding으로 SPA 호스팅 + `/api`)
- D1 + Drizzle ORM
- Hono (Worker 라우팅)
- OpenAI API (`openai`) — Phase 9, 모델: `gpt-5-mini`

## 개발

```bash
npm install

# D1 데이터베이스 생성 (최초 1회)
npx wrangler d1 create self_managing_system
# → 출력된 database_id 를 wrangler.jsonc 의 REPLACE_WITH_D1_ID 에 붙여넣기

# 로컬 마이그레이션 + 시드
npm run db:migrate:local
npx wrangler d1 execute self_managing_system --local --file=migrations/seed.sql

# 프론트 개발 서버 (5173, /api 는 8787 로 프록시)
npm run dev

# Worker 개발 서버
npm run dev:worker
```

## 배포

```bash
# 원격 D1 마이그레이션
npm run db:migrate:remote

# 빌드 + 배포
npm run deploy

# 시크릿 (에이전트용 — Phase 9)
npx wrangler secret put OPENAI_API_KEY
```

배포된 Worker URL 앞에 Cloudflare Access(이메일 1개) 게이트를 두는 것이 강력 권장 — 가계부·일기 비공개, 에이전트 토큰 도용 방지.

### Cloudflare Access 셋업

`/api/*`(특히 `/api/agent/*`)는 워커에서 Access JWT(`Cf-Access-Jwt-Assertion`)를 검증한다. Cloudflare 대시보드에서 다음을 한 번만 설정한다.

1. **Zero Trust → Access → Applications → Add an application → Self-hosted** 선택.
2. Application domain 을 배포된 워커 도메인(예: `self-managing-system.<account>.workers.dev` 또는 커스텀 도메인)으로 지정. Path 는 비워서 전체 보호.
3. **Policy** 한 개 추가: Action=Allow, Include=Emails=`baly.hanchoi@gmail.com`. (다른 정책 없음)
4. 애플리케이션 저장 후 **Application Audience (AUD) Tag** 를 복사.
5. `wrangler.jsonc` 의 `vars`:
   - `ACCESS_TEAM_DOMAIN` → 본인 팀 도메인(예: `myteam.cloudflareaccess.com`)
   - `ACCESS_AUD` → 위 4번에서 복사한 AUD 태그
   - `ENVIRONMENT` → `production` (로컬 개발은 그대로 `development` — 검증 자동 스킵)
6. `npm run deploy` 후 워커 도메인을 브라우저로 열면 Access 로그인 페이지가 먼저 뜨고, 통과해야 SPA 와 `/api/*` 에 접근 가능.

로컬 `wrangler dev` 에서는 `ENVIRONMENT=development` 또는 `ACCESS_AUD` 가 placeholder(`<…>`) 인 동안 미들웨어가 검증을 스킵한다.

## 디렉토리

```
src/
  components/   레이아웃 / 사이드바 / 상단바
  pages/        13개 페이지 셸 (Phase 2~ 에서 본격 구현)
  lib/          유틸 / API 클라이언트
  worker/       Hono 라우터, Drizzle 스키마
migrations/     D1 SQL 마이그레이션
SPEC.md         전체 설계 문서
```

## 진행도

- [x] Phase 1 — 스캐폴드 / 사이드바 / 라우팅 / D1 스키마
- [ ] Phase 2 — 오늘 (시간블록 30분 그리드)
- [ ] Phase 3 — 주간
- [ ] Phase 4 — 월간
- [ ] Phase 5 — 할일 인박스
- [ ] Phase 6 — 가계부
- [ ] Phase 7 — 자산 / 통계
- [ ] Phase 8 — 목표 / 습관 / 일기
- [ ] Phase 9 — 코파일럿 (Claude API)
- [ ] Phase 10 — 주간 템플릿
- [ ] Phase 11 — ⌘K 검색 / 단축키 / 다크모드
