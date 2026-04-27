# 스킬 치트시트

> "이럴 때 이거 써" 한 줄 요약. `/스킬이름`으로 호출.

## 🧠 기획 · 브레인스토밍

| 스킬 | 이럴 때 |
|---|---|
| `/office-hours` | "이거 만들 가치 있나?" 아이디어 단계, 코드 한 줄도 없을 때 |
| `/plan-ceo-review` | 계획이 너무 작아 보일 때, "더 크게 생각해" 모드 |
| `/plan-eng-review` | 코드 짜기 직전, 아키텍처 빈틈 잡고 싶을 때 |
| `/plan-design-review` | UI 만들기 전, 디자인 계획 점수로 평가받고 싶을 때 |
| `/plan-devex-review` | API/CLI/SDK 만들기 전, 개발자 경험 점검 |
| `/autoplan` | 위 4개 리뷰를 한 번에 자동으로 |

## 🎨 디자인

| 스킬 | 이럴 때 |
|---|---|
| `/design-consultation` | 새 프로젝트, 디자인 시스템 처음부터 만들 때 |
| `/design-shotgun` | "여러 시안 보고 고르고 싶어" |
| `/design-html` | 승인된 디자인을 production HTML로 |
| `/design-review` | 라이브 사이트 시각적 QA + 자동 수정 |

## 🐛 디버깅 · QA

| 스킬 | 이럴 때 |
|---|---|
| `/investigate` | 버그 났는데 원인을 모를 때 (근본 원인 파기) |
| `/qa` | 사이트 자동 테스트 + 발견한 버그 자동 수정 |
| `/qa-only` | 테스트만, 수정은 안 함 (리포트만) |
| `/browse` / `/gstack` | 브라우저로 페이지 열어서 빠르게 확인 |
| `/connect-chrome` | 실제 크롬 띄워서 동작 눈으로 보면서 작업 |

## 🚀 배포 · 코드 리뷰

| 스킬 | 이럴 때 |
|---|---|
| `/review` | PR 머지 직전 diff 점검 |
| `/security-review` | 브랜치 보안 점검 |
| `/codex` | "다른 모델 의견 한번 들어보자" (GPT 2nd opinion) |
| `/ship` | 테스트→커밋→푸시→PR 한 방에 |
| `/land-and-deploy` | PR 머지 + CI 대기 + 프로덕션 헬스체크 |
| `/canary` | 배포 후 프로덕션 모니터링 |
| `/document-release` | 출시 후 README/CHANGELOG 자동 업데이트 |

## 📊 코드 건강 · 회고

| 스킬 | 이럴 때 |
|---|---|
| `/health` | 타입체커+린터+테스트 종합 점수 |
| `/cso` | 보안 감사 (시크릿/의존성/OWASP) |
| `/benchmark` | 페이지 속도 회귀 감지 |
| `/retro` | 주간 회고, 이번 주 뭐 했는지 |
| `/learn` | "이거 전에도 본 적 있는데?" 과거 학습 검색 |

## 🛡️ 안전 · 작업 범위

| 스킬 | 이럴 때 |
|---|---|
| `/careful` | 프로덕션 만질 때, `rm -rf`/`DROP TABLE` 경고 |
| `/freeze` | 디버깅 중 다른 폴더 건드리지 않게 잠금 |
| `/guard` | careful + freeze 한 방에 (최대 안전 모드) |
| `/unfreeze` | freeze 해제 |

## 💾 컨텍스트 · 진행 상황

| 스킬 | 이럴 때 |
|---|---|
| `/context-save` | 잠시 떠나기 전 "어디까지 했지" 저장 |
| `/context-restore` | 다음 세션에서 그 상태로 복원 |
| `/checkpoint` | 작업 중간 저장 (이어서 작업) |

## 🔧 유틸리티

| 스킬 | 이럴 때 |
|---|---|
| `/make-pdf` | 마크다운 → 출판 품질 PDF |
| `/init` | 새 프로젝트에 CLAUDE.md 만들기 |
| `/loop` | "5분마다 한 번씩 X 실행" |
| `/schedule` | 크론처럼 정해진 시간에 실행 |
| `/gstack-upgrade` | gstack 업데이트 |

---

## 🎯 자주 쓸 콤보

- **새 기능 시작**: `/office-hours` → `/autoplan` → 코딩
- **버그 잡기**: `/investigate` → 수정 → `/review` → `/ship`
- **출시 사이클**: `/ship` → `/land-and-deploy` → `/canary` → `/document-release`
- **프로덕션 작업**: `/guard` 켜고 시작
