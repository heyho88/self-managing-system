import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Todo, type Transaction, type Budget, type Category, type TimeBlock } from '../lib/api';
import { todayKey, monthKey, formatKRW, minutesToTime, timeToMinutes } from '../lib/utils';

export function TodayPage() {
  const date = todayKey();
  const month = monthKey();
  const qc = useQueryClient();

  const todos = useQuery({
    queryKey: ['todos', date],
    queryFn: () => api.get<Todo[]>(`/api/todos?date=${date}`),
  });
  const txs = useQuery({
    queryKey: ['transactions', month],
    queryFn: () => api.get<Transaction[]>(`/api/transactions?month=${month}`),
  });
  const budgets = useQuery({
    queryKey: ['budgets', month],
    queryFn: () => api.get<Budget[]>(`/api/budgets?month=${month}`),
  });
  const cats = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/categories'),
  });
  const blocks = useQuery({
    queryKey: ['time-blocks', date],
    queryFn: () => api.get<TimeBlock[]>(`/api/time-blocks?date=${date}`),
  });

  const totalBudget = useMemo(
    () => budgets.data?.find((b) => b.categoryId === null)?.amount ?? 0,
    [budgets.data],
  );
  const monthSpent = useMemo(
    () =>
      (txs.data ?? [])
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0),
    [txs.data],
  );
  const todaySpent = useMemo(
    () =>
      (txs.data ?? [])
        .filter((t) => t.type === 'expense' && t.date === date)
        .reduce((s, t) => s + t.amount, 0),
    [txs.data, date],
  );

  return (
    <div className="space-y-4">
      <Greeting />
      <BudgetCard totalBudget={totalBudget} monthSpent={monthSpent} todaySpent={todaySpent} month={month} />
      <TodosCard todos={todos.data ?? []} date={date} onChange={() => qc.invalidateQueries({ queryKey: ['todos', date] })} />
      <QuickExpenseCard
        categories={cats.data ?? []}
        date={date}
        onAdded={() => {
          qc.invalidateQueries({ queryKey: ['transactions'] });
        }}
      />
      <TimeBlocksCard blocks={blocks.data ?? []} date={date} onChange={() => qc.invalidateQueries({ queryKey: ['time-blocks', date] })} />
    </div>
  );
}

function Greeting() {
  const d = new Date();
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return (
    <div>
      <div className="text-2xl font-semibold tracking-tight">
        {d.getMonth() + 1}월 {d.getDate()}일 ({dow})
      </div>
      <div className="text-sm text-neutral-500">오늘도 한 발짝.</div>
    </div>
  );
}

function BudgetCard({
  totalBudget,
  monthSpent,
  todaySpent,
  month,
}: {
  totalBudget: number;
  monthSpent: number;
  todaySpent: number;
  month: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(totalBudget));
  const pct = totalBudget > 0 ? Math.min(100, Math.round((monthSpent / totalBudget) * 100)) : 0;
  const over = totalBudget > 0 && monthSpent > totalBudget;

  const save = useMutation({
    mutationFn: (amount: number) => api.put('/api/budgets', { month, categoryId: null, amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets', month] });
      setEditing(false);
    },
  });

  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <div className="text-sm text-neutral-400">이번 달 지출</div>
        <button
          className="text-xs text-neutral-500 hover:text-neutral-300"
          onClick={() => {
            setDraft(String(totalBudget));
            setEditing((v) => !v);
          }}
        >
          예산 설정
        </button>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-semibold">{formatKRW(monthSpent)}</div>
        {totalBudget > 0 && (
          <div className={`text-sm ${over ? 'text-red-400' : 'text-neutral-500'}`}>
            / {formatKRW(totalBudget)} ({pct}%)
          </div>
        )}
      </div>
      <div className="mt-1 text-xs text-neutral-500">오늘 지출 {formatKRW(todaySpent)}</div>
      {totalBudget > 0 && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800">
          <div
            className={`h-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {editing && (
        <div className="mt-3 flex gap-2">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="월 예산 (원)"
          />
          <button className="btn-primary" onClick={() => save.mutate(Number(draft) || 0)}>
            저장
          </button>
        </div>
      )}
    </div>
  );
}

function TodosCard({ todos, date, onChange }: { todos: Todo[]; date: string; onChange: () => void }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(0);

  const add = useMutation({
    mutationFn: (t: { title: string; priority: number; dueDate: string }) => api.post<Todo>('/api/todos', t),
    onSuccess: () => {
      setTitle('');
      onChange();
    },
  });
  const toggle = useMutation({
    mutationFn: (t: Todo) => api.patch(`/api/todos/${t.id}`, { done: !t.done }),
    onSuccess: onChange,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/todos/${id}`),
    onSuccess: onChange,
  });

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-300">오늘 할 일</div>
        <div className="text-xs text-neutral-500">
          {todos.filter((t) => t.done).length} / {todos.length}
        </div>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          add.mutate({ title: title.trim(), priority, dueDate: date });
        }}
      >
        <input
          className="input"
          placeholder="할 일 추가..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="button"
          className={`btn-ghost ${priority === 1 ? 'text-amber-400' : ''}`}
          onClick={() => setPriority((p) => (p === 1 ? 0 : 1))}
          title="중요"
        >
          ★
        </button>
        <button className="btn-primary" type="submit">
          추가
        </button>
      </form>
      <ul className="mt-3 space-y-1">
        {todos.map((t) => (
          <li
            key={t.id}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-900"
          >
            <button
              className={`h-5 w-5 shrink-0 rounded-md border ${
                t.done ? 'border-emerald-500 bg-emerald-500' : 'border-neutral-700'
              }`}
              onClick={() => toggle.mutate(t)}
              aria-label="toggle"
            >
              {t.done && <span className="block text-center text-xs leading-5 text-black">✓</span>}
            </button>
            <span className={`flex-1 text-sm ${t.done ? 'text-neutral-600 line-through' : ''}`}>
              {t.priority === 1 && <span className="mr-1 text-amber-400">★</span>}
              {t.title}
            </span>
            <button
              className="text-xs text-neutral-600 opacity-0 transition group-hover:opacity-100"
              onClick={() => remove.mutate(t.id)}
            >
              삭제
            </button>
          </li>
        ))}
        {todos.length === 0 && <li className="py-4 text-center text-xs text-neutral-600">할 일을 추가해보세요</li>}
      </ul>
    </div>
  );
}

