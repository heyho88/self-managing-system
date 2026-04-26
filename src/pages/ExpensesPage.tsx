import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Transaction, type Category } from '../lib/api';
import { formatKRW, monthKey, todayKey } from '../lib/utils';

export function ExpensesPage() {
  const [month, setMonth] = useState(monthKey());
  const qc = useQueryClient();

  const txs = useQuery({
    queryKey: ['transactions', month],
    queryFn: () => api.get<Transaction[]>(`/api/transactions?month=${month}`),
  });
  const cats = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/categories'),
  });
  const catMap = useMemo(() => {
    const m = new Map<number, Category>();
    (cats.data ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [cats.data]);

  const totals = useMemo(() => {
    const t = (txs.data ?? []).reduce(
      (acc, x) => {
        if (x.type === 'expense') acc.expense += x.amount;
        else acc.income += x.amount;
        return acc;
      },
      { expense: 0, income: 0 },
    );
    return { ...t, net: t.income - t.expense };
  }, [txs.data]);

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/transactions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          type="month"
          className="input max-w-[160px]"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <div className="text-xs text-neutral-500">총 {(txs.data ?? []).length}건</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="지출" value={formatKRW(totals.expense)} tone="red" />
        <Stat label="수입" value={formatKRW(totals.income)} tone="green" />
        <Stat label="순자산" value={formatKRW(totals.net)} tone={totals.net < 0 ? 'red' : 'green'} />
      </div>
      <AddTransaction
        categories={cats.data ?? []}
        defaultDate={todayKey()}
        onAdded={() => qc.invalidateQueries({ queryKey: ['transactions'] })}
      />
      <div className="card p-0">
        <ul className="divide-y divide-neutral-900">
          {(txs.data ?? []).map((t) => {
            const c = t.categoryId ? catMap.get(t.categoryId) : null;
            return (
              <li key={t.id} className="group flex items-center gap-3 px-4 py-3">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm"
                  style={{ background: (c?.color ?? '#374151') + '33' }}
                >
                  {c?.icon ?? (t.type === 'income' ? '💰' : '💸')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {t.memo || c?.name || (t.type === 'income' ? '수입' : '지출')}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {t.date}
                    {c ? ` · ${c.name}` : ''}
                  </div>
                </div>
                <div
                  className={`shrink-0 text-sm font-medium ${
                    t.type === 'income' ? 'text-emerald-400' : 'text-red-300'
                  }`}
                >
                  {t.type === 'income' ? '+' : '-'}
                  {formatKRW(t.amount)}
                </div>
                <button
                  className="text-xs text-neutral-600 opacity-0 transition group-hover:opacity-100"
                  onClick={() => remove.mutate(t.id)}
                >
                  ×
                </button>
              </li>
            );
          })}
          {(txs.data ?? []).length === 0 && (
            <li className="py-12 text-center text-xs text-neutral-600">아직 내역이 없어요</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'red' | 'green' }) {
  return (
    <div className="card">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-1 text-base font-semibold ${tone === 'red' ? 'text-red-300' : 'text-emerald-400'}`}>
        {value}
      </div>
    </div>
  );
}

function AddTransaction({
  categories,
  defaultDate,
  onAdded,
}: {
  categories: Category[];
  defaultDate: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const add = useMutation({
    mutationFn: () =>
      api.post('/api/transactions', {
        amount: Number(amount) || 0,
        type,
        categoryId: categoryId || null,
        memo: memo || null,
        paymentMethod: paymentMethod || null,
        date,
      }),
    onSuccess: () => {
      setAmount('');
      setMemo('');
      setOpen(false);
      onAdded();
    },
  });

  if (!open) {
    return (
      <button className="btn-primary w-full" onClick={() => setOpen(true)}>
        + 새 내역 추가
      </button>
    );
  }

  const filtered = categories.filter((c) => c.type === type);
  return (
    <div className="card space-y-2">
      <div className="flex overflow-hidden rounded-md border border-neutral-800 self-start">
        {(['expense', 'income'] as const).map((v) => (
          <button
            key={v}
            className={`px-3 py-1 text-xs ${type === v ? 'bg-neutral-100 text-black' : 'text-neutral-400'}`}
            onClick={() => {
              setType(v);
              setCategoryId('');
            }}
          >
            {v === 'expense' ? '지출' : '수입'}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input"
          inputMode="numeric"
          placeholder="금액"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
        />
        <input className="input max-w-[160px]" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <select
          className="input"
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
        <select
          className="input max-w-[140px]"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="">결제수단</option>
          <option value="card">카드</option>
          <option value="cash">현금</option>
          <option value="transfer">이체</option>
        </select>
      </div>
      <input className="input" placeholder="메모" value={memo} onChange={(e) => setMemo(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => setOpen(false)}>
          취소
        </button>
        <button className="btn-primary flex-1" onClick={() => add.mutate()} disabled={!amount}>
          저장
        </button>
      </div>
    </div>
  );
}
