import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Goal } from '../lib/api';
import { isoWeekKey, monthKey } from '../lib/utils';

export function GoalsPage() {
  const [tab, setTab] = useState<'week' | 'month'>('week');
  const periodKey = tab === 'week' ? isoWeekKey() : monthKey();

  const qc = useQueryClient();
  const goals = useQuery({
    queryKey: ['goals', tab, periodKey],
    queryFn: () => api.get<Goal[]>(`/api/goals?period=${tab}&periodKey=${periodKey}`),
  });

  const [title, setTitle] = useState('');
  const add = useMutation({
    mutationFn: () => api.post('/api/goals', { period: tab, periodKey, title }),
    onSuccess: () => {
      setTitle('');
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
  const toggle = useMutation({
    mutationFn: (g: Goal) => api.patch(`/api/goals/${g.id}`, { done: !g.done }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/goals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });

  const list = goals.data ?? [];
  const done = list.filter((g) => g.done).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-neutral-800">
          {(['week', 'month'] as const).map((t) => (
            <button
              key={t}
              className={`px-3 py-1 text-sm ${tab === t ? 'bg-neutral-100 text-black' : 'text-neutral-400'}`}
              onClick={() => setTab(t)}
            >
              {t === 'week' ? '주간' : '월간'}
            </button>
          ))}
        </div>
        <div className="text-xs text-neutral-500">
          {periodKey} · {done}/{list.length}
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          add.mutate();
        }}
      >
        <input
          className="input"
          placeholder={tab === 'week' ? '이번 주에 꼭 해낼 것' : '이번 달의 목표'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn-primary">추가</button>
      </form>

      <ul className="space-y-1">
        {list.map((g) => (
          <li key={g.id} className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-neutral-900">
            <button
              className={`h-5 w-5 shrink-0 rounded-md border ${
                g.done ? 'border-emerald-500 bg-emerald-500' : 'border-neutral-700'
              }`}
              onClick={() => toggle.mutate(g)}
            >
              {g.done && <span className="block text-center text-xs leading-5 text-black">✓</span>}
            </button>
            <span className={`flex-1 text-sm ${g.done ? 'text-neutral-600 line-through' : ''}`}>{g.title}</span>
            <button
              className="text-xs text-neutral-600 opacity-0 transition group-hover:opacity-100"
              onClick={() => remove.mutate(g.id)}
            >
              삭제
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-12 text-center text-xs text-neutral-600">목표를 추가해보세요</li>}
      </ul>
    </div>
  );
}
