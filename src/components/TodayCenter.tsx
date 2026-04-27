import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useTasks } from '@/lib/hooks';
import type { CategoryRow, GoalRow, TaskRow, TransactionRow } from '@/lib/types';

function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR');
}

export function TodayCenter({ date }: { date: string }) {
  const { tasks, create, update, remove } = useTasks({ status: 'all', scheduled: date });

  // TOP3: priority 2 이상에서 우선순위 desc → 생성순. done으로는 재정렬하지 않음
  // (체크 시 슬롯 위치가 바뀌지 않도록).
  const top = [...tasks]
    .filter((t) => t.priority >= 2)
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.created_at - b.created_at;
    })
    .slice(0, 3);
  const others = tasks.filter((t) => !top.some((x) => x.id === t.id));
  const topSlots: (TaskRow | null)[] = [top[0] ?? null, top[1] ?? null, top[2] ?? null];

  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [topModalOpen, setTopModalOpen] = useState(false);
  const [topTitle, setTopTitle] = useState('');
  const [topSubmitting, setTopSubmitting] = useState(false);
  const topInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (topModalOpen) {
      setTimeout(() => topInputRef.current?.focus(), 30);
    }
  }, [topModalOpen]);

  function openTopModal() {
    setTopTitle('');
    setTopSubmitting(false);
    setTopModalOpen(true);
  }
  function closeTopModal() {
    setTopModalOpen(false);
    setTopTitle('');
    setTopSubmitting(false);
  }
  async function submitTop() {
    const t = topTitle.trim();
    if (!t || topSubmitting) {
      topInputRef.current?.focus();
      return;
    }
    setTopSubmitting(true);
    try {
      await create({ title: t, scheduled_date: date, priority: 3 });
      closeTopModal();
    } finally {
      setTopSubmitting(false);
    }
  }

  return (
    <>
      {/* TOP 3 */}
      <div className="border-b border-line px-3 py-2 text-xs uppercase tracking-wider text-sub">
        TOP 3
      </div>
      <ul className="border-b border-line">
        {topSlots.map((t, i) =>
          t ? (
            <li key={t.id} className="flex items-center gap-2 px-3 py-1 text-sm group hover:bg-hover">
              <button
                className="w-[18px] h-[18px] shrink-0 flex items-center justify-center hover:bg-hover text-xs leading-none font-bold"
                style={{ border: '2px solid var(--c-ink)' }}
                onClick={() => update(t.id, { done: t.done ? 0 : 1 })}
                title="완료 토글"
              >
                {t.done ? '✓' : ''}
              </button>
              <EditableTitle
                value={t.title}
                done={!!t.done}
                editing={editingId === t.id}
                onSave={async (next) => {
                  await update(t.id, { title: next });
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
              <button
                className="opacity-0 group-hover:opacity-100 text-sub hover:text-ink text-xs px-1"
                onClick={() => setEditingId(t.id)}
                title="제목 수정"
              >
                ✎
              </button>
              <button
                className="opacity-0 group-hover:opacity-100 text-sub hover:text-ink text-xs px-1"
                onClick={() => update(t.id, { priority: 0 })}
                title="TOP3에서 내리기 (일반 할일로)"
              >
                ↓
              </button>
              <button
                className="opacity-0 group-hover:opacity-100 text-cat-red text-xs px-1"
                onClick={() => remove(t.id)}
                title="삭제"
              >
                ✕
              </button>
            </li>
          ) : (
            <li key={i} className="flex items-center gap-2 px-3 py-1 text-sm text-sub">
              <span
                className="w-[18px] h-[18px] shrink-0"
                style={{ border: '2px solid var(--c-line)' }}
              />
              <button
                className="text-left text-sub hover:text-ink"
                onClick={openTopModal}
              >
                + 추가
              </button>
            </li>
          )
        )}
      </ul>

      {/* TOP3 추가 모달 */}
      {topModalOpen && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeTopModal();
          }}
        >
          <div
            className="bg-bg border border-line w-[420px] max-w-[90vw] text-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                closeTopModal();
              }
            }}
          >
            <div className="border-b border-line px-4 py-2 flex items-center">
              <h2 className="font-medium">TOP 3 추가</h2>
              <span className="ml-2 text-xs text-sub tabular-nums">{date}</span>
              <div className="flex-1" />
              <button className="text-sub hover:text-ink px-1" onClick={closeTopModal}>
                ✕
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <input
                ref={topInputRef}
                className="w-full border border-line px-2 py-1"
                placeholder="할일 제목"
                value={topTitle}
                onChange={(e) => setTopTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitTop();
                  }
                }}
              />
              <div className="text-xs text-sub">
                우선순위 <span className="font-mono text-cat-red">!!!</span> 로 등록되어 TOP 3 슬롯에 표시됩니다.
              </div>
            </div>
            <div className="border-t border-line px-4 py-2 flex items-center justify-end gap-2">
              <button
                className="border border-line px-3 py-1 hover:bg-hover"
                onClick={closeTopModal}
              >
                취소
              </button>
              <button
                className="border border-line bg-ink text-bg px-3 py-1 hover:opacity-90 disabled:opacity-50"
                onClick={submitTop}
                disabled={topSubmitting || topTitle.trim() === ''}
              >
                {topSubmitting ? '저장 중…' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 할일 */}
      <div className="border-b border-line px-3 py-2 text-xs uppercase tracking-wider text-sub flex items-center">
        할일
        <span className="text-sub ml-2">({others.filter((t) => !t.done).length}/{others.length})</span>
      </div>
      <ul className="flex-1 overflow-auto">
        {others.length === 0 ? (
          <li className="px-3 py-2 text-sm text-sub">없음</li>
        ) : (
          others.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 px-3 py-1 text-sm group hover:bg-hover border-b border-line"
            >
              <button
                className="w-[18px] h-[18px] shrink-0 flex items-center justify-center hover:bg-hover text-xs leading-none font-bold"
                style={{ border: '2px solid var(--c-ink)' }}
                onClick={() => update(t.id, { done: t.done ? 0 : 1 })}
                title="완료 토글"
              >
                {t.done ? '✓' : ''}
              </button>
              <span
                className="w-4 text-center font-mono text-xs shrink-0"
                style={{
                  color: t.priority >= 3 ? '#d44c47' : t.priority === 2 ? '#d98e3f' : t.priority === 1 ? '#c9b443' : 'var(--c-muted)',
                }}
              >
                {t.priority >= 3 ? '!!!' : t.priority === 2 ? '!!' : t.priority === 1 ? '!' : '·'}
              </span>
              <EditableTitle
                value={t.title}
                done={!!t.done}
                editing={editingId === t.id}
                onSave={async (next) => {
                  await update(t.id, { title: next });
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
              <button
                className="opacity-0 group-hover:opacity-100 text-sub hover:text-ink text-xs px-1"
                onClick={() => setEditingId(t.id)}
                title="제목 수정"
              >
                ✎
              </button>
              <button
                className="opacity-0 group-hover:opacity-100 text-cat-red text-xs px-1"
                onClick={() => remove(t.id)}
                title="삭제"
              >
                ✕
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="border-t border-line px-3 py-1.5 flex gap-1 text-sm">
        <input
          className="flex-1"
          placeholder="+ 새 할일 (Enter)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault();
              await create({ title: draft.trim(), scheduled_date: date });
              setDraft('');
            }
          }}
        />
      </div>

      <DailySummary date={date} />
    </>
  );
}

