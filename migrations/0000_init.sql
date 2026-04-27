-- 자기관리 시스템 초기 스키마
-- SPEC.md 페이지별 데이터 모델

CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,
  start_min   INTEGER NOT NULL,
  end_min     INTEGER NOT NULL,
  title       TEXT NOT NULL,
  category    TEXT,
  notes       TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_events_date ON events(date);

CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  done            INTEGER NOT NULL DEFAULT 0,
  priority        INTEGER NOT NULL DEFAULT 0,
  scheduled_date  TEXT,
  due_date        TEXT,
  goal_id         TEXT,
  parent_id       TEXT,
  position        INTEGER,
  notes           TEXT,
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_tasks_scheduled ON tasks(scheduled_date);
CREATE INDEX idx_tasks_done ON tasks(done);

CREATE TABLE goals (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  type         TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  progress     INTEGER NOT NULL DEFAULT 0,
  parent_id    TEXT,
  notes        TEXT
);

CREATE TABLE habits (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  color           TEXT,
  target_per_week INTEGER NOT NULL DEFAULT 7,
  archived        INTEGER NOT NULL DEFAULT 0,
  position        INTEGER
);

CREATE TABLE habit_logs (
  habit_id  TEXT NOT NULL,
  date      TEXT NOT NULL,
  value     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (habit_id, date)
);

CREATE TABLE journal_entries (
  date     TEXT PRIMARY KEY,
  content  TEXT,
  mood     INTEGER
);

CREATE TABLE accounts (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  archived        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL,
  color           TEXT,
  budget_monthly  INTEGER,
  parent_id       TEXT
);

CREATE TABLE transactions (
  id           TEXT PRIMARY KEY,
  date         TEXT NOT NULL,
  account_id   TEXT NOT NULL,
  category_id  TEXT,
  amount       INTEGER NOT NULL,
  type         TEXT NOT NULL,
  memo         TEXT,
  tags         TEXT
);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_account ON transactions(account_id);

CREATE TABLE daily_metrics (
  date    TEXT NOT NULL,
  key     TEXT NOT NULL,
  value   INTEGER NOT NULL,
  PRIMARY KEY (date, key)
);

CREATE TABLE weekly_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  notes       TEXT,
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE weekly_template_blocks (
  id           TEXT PRIMARY KEY,
  template_id  TEXT NOT NULL,
  weekday      INTEGER NOT NULL,
  start_min    INTEGER NOT NULL,
  end_min      INTEGER NOT NULL,
  title        TEXT NOT NULL,
  category     TEXT,
  is_fixed     INTEGER NOT NULL DEFAULT 1,
  notes        TEXT
);
CREATE INDEX idx_template_blocks_template ON weekly_template_blocks(template_id);

CREATE TABLE agent_threads (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  mode        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE agent_messages (
  id                  TEXT PRIMARY KEY,
  thread_id           TEXT NOT NULL,
  role                TEXT NOT NULL,
  content             TEXT NOT NULL,
  input_tokens        INTEGER,
  output_tokens       INTEGER,
  cache_read_tokens   INTEGER,
  cache_write_tokens  INTEGER,
  created_at          INTEGER NOT NULL
);
CREATE INDEX idx_agent_messages_thread ON agent_messages(thread_id);

CREATE TABLE agent_proposals (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  payload     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_agent_proposals_thread ON agent_proposals(thread_id);
CREATE INDEX idx_agent_proposals_status ON agent_proposals(status);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT
);
