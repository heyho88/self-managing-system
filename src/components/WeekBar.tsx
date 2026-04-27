import { useMemo, useState } from 'react';
import { useGoals, useTasks } from '@/lib/hooks';
import type { GoalRow, TaskRow } from '@/lib/types';

export function WeekBar({ monIso, sunIso }: { monIso: string; sunIso: string }) {
  const { goals, create: createGoal, update: updateGoal, remove: removeGoal } = useGoals();
  const { tasks, create: createTask, update: updateTask } = useTasks({
    status: 'all',
    from: monIso,
    to: sunIso,
  });

  // 이번 주 목표 (period 겹침)
  const weekGoals = useMemo<GoalRow[]>(
    () =>
      goals.filter(
        (g) => g.type === 'week' && g.period_start <= sunIso && g.period_end >= monIso
      ),
    [goals, monIso, sunIso]
  );
  const slots: (GoalRow | null)[] = [
    weekGoals[0] ?? null,
    weekGoals[1] ?? null,
    weekGoals[2] ?? null,
  ];

  const [draftTask, setDraftTask] = useState('');

  return (
    <div className="border-b border-line grid grid-cols-[320px_1fr] min-h-0">
      {/* 좌: 주 목표 3슬롯 */}
      <div className="border-r border-line">
        <div className="px-3 py-1 border-b border-line text-xs uppercase tracking-wider text-sub">
          주 목표
        </div>
        <ul>
          {slots.map((g, i) =>
            g ? <GoalSlot key={g.id} goal={g} onUpdate={updateGoal} onRemove={removeGoal} /> : (
              <li key={i} className="flex items-center gap-2 px-3 py-1 text-xs text-sub h-7">
                <span className="w-3 text-center">{i + 1}.</span>
                <button
                  className="text-left text-sub hover:text-ink"
                  onClick={async () => {
                    const t = prompt('주 목표');
                    if (!t?.trim()) return;
                    await createGoal({
                      title: t.trim(),
                      type: 'week',
                      period_start: monIso,
                      period_end: sunIso,
                    });
                  }}
                >
                  + 추가
                </button>
              </li>
            )
          )}
        </ul>
      </div>

      {/* 우: 주 할일 띠 */}
      <div className="flex flex-col min-h-0">
        <div className="px-3 py-1 border-b border-line text-xs uppercase tracking-wider text-sub flex items-center">
          주 할일
          <span className="ml-2 text-sub">
            ({tasks.filter((t) => !t.done).length}/{tasks.length})
          </span>
        </div>
        <div className="flex-1 overflow-x-auto whitespace-nowrap px-2 py-1 flex gap-2 items-center text-xs">
          {tasks.length === 0 ? (
            <span className="text-sub px-1">없음</span>
          ) : (
            tasks.map((t) => <TaskChip key={t.id} task={t} onUpdate={updateTask} />)
          )}
          <input
            className="border border-line px-2 py-0.5 w-44 shrink-0"
            placeholder="+ 새 할일 (Enter)"
            value={draftTask}
            onChange={(e) => setDraftTask(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && draftTask.trim()) {
                e.preventDefault();
                await createTask({ title: draftTask.trim(), scheduled_date: monIso });
                setDraftTask('');
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function GoalSlot({
  goal,
  onUpdate,
  onRemove,
}: {
  goal: GoalRow;
  onUpdate: (id: string, patch: Partial<Omit<GoalRow, 'id'>>) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
}) {
  const pct = Math.max(0, Math.min(100, goal.progress));
  return (
    <li className="flex items-center gap-2 px-3 py-1 text-xs h-7 group hover:bg-hover">
      <span className="flex-1 truncate">{goal.title}</span>
      <div className="w-16 h-1 bg-line shrink-0">
        <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
      <input
        type="number"
        min={0}
        max={100}
        defaultValue={goal.progress}
        className="w-10 text-right font-mono border border-line px-1 py-0 text-xs"
        onBlur={async (e) => {
          const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
          if (v !== goal.progress) await onUpdate(goal.id, { progress: v });
        }}
      />
      <button
        className="opacity-0 group-hover:opacity-100 text-cat-red text-xs"
        onClick={() => {
          if (confirm(`'${goal.title}' 목표를 삭제하시겠습니까?`)) onRemove(goal.id);
        }}
      >
        ✕
      </button>
    </li>
  );
}

function TaskChip({
  task,
  onUpdate,
}: {
  task: TaskRow;
  onUpdate: (id: string, patch: Partial<Omit<TaskRow, 'id' | 'created_at'>>) => Promise<unknown>;
}) {
  return (
    <button
      className="border border-line px-1.5 py-0.5 hover:bg-hover shrink-0 flex items-center gap-1"
      onClick={() => onUpdate(task.id, { done: task.done ? 0 : 1 })}
      title={task.scheduled_date ?? ''}
    >
      <span className="w-3 h-3 border border-line inline-flex items-center justify-center text-[10px] leading-none">
        {task.done ? '✓' : ''}
      </span>
      <span className={task.done ? 'line-through text-sub' : ''}>{task.title}</span>
    </button>
  );
}
