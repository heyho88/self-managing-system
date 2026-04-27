import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { useGoals } from '@/lib/hooks';
import { apiClient } from '@/lib/api';
import type { GoalRow, TaskRow } from '@/lib/types';
import { addDays, endOfMonth, fromISO, startOfMonth, todayISO, toISO } from '@/lib/utils';

const TYPE_LABEL: Record<GoalRow['type'], string> = {
  year: '연',
  quarter: '분기',
  month: '월',
  week: '주',
};

const TYPE_ORDER: GoalRow['type'][] = ['year', 'quarter', 'month', 'week'];

type Filter = 'active' | 'upcoming' | 'past' | 'all';
const FILTER_LABEL: Record<Filter, string> = {
  active: '활성',
  upcoming: '예정',
  past: '지난',
  all: '전체',
};

function defaultPeriod(type: GoalRow['type'], anchorISO?: string): { period_start: string; period_end: string } {
  const today = anchorISO ?? todayISO();
  const d = fromISO(today);
  if (type === 'year') {
    return {
      period_start: `${d.getFullYear()}-01-01`,
      period_end: `${d.getFullYear()}-12-31`,
    };
  }
  if (type === 'quarter') {
    const q = Math.floor(d.getMonth() / 3);
    const sm = q * 3;
    const start = new Date(d.getFullYear(), sm, 1);
    const end = new Date(d.getFullYear(), sm + 3, 0);
    return { period_start: toISO(start), period_end: toISO(end) };
  }
  if (type === 'month') {
    return { period_start: startOfMonth(today), period_end: endOfMonth(today) };
  }
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const start = fromISO(today);
  start.setDate(start.getDate() + diff);
  return { period_start: toISO(start), period_end: addDays(toISO(start), 6) };
}

function formatPeriod(g: GoalRow): string {
  if (g.type === 'year') return g.period_start.slice(0, 4);
  if (g.type === 'quarter') {
    const m = parseInt(g.period_start.slice(5, 7), 10);
    return `${g.period_start.slice(0, 4)} Q${Math.floor((m - 1) / 3) + 1}`;
  }
  if (g.type === 'month') return `${g.period_start.slice(0, 4)}.${g.period_start.slice(5, 7)}`;
  return `${g.period_start.slice(5).replace('-', '.')} ~ ${g.period_end.slice(5).replace('-', '.')}`;
}

function statusOf(g: GoalRow, today: string): 'active' | 'upcoming' | 'past' {
  if (today < g.period_start) return 'upcoming';
  if (today > g.period_end) return 'past';
  return 'active';
}

function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}

function periodHint(g: GoalRow, today: string): string {
  const s = statusOf(g, today);
  if (s === 'upcoming') return `D-${daysBetween(today, g.period_start)}`;
  if (s === 'past') return `+${daysBetween(g.period_end, today)}일 지남`;
  // active: 진행률(시간 기준) 함께
  const total = daysBetween(g.period_start, g.period_end) + 1;
  const passed = daysBetween(g.period_start, today) + 1;
  const left = total - passed;
  return `${left}일 남음`;
}

