-- 기본 카테고리 시드 (지출/수입/이벤트)

INSERT INTO categories (id, name, kind, color) VALUES
  ('exp_food',     '식비',   'expense', '#d44c47'),
  ('exp_house',    '주거',   'expense', '#3f5b8c'),
  ('exp_transit',  '교통',   'expense', '#4a7aa8'),
  ('exp_telecom',  '통신',   'expense', '#7d5a8c'),
  ('exp_medical',  '의료',   'expense', '#5a8f5a'),
  ('exp_shop',     '쇼핑',   'expense', '#d98e3f'),
  ('exp_culture',  '문화',   'expense', '#c9b443'),
  ('exp_edu',      '교육',   'expense', '#5a8f5a'),
  ('exp_event',    '경조사', 'expense', '#8a8a85'),
  ('exp_etc',      '기타',   'expense', '#8a8a85'),

  ('inc_salary',   '급여',   'income',  '#5a8f5a'),
  ('inc_side',     '부수입', 'income',  '#4a7aa8'),
  ('inc_interest', '이자',   'income',  '#c9b443'),
  ('inc_refund',   '환급',   'income',  '#7d5a8c'),
  ('inc_etc',      '기타',   'income',  '#8a8a85'),

  ('evt_work',     '업무',   'event',   '#3f5b8c'),
  ('evt_personal', '개인',   'event',   '#7d5a8c'),
  ('evt_meet',     '약속',   'event',   '#d98e3f'),
  ('evt_meal',     '식사',   'event',   '#d44c47'),
  ('evt_workout',  '운동',   'event',   '#5a8f5a'),
  ('evt_study',    '학습',   'event',   '#4a7aa8'),
  ('evt_move',     '이동',   'event',   '#8a8a85'),
  ('evt_rest',     '휴식',   'event',   '#c9b443');

INSERT INTO settings (key, value) VALUES
  ('user.wake_min',        '420'),
  ('user.sleep_min',       '1440'),
  ('user.focus_start_min', '600'),
  ('user.focus_end_min',   '1020'),
  ('user.lunch_min',       '720'),
  ('user.dinner_min',      '1140');

-- 기본 계좌 시드
INSERT INTO accounts (id, name, type, opening_balance) VALUES
  ('acc_cash',     '현금',       'cash',    0),
  ('acc_checking', '주거래',     'bank',    0),
  ('acc_savings',  '저축',       'bank',    0),
  ('acc_card',     '신용카드',   'card',    0);