function QuickExpenseCard({
  categories,
  date,
  onAdded,
}: {
  categories: Category[];
  date: string;
  onAdded: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const filtered = categories.filter((c) => c.type === type);
  const [categoryId, setCategoryId] = useState<number | ''>('');

  const add = useMutation({
    mutationFn: () =>
      api.post('/api/transactions', {
        amount: Number(amount.replace(/,/g, '')) || 0,
        type,
        categoryId: categoryId || null,
        memo: memo || null,
        date,
      }),
    onSuccess: () => {
      setAmount('');
      setMemo('');
      onAdded();
    },
  });

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-300">빠른 지출 입력</div>
        <div className="flex overflow-hidden rounded-md border border-neutral-800">
          {(['expense', 'income'] as const).map((v) => (
            <button
              key={v}
              className={`px-2 py-0.5 text-xs ${
                type === v ? 'bg-neutral-100 text-black' : 'text-neutral-400'
              }`}
              onClick={() => {
                setType(v);
                setCategoryId('');
              }}
            >
              {v === 'expense' ? '지출' : '수입'}
            </button>
          ))}
        </div>
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!amount) return;
          add.mutate();
        }}
      >
        <div className="flex gap-2">
          <input
            className="input"
            inputMode="numeric"
            placeholder="금액"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          />
          <select
            className="input max-w-[140px]"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">카테고리</option>
            {filtered.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <button className="btn-primary shrink-0" type="submit">
            추가
          </button>
        </div>
      </form>
    </div>
  );
}

function TimeBlocksCard({
  blocks,
  date,
  onChange,
}: {
  blocks: TimeBlock[];
  date: string;
  onChange: () => void;
}) {
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [title, setTitle] = useState('');

  const add = useMutation({
    mutationFn: () =>
      api.post('/api/time-blocks', {
        date,
        startMinute: timeToMinutes(start),
        endMinute: timeToMinutes(end),
        title,
      }),
    onSuccess: () => {
      setTitle('');
      onChange();
    },
  });
  const toggle = useMutation({
    mutationFn: (b: TimeBlock) => api.patch(`/api/time-blocks/${b.id}`, { done: !b.done }),
    onSuccess: onChange,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/time-blocks/${id}`),
    onSuccess: onChange,
  });

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium text-neutral-300">시간 블록</div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          add.mutate();
        }}
      >
        <input className="input max-w-[90px]" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <input className="input max-w-[90px]" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        <input className="input" placeholder="무엇을?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn-primary shrink-0">추가</button>
      </form>
      <ul className="mt-3 space-y-1">
        {blocks.map((b) => (
          <li
            key={b.id}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-900"
          >
            <span className="w-[110px] shrink-0 text-xs text-neutral-500">
              {minutesToTime(b.startMinute)} – {minutesToTime(b.endMinute)}
            </span>
            <button
              className={`h-4 w-4 shrink-0 rounded border ${
                b.done ? 'border-emerald-500 bg-emerald-500' : 'border-neutral-700'
              }`}
              onClick={() => toggle.mutate(b)}
            />
            <span className={`flex-1 text-sm ${b.done ? 'text-neutral-600 line-through' : ''}`}>{b.title}</span>
            <button
              className="text-xs text-neutral-600 opacity-0 transition group-hover:opacity-100"
              onClick={() => remove.mutate(b.id)}
            >
              삭제
            </button>
          </li>
        ))}
        {blocks.length === 0 && (
          <li className="py-4 text-center text-xs text-neutral-600">시간 블록을 추가해보세요</li>
        )}
      </ul>
    </div>
  );
}
