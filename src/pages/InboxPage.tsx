import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useTasks } from '@/lib/hooks';
import { apiClient } from '@/lib/api';
import type { GoalRow, TaskRow } from '@/lib/types';
import { addDays, todayISO } from '@/lib/utils';

type Filter = 'all' | 'today' | 'week' | 'open' | 'done';

const FILTER_LABEL: Record<Filter, string> = {
  all: '전체',
  today: '오늘',
  week: '이번주',
  open: '미완료',
  done: '완료',
};

function priorityMark(p: number): string {
  if (p >= 3) return '!!!';
  if (p === 2) return '!!';
  if (p === 1) return '!';
  return '';
}

function priorityColor(p: number): string {
  if (p >= 3) return '#d44c47';
  if (p === 2) return '#d98e3f';
  if (p === 1) return '#c9b443';
  return 'var(--c-muted)';
}

export function InboxPage() {
  const today = todayISO();
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState<string>('');

  const filterParams =
    filter === 'today'
      ? { status: 'open' as const, scheduled: today }
      : filter === 'week'
      ? { status: 'open' as const, from: today, to: addDays(today, 6) }
      : filter === 'done'
      ? { status: 'done' as const }
      : filter === 'open'
      ? { status: 'open' as const }
      : { status: 'all' as const };

  const { tasks, loading, error, create, update, remove } = useTasks(filterParams);
  const visible = tasks;

  const [goals, setGoals] = useState<GoalRow[]>([]);
  useEffect(() => {
    let alive = true;
    apiClient.listGoals().then((g) => alive && setGoals(g)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  async function addTask() {
    const t = draft.trim();
    if (!t) return;
    await create({ title: t });
    setDraft('');
  }

  async function cycle(p: number) {
    return ((p ?? 0) + 1) % 4;
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="할일"
        subtitle={`인박스 (${visible.length})`}
        right={
          loading ? (
            <span className="text-xs text-sub">로딩…</span>
          ) : error ? (
            <span className="text-xs text-cat-red">오류: {error}</span>
          ) : null
        }
      />

      {/* 필터 탭 */}
      <div className="border-b border-line px-4 py-1 flex gap-1 text-sm">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
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
          </button>
        ))}
      </div>

      {/* 입력 행 */}
      <div className="border-b border-line px-4 py-2 flex gap-2 text-sm">
        <input
          className="flex-1"
          placeholder="새 할일 — Enter로 추가"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTask();
            }
          }}
        />
        <button className="border border-line px-3 hover:bg-hover" onClick={addTask}>
          + 추가
        </button>
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-auto">
        {visible.length === 0 ? (
          <div className="px-4 py-6 text-sm text-sub">
            <div className="border border-dashed border-line px-4 py-6">할일 없음</div>
          </div>
        ) : (
          <ul>
            {visible.map((t) => (
              <TaskRowItem
                key={t.id}
                task={t}
                today={today}
                goal={t.goal_id ? goalById.get(t.goal_id) ?? null : null}
                onToggle={() => update(t.id, { done: t.done ? 0 : 1 })}
                onCyclePriority={async () => update(t.id, { priority: await cycle(t.priority) })}
                onTitleChange={(title) => update(t.id, { title })}
                onScheduleToday={() => update(t.id, { scheduled_date: today })}
                onScheduleTomorrow={() => update(t.id, { scheduled_date: addDays(today, 1) })}
                onUnschedule={() => update(t.id, { scheduled_date: null })}
                onDelete={() => remove(t.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TaskRowItem({
  task,
  today,
  goal,
  onToggle,
  onCyclePriority,
  onTitleChange,
  onScheduleToday,
  onScheduleTomorrow,
  onUnschedule,
  onDelete,
}: {
  task: TaskRow;
  today: string;
  goal: GoalRow | null;
  onToggle: () => void;
  onCyclePriority: () => void;
  onTitleChange: (title: string) => void;
  onScheduleToday: () => void;
  onScheduleTomorrow: () => void;
  onUnschedule: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const scheduled = task.scheduled_date;
  const scheduledLabel = !scheduled
    ? '미할당'
    : scheduled === today
    ? '오늘'
    : scheduled === addDays(today, 1)
    ? '내일'
    : scheduled.replace(/^\d{4}-/, '');

  return (
    <li
      className="group flex items-center gap-2 px-4 py-1.5 border-b border-line text-sm hover:bg-hover"
      draggable={!editing && !task.done}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-task-id', task.id);
        e.dataTransfer.setData('application/x-task-title', task.title);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <button
        className="w-[18px] h-[18px] shrink-0 flex items-center justify-center hover:bg-hover text-xs leading-none font-bold"
        style={{ border: '2px solid var(--c-ink)' }}
        onClick={onToggle}
        title="완료 토글"
      >
        {task.done ? '✓' : ''}
      </button>
      <button
        className="w-6 text-center font-mono text-xs shrink-0"
        onClick={onCyclePriority}
        style={{ color: priorityColor(task.priority) }}
        title="우선순위 (클릭 순환)"
      >
        {priorityMark(task.priority) || '·'}
      </button>
      {editing ? (
        <input
          autoFocus
          className="flex-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const v = draft.trim();
            if (v && v !== task.title) onTitleChange(v);
            else setDraft(task.title);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            else if (e.key === 'Escape') {
              setDraft(task.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          className={`flex-1 text-left truncate ${task.done ? 'line-through text-sub' : ''}`}
          onClick={() => setEditing(true)}
        >
          {task.title}
        </button>
      )}
      {goal && (
        <span
          className="text-xs text-sub shrink-0 px-1.5 border border-line truncate max-w-[120px]"
          title={`목표: ${goal.title}`}
        >
          {goal.title}
        </span>
      )}
      {task.due_date && task.due_date !== task.scheduled_date && (
        <span className="text-xs text-cat-orange shrink-0 font-mono" title="마감">
          ▸{task.due_date.slice(5).replace('-', '.')}
        </span>
      )}
      <span className="text-xs text-sub shrink-0 w-16 text-right">{scheduledLabel}</span>
      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
        {scheduled !== today && (
          <button
            className="text-xs border border-line px-1.5 py-0.5 hover:bg-bg"
            onClick={onScheduleToday}
          >
            오늘
          </button>
        )}
        {scheduled !== addDays(today, 1) && (
          <button
            className="text-xs border border-line px-1.5 py-0.5 hover:bg-bg"
            onClick={onScheduleTomorrow}
          >
            내일
          </button>
        )}
        {scheduled && (
          <button
            className="text-xs border border-line px-1.5 py-0.5 hover:bg-bg"
            onClick={onUnschedule}
          >
            해제
          </button>
        )}
        <button
          className="text-xs border border-line px-1.5 py-0.5 hover:bg-bg text-cat-red"
          onClick={onDelete}
        >
          ✕
        </button>
      </div>
    </li>
  );
}
