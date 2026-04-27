export type EventRow = {
  id: string;
  date: string;
  start_min: number;
  end_min: number;
  title: string;
  category: string | null;
  notes: string | null;
  created_at: number;
};

export type CategoryRow = {
  id: string;
  name: string;
  kind: 'expense' | 'income' | 'event';
  color: string | null;
  budget_monthly: number | null;
  parent_id: string | null;
};

export type TaskRow = {
  id: string;
  title: string;
  done: number;
  priority: number;
  scheduled_date: string | null;
  due_date: string | null;
  goal_id: string | null;
  parent_id: string | null;
  position: number | null;
  notes: string | null;
  created_at: number;
};

export type AccountRow = {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'card' | 'invest' | 'etc';
  opening_balance: number;
  archived: number;
  payment_day: number | null;
};

export type TransactionRow = {
  id: string;
  date: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  type: 'expense' | 'income' | 'transfer';
  memo: string | null;
  tags: string | null;
};

export type GoalRow = {
  id: string;
  title: string;
  type: 'year' | 'quarter' | 'month' | 'week';
  period_start: string;
  period_end: string;
  progress: number;
  parent_id: string | null;
  notes: string | null;
  linked_tasks?: { total: number; done: number };
};

export type JournalRow = {
  date: string;
  content: string | null;
  mood: number | null;
};

export type JournalHeader = {
  date: string;
  mood: number | null;
  content_length: number;
};

export type WeeklyTemplate = {
  id: string;
  name: string;
  notes: string | null;
  is_default: number;
  created_at: number;
};

export type WeeklyTemplateBlock = {
  id: string;
  template_id: string;
  weekday: number;
  start_min: number;
  end_min: number;
  title: string;
  category: string | null;
  is_fixed: number;
  notes: string | null;
};

export type AgentThread = {
  id: string;
  title: string | null;
  mode: string;
  created_at: number;
  updated_at: number;
};

export type AgentMessage = {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  created_at: number;
};

export type AgentProposal = {
  id: string;
  thread_id: string;
  message_id: string;
  payload: string;
  status: 'pending' | 'applied' | 'partial' | 'rejected' | 'discarded';
  created_at: number;
};

export type AgentTemplateBlockInput = {
  weekday: number;
  start_min: number;
  end_min: number;
  title: string;
  category?: string | null;
  is_fixed?: boolean;
  notes?: string | null;
};

export type AgentAction =
  | { kind: 'create_event'; date: string; start_min: number; end_min: number; title: string; category?: string | null; notes?: string | null }
  | { kind: 'create_task'; title: string; scheduled_date?: string | null; priority?: number; goal_id?: string | null }
  | { kind: 'update_event'; id: string; patch: Record<string, unknown> }
  | { kind: 'delete_event'; id: string }
  | { kind: 'update_task'; id: string; patch: { scheduled_date?: string | null; priority?: number; done?: boolean } }
  | { kind: 'template_save'; name: string; is_default?: boolean; blocks: AgentTemplateBlockInput[] }
  | { kind: 'template_apply'; template_id: string; week_start: string; mode?: 'fill' | 'overwrite' };

export type SearchResult = {
  kind: 'event' | 'task' | 'goal' | 'tx' | 'journal';
  id: string;
  label: string;
  sub?: string;
};

export type SettingRow = {
  key: string;
  value: string | null;
};

export type DailyMetricRow = {
  date: string;
  key: string;
  value: number;
};

export type DailyBundle = {
  metrics: DailyMetricRow[];
  note: string;
};
