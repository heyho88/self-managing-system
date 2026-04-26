async function http<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
  if (res.status === 204) return null as T;
  return res.json();
}

export const api = {
  get: <T>(url: string) => http<T>('GET', url),
  post: <T>(url: string, body: unknown) => http<T>('POST', url, body),
  put: <T>(url: string, body: unknown) => http<T>('PUT', url, body),
  patch: <T>(url: string, body: unknown) => http<T>('PATCH', url, body),
  del: <T>(url: string) => http<T>('DELETE', url),
};

// ---- Types matching the worker ----
export type Todo = {
  id: number;
  title: string;
  done: boolean;
  priority: number;
  dueDate: string | null;
  note: string | null;
  createdAt: number;
  completedAt: number | null;
};

export type Category = {
  id: number;
  name: string;
  type: 'income' | 'expense';
  color: string | null;
  icon: string | null;
};

export type Transaction = {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  categoryId: number | null;
  memo: string | null;
  paymentMethod: string | null;
  date: string;
  createdAt: number;
};

export type Budget = {
  id: number;
  month: string;
  categoryId: number | null;
  amount: number;
};

export type TimeBlock = {
  id: number;
  date: string;
  startMinute: number;
  endMinute: number;
  title: string;
  color: string | null;
  done: boolean;
};

export type Habit = {
  id: number;
  name: string;
  emoji: string | null;
  active: boolean;
  createdAt: number;
};

export type HabitLog = { id: number; habitId: number; date: string };

export type Journal = {
  id: number;
  date: string;
  content: string;
  mood: string | null;
  updatedAt: number;
};

export type Goal = {
  id: number;
  period: 'week' | 'month';
  periodKey: string;
  title: string;
  done: boolean;
  createdAt: number;
};
