import { useCallback, useEffect, useState } from 'react';
import { apiClient } from './api';
import type {
  AccountRow,
  CategoryRow,
  EventRow,
  GoalRow,
  TaskRow,
  TransactionRow,
} from './types';

export function useEventsRange(from: string, to: string) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiClient.listEvents(from, to);
      setEvents(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    reload();
  }, [reload]);

  function sort(arr: EventRow[]): EventRow[] {
    return [...arr].sort((a, b) =>
      a.date === b.date ? a.start_min - b.start_min : a.date < b.date ? -1 : 1
    );
  }

  return {
    events,
    loading,
    error,
    reload,
    create: async (input: Parameters<typeof apiClient.createEvent>[0]) => {
      const ev = await apiClient.createEvent(input);
      setEvents((prev) => sort([...prev, ev]));
      return ev;
    },
    update: async (id: string, patch: Parameters<typeof apiClient.updateEvent>[1]) => {
      const ev = await apiClient.updateEvent(id, patch);
      setEvents((prev) => sort(prev.map((e) => (e.id === id ? ev : e))));
      return ev;
    },
    remove: async (id: string) => {
      await apiClient.deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    },
  };
}

export function useEvents(date: string) {
  return useEventsRange(date, date);
}

export function useCategories(kind?: 'expense' | 'income' | 'event') {
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  useEffect(() => {
    let alive = true;
    apiClient.listCategories(kind).then((list) => {
      if (alive) setCategories(list);
    });
    return () => {
      alive = false;
    };
  }, [kind]);

  return categories;
}

type TaskFilter = { status?: 'open' | 'done' | 'all'; scheduled?: string; from?: string; to?: string };

export function useTasks(filter: TaskFilter = {}) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterKey = JSON.stringify(filter);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiClient.listTasks(filter);
      setTasks(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    tasks,
    loading,
    error,
    reload,
    create: async (input: Parameters<typeof apiClient.createTask>[0]) => {
      const t = await apiClient.createTask(input);
      setTasks((prev) => [t, ...prev]);
      return t;
    },
    update: async (id: string, patch: Parameters<typeof apiClient.updateTask>[1]) => {
      const t = await apiClient.updateTask(id, patch);
      setTasks((prev) => prev.map((x) => (x.id === id ? t : x)));
      return t;
    },
    remove: async (id: string) => {
      await apiClient.deleteTask(id);
      setTasks((prev) => prev.filter((x) => x.id !== id));
    },
  };
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiClient.listAccounts();
      setAccounts(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    accounts,
    loading,
    error,
    reload,
    create: async (input: Parameters<typeof apiClient.createAccount>[0]) => {
      const a = await apiClient.createAccount(input);
      setAccounts((prev) => [...prev, a].sort((x, y) => x.archived - y.archived || x.name.localeCompare(y.name)));
      return a;
    },
    update: async (id: string, patch: Parameters<typeof apiClient.updateAccount>[1]) => {
      const a = await apiClient.updateAccount(id, patch);
      setAccounts((prev) =>
        prev
          .map((x) => (x.id === id ? a : x))
          .sort((x, y) => x.archived - y.archived || x.name.localeCompare(y.name))
      );
      return a;
    },
    remove: async (id: string) => {
      await apiClient.deleteAccount(id);
      setAccounts((prev) => prev.filter((x) => x.id !== id));
    },
  };
}

type TxFilter = { from?: string; to?: string; account?: string; type?: TransactionRow['type'] };

export function useTransactions(filter: TxFilter = {}) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterKey = JSON.stringify(filter);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiClient.listTransactions(filter);
      setTransactions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  function sort(arr: TransactionRow[]): TransactionRow[] {
    return [...arr].sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1));
  }

  return {
    transactions,
    loading,
    error,
    reload,
    create: async (input: Parameters<typeof apiClient.createTransaction>[0]) => {
      const t = await apiClient.createTransaction(input);
      setTransactions((prev) => sort([t, ...prev]));
      return t;
    },
    update: async (id: string, patch: Parameters<typeof apiClient.updateTransaction>[1]) => {
      const t = await apiClient.updateTransaction(id, patch);
      setTransactions((prev) => sort(prev.map((x) => (x.id === id ? t : x))));
      return t;
    },
    remove: async (id: string) => {
      await apiClient.deleteTransaction(id);
      setTransactions((prev) => prev.filter((x) => x.id !== id));
    },
  };
}

export function useGoals() {
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiClient.listGoals();
      setGoals(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    goals,
    loading,
    error,
    reload,
    create: async (input: Parameters<typeof apiClient.createGoal>[0]) => {
      const g = await apiClient.createGoal(input);
      setGoals((prev) => [g, ...prev]);
      return g;
    },
    update: async (id: string, patch: Parameters<typeof apiClient.updateGoal>[1]) => {
      const g = await apiClient.updateGoal(id, patch);
      setGoals((prev) => prev.map((x) => (x.id === id ? g : x)));
      return g;
    },
    remove: async (id: string) => {
      await apiClient.deleteGoal(id);
      setGoals((prev) => prev.filter((x) => x.id !== id));
    },
  };
}

function nowMinFloat(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function useNowMin(): number {
  const [now, setNow] = useState(nowMinFloat);
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMinFloat()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function useNowHHMM(): string {
  const [text, setText] = useState(() => formatHHMM(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setText(formatHHMM(new Date())), 15000);
    return () => window.clearInterval(id);
  }, []);
  return text;
}

function formatHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
