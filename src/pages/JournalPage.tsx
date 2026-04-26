import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Journal } from '../lib/api';
import { todayKey } from '../lib/utils';

const MOODS = ['😄', '🙂', '😐', '😕', '😩'];

export function JournalPage() {
  const [date, setDate] = useState(todayKey());
  const qc = useQueryClient();

  const j = useQuery({
    queryKey: ['journal', date],
    queryFn: () => api.get<Journal | null>(`/api/journals/${date}`),
  });

  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string>('');

  useEffect(() => {
    setContent(j.data?.content ?? '');
    setMood(j.data?.mood ?? '');
  }, [j.data, date]);

  const save = useMutation({
    mutationFn: () => api.put(`/api/journals/${date}`, { content, mood: mood || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal', date] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <input type="date" className="input max-w-[180px]" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex gap-1">
          {MOODS.map((m) => (
            <button
              key={m}
              className={`text-xl transition ${mood === m ? 'opacity-100' : 'opacity-30 hover:opacity-70'}`}
              onClick={() => setMood(mood === m ? '' : m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <textarea
        className="input min-h-[200px]"
        placeholder="오늘 어땠나요? 한 줄도 좋고 길게 써도 좋아요."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button className="btn-primary w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? '저장 중...' : '저장'}
      </button>
    </div>
  );
}