function EditableTitle({
  value,
  done,
  editing,
  onSave,
  onCancel,
}: {
  value: string;
  done: boolean;
  editing: boolean;
  onSave: (next: string) => Promise<unknown> | unknown;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [editing, value]);

  async function commit() {
    const next = draft.trim();
    if (!next || next === value) {
      onCancel();
      return;
    }
    await onSave(next);
  }

  if (!editing) {
    return (
      <span className={`flex-1 truncate ${done ? 'line-through text-sub' : ''}`}>
        {value}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      className="flex-1 min-w-0 bg-bg border border-line px-1 text-sm"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

function DailySummary({ date }: { date: string }) {
  const [tx, setTx] = useState<TransactionRow[]>([]);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiClient.listTransactions({ from: date, to: date }),
      apiClient.listCategories('expense'),
      apiClient.listGoals(),
    ])
      .then(([t, c, g]) => {
        if (!alive) return;
        setTx(t);
        setCats(c);
        setGoals(g);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      alive = false;
    };
  }, [date]);

  const expenses = tx.filter((t) => t.type === 'expense');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  const catMap = new Map(cats.map((c) => [c.id, c]));
  const byCat = new Map<string, number>();
  for (const t of expenses) {
    const k = t.category_id ?? '';
    byCat.set(k, (byCat.get(k) ?? 0) + t.amount);
  }
  const top3 = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const activeGoals = goals
    .filter((g) => g.period_start <= date && date <= g.period_end)
    .sort((a, b) => {
      const order = { year: 0, quarter: 1, month: 2, week: 3 } as const;
      return order[a.type] - order[b.type];
    })
    .slice(0, 3);

  return (
    <>
      {/* 오늘 가계부 */}
      <div className="border-t border-line px-3 py-2 text-xs uppercase tracking-wider text-sub">
        오늘 가계부
      </div>
      <div className="px-3 py-2 text-sm space-y-1">
        <div className="flex items-center gap-2 tabular-nums">
          <span className="text-sub w-10 text-xs">지출</span>
          <span className="font-medium">₩{formatKRW(totalExp)}</span>
          {totalInc > 0 && (
            <>
              <span className="text-sub text-xs ml-auto">수입</span>
              <span className="text-xs">+₩{formatKRW(totalInc)}</span>
            </>
          )}
        </div>
        {top3.length === 0 ? (
          <div className="text-xs text-sub">거래 없음</div>
        ) : (
          top3.map(([cid, amt]) => {
            const c = catMap.get(cid);
            return (
              <div key={cid || 'none'} className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block shrink-0"
                  style={{ width: 8, height: 4, background: c?.color ?? '#8a8a85' }}
                />
                <span className="text-sub flex-1 truncate">{c?.name ?? '미분류'}</span>
                <span className="tabular-nums">₩{formatKRW(amt)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* 활성 목표 */}
      <div className="border-t border-line px-3 py-2 text-xs uppercase tracking-wider text-sub">
        활성 목표
      </div>
      <div className="px-3 py-2 text-sm space-y-2">
        {activeGoals.length === 0 ? (
          <div className="text-xs text-sub">활성 목표 없음</div>
        ) : (
          activeGoals.map((g) => {
            const p = Math.max(0, Math.min(100, g.progress));
            return (
              <div key={g.id}>
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="truncate">{g.title}</span>
                  <span className="tabular-nums text-sub shrink-0">{p}%</span>
                </div>
                <div className="h-1 border border-line">
                  <div className="h-full bg-ink" style={{ width: `${p}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
