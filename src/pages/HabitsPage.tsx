import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Habit, type HabitLog } from '../lib/api';
import { todayKey } from '../lib/utils';

const DAYS = 14;

export function HabitsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');

  const today = new Date();
  const dates = useMemo(() => {
    const arr: string[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(todayKey(d));
    }
    return arr;
  }, []);
  const from = dates[0];
  const to = dates[dates.length - 1];

  const habits = useQuery({
    queryKey: ['habits'],
    queryFn: () => api.get<Habit[]>('/api/habits'),
  });
  const logs = useQuery({
    queryKey: ['habit-logs', from, to],
    queryFn: () => api.get<HabitLog[]>(`/api/habit-logs?from=${from}&to=${to}`),
  });

  const logSet = useMemo(() => {
    const s = new Set<string>();
    (logs.data ?? []).forEach((l) => s.add(`${l.habitId}:${l.date}`));
    return s;
  }, [logs.data]);

  const add = useMutation({
    mutationFn: () => api.post('/api/habits', { name, emoji: emoji || null }),
    onSuccess: () => {
      setName('');
      setEmoji('');
      qc.invalidateQueries({ queryKey: ['habits'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/habits/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
  const toggle = useMutation({
    mutationFn: ({ habitId, date, on }: { habitId: number; date: string; on: boolean }) =>
      on
        ? api.post('/api/habit-logs', { habitId, date })
        : api.del(`/api/habit-logs?habitId=${habitId}&date=${date}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habit-logs'] }),
  });

  function streak(habitId: number) {
    let s = 0;
    for (let i = dates.length - 1; i >= 0; i--) {
      if (logSet.has(`${habitId}:${dates[i]}`)) s++;
      else break;
    }
    return s;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-2 text-sm font-medium text-neutral-300">새 습관</div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            add.mutate();
          }}
        >
          <input
            className="input max-w-[60px] text-center"
            placeholder="🏃"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
          />
          <input
            className="input"
            placeholder="습관 이름 (예: 30분 운동)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-primary">추가</button>
        </form>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-neutral-500">
              <th className="sticky left-0 z-10 bg-neutral-900 px-3 py-2 text-left font-normal">습관</th>
              {dates.map((d) => (
                <th key={d} className="px-1 py-2 font-normal">
                  {d.slice(8)}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-normal">연속</th>
            </tr>
          </thead>
          <tbody>
            {(habits.data ?? []).map((h) => (
              <tr key={h.id} className="border-t border-neutral-900">
                <td className="sticky left-0 z-10 bg-neutral-950 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {h.emoji && <span>{h.emoji}</span>}
                    <span className="text-sm">{h.name}</span>
                    <button
                      className="ml-1 text-neutral-700 hover:text-red-400"
                      onClick={() => remove.mutate(h.id)}
                      title="삭제"
                    >
                      ×
                    </button>
                  </div>
                </td>
                {dates.map((d) => {
                  const on = logSet.has(`${h.id}:${d}`);
                  return (
                    <td key={d} className="px-0.5 py-1 text-center">
                      <button
                        className={`h-6 w-6 rounded ${
                          on ? 'bg-emerald-500' : 'bg-neutral-800 hover:bg-neutral-700'
                        }`}
                        onClick={() => toggle.mutate({ habitId: h.id, date: d, on: !on })}
                        aria-label={d}
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right text-sm text-emerald-400">{streak(h.id)}일</td>
              </tr>
            ))}
            {(habits.data ?? []).length === 0 && (
              <tr>
                <td colSpan={DAYS + 2} className="py-12 text-center text-xs text-neutral-600">
                  습관을 추가해보세요
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
