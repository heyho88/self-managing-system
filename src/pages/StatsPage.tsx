import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { api, type Transaction, type Category } from '../lib/api';
import { formatKRW, monthKey } from '../lib/utils';

export function StatsPage() {
  const [month, setMonth] = useState(monthKey());

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

  const byCat = useMemo(() => {
    const m = new Map<number | 'none', number>();
    (txs.data ?? [])
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const k = (t.categoryId ?? 'none') as number | 'none';
        m.set(k, (m.get(k) ?? 0) + t.amount);
      });
    return [...m.entries()]
      .map(([k, v]) => {
        const c = typeof k === 'number' ? catMap.get(k) : null;
        return {
          name: c?.name ?? '미분류',
          color: c?.color ?? '#6b7280',
          value: v,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [txs.data, catMap]);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    (txs.data ?? [])
      .filter((t) => t.type === 'expense')
      .forEach((t) => m.set(t.date, (m.get(t.date) ?? 0) + t.amount));
    const [y, mo] = month.split('-').map(Number);
    const days = new Date(y, mo, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      const date = `${month}-${day}`;
      return { day: i + 1, amount: m.get(date) ?? 0 };
    });
  }, [txs.data, month]);

  return (
    <div className="space-y-4">
      <input type="month" className="input max-w-[160px]" value={month} onChange={(e) => setMonth(e.target.value)} />

      <div className="card">
        <div className="mb-2 text-sm font-medium text-neutral-300">카테고리별 지출</div>
        <div className="h-60">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {byCat.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: 8 }}
                formatter={(v: number) => formatKRW(v)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {byCat.map((d) => (
            <li key={d.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span>{d.name}</span>
              </div>
              <span className="text-neutral-400">{formatKRW(d.value)}</span>
            </li>
          ))}
          {byCat.length === 0 && <li className="py-4 text-center text-xs text-neutral-600">데이터 없음</li>}
        </ul>
      </div>

      <div className="card">
        <div className="mb-2 text-sm font-medium text-neutral-300">일별 지출</div>
        <div className="h-52">
          <ResponsiveContainer>
            <BarChart data={byDay}>
              <CartesianGrid stroke="#262626" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: 8 }}
                formatter={(v: number) => formatKRW(v)}
                labelFormatter={(l) => `${month}-${String(l).padStart(2, '0')}`}
              />
              <Bar dataKey="amount" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
