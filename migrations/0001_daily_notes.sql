-- 오늘 페이지 자유 메모 (일자별)
CREATE TABLE daily_notes (
  date     TEXT PRIMARY KEY,
  content  TEXT
);

-- 카드 결제일 (자산 페이지 보강 — 추후 사용)
ALTER TABLE accounts ADD COLUMN payment_day INTEGER;

-- 템플릿 마지막 적용일
ALTER TABLE weekly_templates ADD COLUMN last_applied_at INTEGER;
