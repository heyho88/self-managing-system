import type {
  AccountRow,
  AgentMessage,
  AgentProposal,
  AgentThread,
  CategoryRow,
  DailyBundle,
  EventRow,
  GoalRow,
  JournalHeader,
  JournalRow,
  SearchResult,
  SettingRow,
  TaskRow,
  TransactionRow,
  WeeklyTemplate,
  WeeklyTemplateBlock,
} from './types';

const PASSWORD_KEY = 'appPassword';

export function getAppPassword(): string | null {
  try {
    return localStorage.getItem(PASSWORD_KEY);
  } catch {
    return null;
  }
}

export function setAppPassword(pw: string): void {
  try {
    localStorage.setItem(PASSWORD_KEY, pw);
  } catch {
    // ignore
  }
}

export function clearAppPassword(): void {
  try {
    localStorage.removeItem(PASSWORD_KEY);
  } catch {
    // ignore
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const pw = getAppPassword();
  if (pw) headers['X-App-Password'] = pw;
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    // 비번 만료/변경 — 저장 비번 폐기 후 재인증 트리거
    clearAppPassword();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:unauthorized'));
    }
    throw new Error(`API ${path} 401 — unauthorized`);
  }
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = (j as { error?: string }).error ?? '';
    } catch {
      // ignore
    }
    throw new Error(`API ${path} ${res.status}${detail ? ` — ${detail}` : ''}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// 게이트 화면에서 검증할 때 단발성으로 사용
export async function verifyAppPassword(pw: string): Promise<boolean> {
  try {
    const res = await fetch('/api/health', {
      headers: { 'X-App-Password': pw },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const apiClient = {
  health: () => req<{ ok: boolean; env: string }>('/api/health'),

  listEvents: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return req<EventRow[]>(`/api/events${qs ? `?${qs}` : ''}`);
  },
  createEvent: (data: {
    date: string;
    start_min: number;
    end_min: number;
    title: string;
    category?: string | null;
    notes?: string | null;
  }) =>
    req<EventRow>('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEvent: (id: string, patch: Partial<Omit<EventRow, 'id' | 'created_at'>>) =>
    req<EventRow>(`/api/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteEvent: (id: string) =>
    req<{ ok: true }>(`/api/events/${id}`, { method: 'DELETE' }),

  listCategories: (kind?: 'expense' | 'income' | 'event') => {
    const qs = kind ? `?kind=${kind}` : '';
    return req<CategoryRow[]>(`/api/categories${qs}`);
  },

  listTasks: (params?: { status?: 'open' | 'done' | 'all'; scheduled?: string; from?: string; to?: string; goal?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.scheduled) q.set('scheduled', params.scheduled);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.goal) q.set('goal', params.goal);
    const qs = q.toString();
    return req<TaskRow[]>(`/api/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask: (data: {
    title: string;
    scheduled_date?: string | null;
    due_date?: string | null;
    priority?: number;
    goal_id?: string | null;
    notes?: string | null;
  }) =>
    req<TaskRow>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTask: (id: string, patch: Partial<Omit<TaskRow, 'id' | 'created_at'>>) =>
    req<TaskRow>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteTask: (id: string) => req<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' }),

  // 계좌
  listAccounts: () => req<AccountRow[]>('/api/accounts'),
  createAccount: (data: {
    name: string;
    type: AccountRow['type'];
    opening_balance?: number;
    payment_day?: number | null;
  }) => req<AccountRow>('/api/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: string, patch: Partial<Omit<AccountRow, 'id'>>) =>
    req<AccountRow>(`/api/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAccount: (id: string) => req<{ ok: true }>(`/api/accounts/${id}`, { method: 'DELETE' }),

  // 거래
  listTransactions: (params?: { from?: string; to?: string; account?: string; type?: TransactionRow['type'] }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.account) q.set('account', params.account);
    if (params?.type) q.set('type', params.type);
    const qs = q.toString();
    return req<TransactionRow[]>(`/api/transactions${qs ? `?${qs}` : ''}`);
  },
  createTransaction: (data: {
    date: string;
    account_id: string;
    category_id?: string | null;
    amount: number;
    type: TransactionRow['type'];
    memo?: string | null;
    tags?: string | null;
  }) =>
    req<TransactionRow>('/api/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id: string, patch: Partial<Omit<TransactionRow, 'id'>>) =>
    req<TransactionRow>(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteTransaction: (id: string) =>
    req<{ ok: true }>(`/api/transactions/${id}`, { method: 'DELETE' }),

  // 카테고리 (지출/수입 신규)
  createCategory: (data: { name: string; kind: 'expense' | 'income'; color?: string; budget_monthly?: number }) =>
    req<CategoryRow>('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, patch: { name?: string; color?: string | null; budget_monthly?: number | null }) =>
    req<CategoryRow>(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  // 목표
  listGoals: () => req<GoalRow[]>('/api/goals'),
  createGoal: (data: {
    title: string;
    type: GoalRow['type'];
    period_start: string;
    period_end: string;
    parent_id?: string | null;
    notes?: string | null;
  }) => req<GoalRow>('/api/goals', { method: 'POST', body: JSON.stringify(data) }),
  updateGoal: (id: string, patch: Partial<Omit<GoalRow, 'id'>>) =>
    req<GoalRow>(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteGoal: (id: string) => req<{ ok: true }>(`/api/goals/${id}`, { method: 'DELETE' }),

  // 일기
  getJournal: (date: string) => req<JournalRow | null>(`/api/journal?date=${date}`),
  listJournalHeaders: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return req<JournalHeader[]>(`/api/journal${qs ? `?${qs}` : ''}`);
  },
  upsertJournal: (date: string, data: { content?: string | null; mood?: number | null }) =>
    req<JournalRow>(`/api/journal/${date}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteJournal: (date: string) => req<{ ok: true }>(`/api/journal/${date}`, { method: 'DELETE' }),

  // 주간 템플릿
  listTemplates: () => req<WeeklyTemplate[]>('/api/templates'),
  createTemplate: (data: { name: string; notes?: string }) =>
    req<WeeklyTemplate>('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, patch: Partial<Omit<WeeklyTemplate, 'id' | 'created_at'>>) =>
    req<WeeklyTemplate>(`/api/templates/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteTemplate: (id: string) => req<{ ok: true }>(`/api/templates/${id}`, { method: 'DELETE' }),
  listTemplateBlocks: (template_id: string) =>
    req<WeeklyTemplateBlock[]>(`/api/templates/${template_id}/blocks`),
  createTemplateBlock: (
    template_id: string,
    data: {
      weekday: number;
      start_min: number;
      end_min: number;
      title: string;
      category?: string | null;
      is_fixed?: boolean;
      notes?: string | null;
    }
  ) =>
    req<WeeklyTemplateBlock>(`/api/templates/${template_id}/blocks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTemplateBlock: (
    block_id: string,
    patch: Partial<{
      title: string;
      category: string | null;
      is_fixed: boolean | number;
      notes: string | null;
      start_min: number;
      end_min: number;
      weekday: number;
    }>
  ) =>
    req<WeeklyTemplateBlock>(`/api/templates/blocks/${block_id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteTemplateBlock: (block_id: string) =>
    req<{ ok: true }>(`/api/templates/blocks/${block_id}`, { method: 'DELETE' }),
  applyTemplate: (template_id: string, week_start: string, opts?: { only_guide?: boolean }) =>
    req<{ ok: true; applied: number; created_ids: string[] }>(`/api/templates/${template_id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ week_start, only_guide: opts?.only_guide ?? false }),
    }),

  // 에이전트
  listThreads: () => req<AgentThread[]>('/api/agent/threads'),
  listMessages: (thread_id: string) =>
    req<AgentMessage[]>(`/api/agent/threads/${thread_id}/messages`),
  listProposals: (thread_id: string) =>
    req<AgentProposal[]>(`/api/agent/threads/${thread_id}/proposals`),
  sendAgent: (data: { thread_id?: string; mode?: string; text: string; today?: string }) =>
    req<{
      thread_id: string;
      message_id: string;
      content: string;
      proposal_id: string | null;
      proposal_summary: string;
      proposal_actions: unknown[] | null;
      usage: { input: number; output: number; cache_read: number };
    }>('/api/agent/messages', { method: 'POST', body: JSON.stringify(data) }),
  applyProposal: (id: string) =>
    req<{ ok: true; applied: number; errors: string[] }>(`/api/agent/apply/${id}`, {
      method: 'POST',
    }),
  rejectProposal: (id: string) =>
    req<{ ok: true }>(`/api/agent/reject/${id}`, { method: 'POST' }),
  deleteThread: (id: string) =>
    req<{ ok: true }>(`/api/agent/threads/${id}`, { method: 'DELETE' }),
  updateThread: (id: string, patch: { title: string }) =>
    req<AgentThread>(`/api/agent/threads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // 검색
  search: (q: string) => req<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),

  // 설정
  listSettings: () => req<SettingRow[]>('/api/settings'),
  setSetting: (key: string, value: string | null) =>
    req<SettingRow>(`/api/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),

  // 익스포트 / 임포트
  exportAll: () => req<{ exported_at: string; version: number; data: Record<string, unknown[]> }>('/api/export/all'),
  importAll: (payload: { data: Record<string, unknown[]> }) =>
    req<{ ok: true; imported: Record<string, number>; skipped: string[] }>('/api/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // 에이전트 사용량
  agentUsage: () =>
    req<{
      pricing: { input: number; cached: number; output: number };
      total: { input: number; output: number; cache_read: number; messages: number; cost_usd: number };
      monthly: { month: string; input: number; output: number; cache_read: number; msgs: number; cost_usd: number }[];
      threads: { thread_id: string; title: string | null; input: number; output: number; cache_read: number; msgs: number; cost_usd: number }[];
    }>('/api/agent/usage'),

  // 일일 트래커 + 메모
  getDaily: (date: string) => req<DailyBundle>(`/api/daily?date=${date}`),
  setDailyMetric: (date: string, key: string, value: number) =>
    req<{ date: string; key: string; value: number }>(`/api/daily/${date}/metric/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
  setDailyNote: (date: string, content: string) =>
    req<{ date: string; content: string }>(`/api/daily/${date}/note`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
};