export function GoalsPage() {
  const today = todayISO();
  const { goals, loading, error, create, update, remove, reload } = useGoals();
  const [filter, setFilter] = useState<Filter>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ title: string; type: GoalRow['type']; parent_id: string | null }>({
    title: '',
    type: 'month',
    parent_id: null,
  });

  const filtered = useMemo(() => {
    if (filter === 'all') return goals;
    return goals.filter((g) => statusOf(g, today) === filter);
  }, [goals, filter, today]);

  // 연도별 그룹 → 타입 순서 → 시작일 desc
  const byYear = useMemo(() => {
    const map = new Map<string, GoalRow[]>();
    for (const g of filtered) {
      const y = g.period_start.slice(0, 4);
      const arr = map.get(y) ?? [];
      arr.push(g);
      map.set(y, arr);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const oa = TYPE_ORDER.indexOf(a.type);
        const ob = TYPE_ORDER.indexOf(b.type);
        if (oa !== ob) return oa - ob;
        return b.period_start.localeCompare(a.period_start);
      });
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const childrenMap = useMemo(() => {
    const m = new Map<string, GoalRow[]>();
    for (const g of goals) {
      if (!g.parent_id) continue;
      const arr = m.get(g.parent_id) ?? [];
      arr.push(g);
      m.set(g.parent_id, arr);
    }
    return m;
  }, [goals]);

  const selected = selectedId ? goals.find((g) => g.id === selectedId) ?? null : null;

  const stats = useMemo(() => {
    const active = goals.filter((g) => statusOf(g, today) === 'active');
    const completed = goals.filter((g) => g.progress >= 100);
    const avg = active.length
      ? Math.round(active.reduce((s, g) => s + g.progress, 0) / active.length)
      : 0;
    return { total: goals.length, active: active.length, completed: completed.length, avg };
  }, [goals, today]);

  async function handleAdd() {
    const t = draft.title.trim();
    if (!t) return;
    const period = defaultPeriod(draft.type);
    const created = await create({
      title: t,
      type: draft.type,
      period_start: period.period_start,
      period_end: period.period_end,
      parent_id: draft.parent_id,
    });
    setDraft({ title: '', type: 'month', parent_id: null });
    setAdding(false);
    if (created?.id) setSelectedId(created.id);
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="목표"
        subtitle="연 / 분기 / 월 / 주"
        right={
          <div className="flex items-center gap-2">
            {error ? (
              <span className="text-xs text-cat-red">오류: {error}</span>
            ) : loading ? (
              <span className="text-xs text-sub">로딩…</span>
            ) : null}
            <button
              className="text-sm border border-line bg-ink text-bg px-2 py-0.5 hover:opacity-90"
              onClick={() => setAdding((v) => !v)}
            >
              {adding ? '취소' : '+ 목표'}
            </button>
          </div>
        }
      />

      {/* 통계 바 */}
      <div className="border-b border-line px-4 py-2 flex items-center gap-6 text-xs tabular-nums">
        <Stat label="전체" value={String(stats.total)} />
        <Stat label="활성" value={String(stats.active)} />
        <Stat label="완료" value={String(stats.completed)} />
        <Stat label="활성 평균" value={`${stats.avg}%`} />
        <div className="flex-1" />
      </div>

      {/* 추가 바 */}
      {adding && (
        <div className="border-b border-line px-4 py-2 flex gap-2 text-sm items-center">
          <select
            className="border border-line px-2 py-1"
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as GoalRow['type'] }))}
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <select
            className="border border-line px-2 py-1 max-w-[160px]"
            value={draft.parent_id ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, parent_id: e.target.value || null }))}
            title="상위 목표"
          >
            <option value="">상위 없음</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                [{TYPE_LABEL[g.type]}] {g.title}
              </option>
            ))}
          </select>
          <input
            autoFocus
            className="border border-line px-2 py-1 flex-1"
            placeholder="목표 제목"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="border border-line px-3 py-1 hover:bg-hover bg-ink text-bg" onClick={handleAdd}>
            추가
          </button>
        </div>
      )}

      {/* 필터 탭 */}
      <div className="border-b border-line px-4 py-1 flex gap-1 text-sm">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => {
          const count =
            f === 'all' ? goals.length : goals.filter((g) => statusOf(g, today) === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-2 py-0.5 hover:bg-hover"
              style={{
                background: filter === f ? 'var(--c-hover)' : undefined,
                fontWeight: filter === f ? 500 : 400,
                borderBottom: filter === f ? '2px solid var(--c-ink)' : '2px solid transparent',
              }}
            >
              {FILTER_LABEL[f]}
              <span className="text-sub text-xs ml-1">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 본문 */}
      <div className="flex-1 flex min-h-0">
        <section className="flex-1 overflow-auto min-w-0">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-sub">
              <div className="border border-dashed border-line px-4 py-6">
                {filter === 'all'
                  ? '목표 없음 — 우측 상단 [+ 목표]로 시작'
                  : `${FILTER_LABEL[filter]} 목표 없음`}
              </div>
            </div>
          ) : (
            <ul>
              {byYear.map(([year, items]) => (
                <li key={year}>
                  <div className="bg-panel border-b border-line px-4 py-1 text-xs uppercase tracking-wider text-sub">
                    {year}
                    <span className="ml-2 text-sub">({items.length})</span>
                  </div>
                  <ul>
                    {items.map((g) => (
                      <GoalListRow
                        key={g.id}
                        goal={g}
                        today={today}
                        active={selectedId === g.id}
                        childCount={(childrenMap.get(g.id) ?? []).length}
                        onSelect={() => setSelectedId(g.id)}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="w-[420px] shrink-0 border-l border-line overflow-auto min-w-0 flex flex-col">
          {selected ? (
            <GoalDetail
              key={selected.id}
              goal={selected}
              allGoals={goals}
              subgoals={childrenMap.get(selected.id) ?? []}
              today={today}
              onUpdate={update}
              onDelete={async (id) => {
                await remove(id);
                if (selectedId === id) setSelectedId(null);
              }}
              onSelectGoal={setSelectedId}
              onAddChild={async (title, type) => {
                const period = defaultPeriod(type);
                const c = await create({
                  title,
                  type,
                  period_start: period.period_start,
                  period_end: period.period_end,
                  parent_id: selected.id,
                });
                if (c?.id) setSelectedId(c.id);
              }}
              onReload={reload}
            />
          ) : (
            <SummaryPanel goals={goals} today={today} onSelect={setSelectedId} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sub uppercase tracking-wider">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function GoalListRow({
  goal,
  today,
  active,
  childCount,
  onSelect,
}: {
  goal: GoalRow;
  today: string;
  active: boolean;
  childCount: number;
  onSelect: () => void;
}) {
  const status = statusOf(goal, today);
  const statusColor =
    status === 'active' ? 'var(--c-ink)' : status === 'upcoming' ? '#c9b443' : 'var(--c-muted)';
  const linked = goal.linked_tasks;
  const done = goal.progress >= 100;
  return (
    <li>
      <button
        className="w-full text-left border-b border-line px-4 py-2 flex items-center gap-3 text-sm hover:bg-hover"
        style={{ background: active ? 'var(--c-hover)' : undefined }}
        onClick={onSelect}
      >
        <span
          className="text-xs uppercase tracking-wider w-10 shrink-0 font-mono"
          style={{ color: statusColor }}
          title={status}
        >
          {TYPE_LABEL[goal.type]}
        </span>
        <span className={`flex-1 truncate ${done ? 'line-through text-sub' : ''}`}>
          {goal.title}
        </span>
        {childCount > 0 && (
          <span className="text-xs text-sub shrink-0" title={`하위 ${childCount}개`}>
            ⌄{childCount}
          </span>
        )}
        {linked && linked.total > 0 && (
          <span className="text-xs text-sub shrink-0 font-mono">
            {linked.done}/{linked.total}
          </span>
        )}
        <span className="text-xs text-sub w-28 text-right shrink-0 font-mono">
          {formatPeriod(goal)}
        </span>
        <div className="w-24 shrink-0 flex items-center gap-2">
          <div className="flex-1 h-1.5 border border-line">
            <div className="h-full bg-ink" style={{ width: `${goal.progress}%` }} />
          </div>
          <span className="text-xs text-sub w-8 font-mono text-right">{goal.progress}%</span>
        </div>
        <span className="text-xs text-sub w-20 text-right shrink-0">
          {periodHint(goal, today)}
        </span>
      </button>
    </li>
  );
}

function GoalDetail({
  goal,
  allGoals,
  subgoals,
  today,
  onUpdate,
  onDelete,
  onSelectGoal,
  onAddChild,
  onReload,
}: {
  goal: GoalRow;
  allGoals: GoalRow[];
  subgoals: GoalRow[];
  today: string;
  onUpdate: (id: string, patch: Partial<Omit<GoalRow, 'id'>>) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
  onSelectGoal: (id: string | null) => void;
  onAddChild: (title: string, type: GoalRow['type']) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [title, setTitle] = useState(goal.title);
  const [notes, setNotes] = useState(goal.notes ?? '');
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [childDraft, setChildDraft] = useState('');
  const [childType, setChildType] = useState<GoalRow['type']>('month');
  const navigate = useNavigate();

  useEffect(() => {
    setTitle(goal.title);
  }, [goal.id, goal.title]);
  useEffect(() => {
    setNotes(goal.notes ?? '');
  }, [goal.id, goal.notes]);

  // 노트 디바운스 저장
  useEffect(() => {
    if ((goal.notes ?? '') === notes) return;
    const t = setTimeout(() => {
      void onUpdate(goal.id, { notes: notes.trim() === '' ? null : notes });
    }, 500);
    return () => clearTimeout(t);
  }, [notes, goal.id, goal.notes, onUpdate]);

  // 연결된 할일 로드
  useEffect(() => {
    let alive = true;
    setTasksLoading(true);
    apiClient
      .listTasks({ status: 'all', goal: goal.id })
      .then((rows) => {
        if (alive) setTasks(rows);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (alive) setTasksLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [goal.id, goal.linked_tasks?.total, goal.linked_tasks?.done]);

  async function commitTitle() {
    const v = title.trim();
    if (v && v !== goal.title) {
      await onUpdate(goal.id, { title: v });
    } else {
      setTitle(goal.title);
    }
  }

  async function applyTypePeriod(nextType: GoalRow['type']) {
    const p = defaultPeriod(nextType);
    await onUpdate(goal.id, { type: nextType, period_start: p.period_start, period_end: p.period_end });
  }

  async function setProgress(p: number) {
    await onUpdate(goal.id, { progress: Math.max(0, Math.min(100, Math.round(p))) });
  }

  async function toggleDone() {
    await onUpdate(goal.id, { progress: goal.progress >= 100 ? 0 : 100 });
  }

  async function addChild() {
    const v = childDraft.trim();
    if (!v) return;
    await onAddChild(v, childType);
    setChildDraft('');
  }

  const status = statusOf(goal, today);
  const statusLabel = status === 'active' ? '진행 중' : status === 'upcoming' ? '예정' : '지남';
  const linked = goal.linked_tasks;
  const linkedAuto = !!(linked && linked.total > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-line px-4 py-2 flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-sub">{TYPE_LABEL[goal.type]}</span>
        <span className="text-xs text-sub">·</span>
        <span className="text-xs text-sub">{statusLabel}</span>
        <div className="flex-1" />
        <button className="text-sub hover:text-ink px-1 text-xs" onClick={() => onSelectGoal(null)} title="닫기">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* 제목 */}
        <div className="px-4 py-3 border-b border-line">
          <input
            className="w-full text-base border border-line px-2 py-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setTitle(goal.title);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </div>

        {/* 진행률 */}
        <div className="px-4 py-3 border-b border-line space-y-2">
          <div className="flex items-center justify-between text-xs text-sub uppercase tracking-wider">
            <span>진행률</span>
            <button
              className="text-xs border border-line px-1.5 py-0.5 hover:bg-hover normal-case"
              onClick={toggleDone}
              title="100% / 0% 토글"
            >
              {goal.progress >= 100 ? '미완료로' : '완료로'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 border border-line">
              <div className="h-full bg-ink" style={{ width: `${goal.progress}%` }} />
            </div>
            <span className="text-sm font-mono w-12 text-right">{goal.progress}%</span>
          </div>
          {linkedAuto ? (
            <div className="text-xs text-sub">
              할일 자동 진행률 — {linked!.done}/{linked!.total} 완료
            </div>
          ) : (
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={goal.progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full"
            />
          )}
        </div>

        {/* 기간 */}
        <div className="px-4 py-3 border-b border-line space-y-2">
          <div className="text-xs text-sub uppercase tracking-wider">기간</div>
          <div className="flex items-center gap-2 text-sm">
            <select
              className="border border-line px-2 py-1"
              value={goal.type}
              onChange={(e) => applyTypePeriod(e.target.value as GoalRow['type'])}
              title="유형 변경 시 기간 자동 적용"
            >
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <span className="text-sub text-xs">{periodHint(goal, today)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              className="border border-line px-2 py-1 flex-1"
              value={goal.period_start}
              onChange={(e) => onUpdate(goal.id, { period_start: e.target.value })}
            />
            <span className="text-sub">~</span>
            <input
              type="date"
              className="border border-line px-2 py-1 flex-1"
              value={goal.period_end}
              onChange={(e) => onUpdate(goal.id, { period_end: e.target.value })}
            />
          </div>
        </div>

        {/* 상위 목표 */}
        <div className="px-4 py-3 border-b border-line space-y-2">
          <div className="text-xs text-sub uppercase tracking-wider">상위 목표</div>
          <select
            className="border border-line px-2 py-1 w-full text-sm"
            value={goal.parent_id ?? ''}
            onChange={(e) => onUpdate(goal.id, { parent_id: e.target.value || null })}
          >
            <option value="">— 없음 (최상위) —</option>
            {allGoals
              .filter((g) => g.id !== goal.id)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  [{TYPE_LABEL[g.type]}] {g.title}
                </option>
              ))}
          </select>
        </div>

        {/* 메모 */}
        <div className="px-4 py-3 border-b border-line space-y-2">
          <div className="text-xs text-sub uppercase tracking-wider">메모</div>
          <textarea
            className="w-full border border-line px-2 py-1 text-sm"
            rows={4}
            placeholder="배경 / 측정 기준 / 계획…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* 하위 목표 */}
        <div className="px-4 py-3 border-b border-line space-y-2">
          <div className="text-xs text-sub uppercase tracking-wider flex items-center">
            하위 목표
            <span className="text-sub ml-2 normal-case">({subgoals.length})</span>
          </div>
          {subgoals.length > 0 && (
            <ul className="space-y-1">
              {subgoals.map((c) => (
                <li key={c.id}>
                  <button
                    className="w-full text-left flex items-center gap-2 text-xs hover:bg-hover px-2 py-1 border border-line"
                    onClick={() => onSelectGoal(c.id)}
                  >
                    <span className="text-sub uppercase tracking-wider w-8 shrink-0">
                      {TYPE_LABEL[c.type]}
                    </span>
                    <span className="flex-1 truncate">{c.title}</span>
                    <span className="text-sub font-mono shrink-0">{c.progress}%</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-1 text-sm">
            <select
              className="border border-line px-2 py-1 text-xs"
              value={childType}
              onChange={(e) => setChildType(e.target.value as GoalRow['type'])}
            >
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <input
              className="border border-line px-2 py-1 flex-1 text-xs"
              placeholder="+ 하위 목표"
              value={childDraft}
              onChange={(e) => setChildDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addChild();
                }
              }}
            />
          </div>
        </div>

        {/* 연결된 할일 */}
        <div className="px-4 py-3 border-b border-line space-y-2">
          <div className="text-xs text-sub uppercase tracking-wider flex items-center">
            연결된 할일
            <span className="text-sub ml-2 normal-case">
              ({tasks.filter((t) => t.done).length}/{tasks.length})
            </span>
            <div className="flex-1" />
            {tasksLoading && <span className="text-sub normal-case">로딩…</span>}
          </div>
          {tasks.length === 0 ? (
            <div className="text-xs text-sub border border-dashed border-line px-3 py-2">
              연결된 할일 없음 — 인박스에서 할일을 이 목표에 연결할 수 있습니다
            </div>
          ) : (
            <ul className="space-y-1">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2 text-xs border border-line px-2 py-1 hover:bg-hover"
                >
                  <button
                    className="w-[14px] h-[14px] shrink-0 flex items-center justify-center text-[10px] leading-none font-bold"
                    style={{ border: '2px solid var(--c-ink)' }}
                    onClick={async () => {
                      await apiClient.updateTask(t.id, { done: t.done ? 0 : 1 });
                      const refreshed = await apiClient.listTasks({ status: 'all', goal: goal.id });
                      setTasks(refreshed);
                      void onReload();
                    }}
                    title="완료 토글"
                  >
                    {t.done ? '✓' : ''}
                  </button>
                  <span className={`flex-1 truncate ${t.done ? 'line-through text-sub' : ''}`}>
                    {t.title}
                  </span>
                  {t.scheduled_date && (
                    <span className="text-sub font-mono shrink-0">
                      {t.scheduled_date.slice(5).replace('-', '.')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button
            className="text-xs text-sub hover:text-ink"
            onClick={() => navigate('/inbox')}
            title="인박스에서 할일 연결"
          >
            인박스로 이동 →
          </button>
        </div>

        {/* 위험 영역 */}
        <div className="px-4 py-3 flex items-center justify-end">
          <button
            className="text-xs border border-line px-2 py-0.5 text-cat-red hover:bg-hover"
            onClick={() => {
              if (confirm(`'${goal.title}' 목표를 삭제하시겠습니까?\n하위 목표는 최상위로 이동되고, 연결된 할일의 목표는 비워집니다.`))
                onDelete(goal.id);
            }}
          >
            목표 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryPanel({
  goals,
  today,
  onSelect,
}: {
  goals: GoalRow[];
  today: string;
  onSelect: (id: string) => void;
}) {
  const active = goals
    .filter((g) => statusOf(g, today) === 'active')
    .sort((a, b) => {
      const oa = TYPE_ORDER.indexOf(a.type);
      const ob = TYPE_ORDER.indexOf(b.type);
      if (oa !== ob) return oa - ob;
      return b.progress - a.progress;
    });
  const upcoming = goals
    .filter((g) => statusOf(g, today) === 'upcoming')
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .slice(0, 5);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b border-line px-4 py-2 text-xs uppercase tracking-wider text-sub">
        요약 — 좌측에서 목표를 선택해 상세 편집
      </div>

      <div className="px-4 py-3 border-b border-line space-y-2">
        <div className="text-xs uppercase tracking-wider text-sub">진행 중</div>
        {active.length === 0 ? (
          <div className="text-xs text-sub">진행 중인 목표 없음</div>
        ) : (
          <ul className="space-y-1.5">
            {active.map((g) => (
              <li key={g.id}>
                <button
                  className="w-full text-left flex items-center gap-2 hover:bg-hover px-2 py-1.5 border border-line"
                  onClick={() => onSelect(g.id)}
                >
                  <span className="text-xs uppercase tracking-wider text-sub w-8 shrink-0">
                    {TYPE_LABEL[g.type]}
                  </span>
                  <span className="flex-1 truncate text-sm">{g.title}</span>
                  <div className="w-16 h-1.5 border border-line shrink-0">
                    <div className="h-full bg-ink" style={{ width: `${g.progress}%` }} />
                  </div>
                  <span className="text-xs text-sub w-8 text-right font-mono">{g.progress}%</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-4 py-3 border-b border-line space-y-2">
        <div className="text-xs uppercase tracking-wider text-sub">예정</div>
        {upcoming.length === 0 ? (
          <div className="text-xs text-sub">예정된 목표 없음</div>
        ) : (
          <ul className="space-y-1">
            {upcoming.map((g) => (
              <li key={g.id}>
                <button
                  className="w-full text-left flex items-center gap-2 text-xs hover:bg-hover px-2 py-1 border border-line"
                  onClick={() => onSelect(g.id)}
                >
                  <span className="uppercase tracking-wider text-sub w-8 shrink-0">
                    {TYPE_LABEL[g.type]}
                  </span>
                  <span className="flex-1 truncate">{g.title}</span>
                  <span className="text-sub shrink-0 font-mono">
                    D-{daysBetween(today, g.period_start)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
