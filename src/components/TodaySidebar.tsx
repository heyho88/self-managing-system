import { useEffect, useMemo, useState } from 'react';
import type { CategoryRow, EventRow, TaskRow } from '@/lib/types';
import { apiClient } from '@/lib/api';
import { addDays, minToHHMM, todayISO } from '@/lib/utils';

type Props = {
  date: string;
  events: EventRow[];
  categories: CategoryRow[];
  nowMin: number;
};

export function TodaySidebar({ date, events, categories, nowMin }: Props) {
  const isToday = date === todayISO();
  const yIso = addDays(date, -1);

  // ── 어제 미완료 캐리오버
  const [carry, setCarry] = useState<TaskRow[]>([]);
  const [carryBusy, setCarryBusy] = useState(false);

  async function reloadCarry() {
    try {
      const list = await apiClient.listTasks({ scheduled: yIso, status: 'open' });
      setCarry(list);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    reloadCarry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yIso]);

  async function moveAllToToday() {
    if (carry.length === 0 || carryBusy) return;
    setCarryBusy(true);
    try {
      await Promise.all(
        carry.map((t) => apiClient.updateTask(t.id, { scheduled_date: date }).catch(() => null))
      );
      setCarry([]);
    } finally {
      setCarryBusy(false);
    }
  }

  // ── 다음 일정
  const nextEvent = useMemo(() => {
    if (!isToday) return null;
    const upcoming = events
      .filter((e) => e.start_min > nowMin)
      .sort((a, b) => a.start_min - b.start_min);
    return upcoming[0] ?? null;
  }, [events, nowMin, isToday]);

  const minsUntilNext = nextEvent ? Math.max(0, Math.round(nextEvent.start_min - nowMin)) : null;

  // ── 진행 중 일정
  const ongoingEvent = useMemo(() => {
    if (!isToday) return null;
    return events.find((e) => e.start_min <= nowMin && e.end_min > nowMin) ?? null;
  }, [events, nowMin, isToday]);

  // ── 시간 사용 (카테고리별 합)
  const totalPlanned = events.reduce((s, e) => s + (e.end_min - e.start_min), 0);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      const key = e.category ?? '__none__';
      m.set(key, (m.get(key) ?? 0) + (e.end_min - e.start_min));
    }
    return Array.from(m.entries())
      .map(([id, mins]) => {
        const cat = id === '__none__' ? null : categories.find((c) => c.id === id) ?? null;
        return {
          id,
          name: cat?.name ?? '미분류',
          color: cat?.color ?? '#8a8a85',
          mins,
        };
      })
      .sort((a, b) => b.mins - a.mins);
  }, [events, categories]);

  const dayMinutes = 18 * 60; // 06:00–24:00 가시 범위
  const freeMin = Math.max(0, dayMinutes - totalPlanned);

  return (
    <div className="flex flex-col h-full text-sm overflow-y-auto">
      {/* 진행 중 / 다음 일정 */}
      <div className="border-b border-line px-3 py-2 text-xs uppercase tracking-wider text-sub">
        다음 일정
      </div>
      <div className="px-3 py-2 border-b border-line">
        {!isToday ? (
          <div className="text-sub text-xs">오늘이 아닌 날짜</div>
        ) : ongoingEvent ? (
          <div className="space-y-1">
            <div className="text-xs text-sub">진행 중</div>
            <div className="flex items-baseline gap-2">
              <span className="font-medium truncate">{ongoingEvent.title}</span>
              <span className="text-xs text-sub tabular-nums">
                ~{minToHHMM(ongoingEvent.end_min)}
              </span>
            </div>
            {nextEvent && (
              <div className="text-xs text-sub">
                다음: {minToHHMM(nextEvent.start_min)} {nextEvent.title}
              </div>
            )}
          </div>
        ) : nextEvent ? (
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums font-medium">{minToHHMM(nextEvent.start_min)}</span>
              <span className="truncate">{nextEvent.title}</span>
            </div>
            <div className="text-xs text-sub">
              {minsUntilNext != null
                ? minsUntilNext < 60
                  ? `${minsUntilNext}분 후`
                  : `${Math.floor(minsUntilNext / 60)}시간 ${minsUntilNext % 60}분 후`
                : ''}
            </div>
          </div>
        ) : (
          <div className="text-sub text-xs">남은 일정 없음</div>
        )}
      </div>

      {/* 캐리오버 */}
      <div className="border-b border-line px-3 py-2 text-xs uppercase tracking-wider text-sub flex items-center">
        어제 미완료
        <span className="ml-auto normal-case tracking-normal">
          {carry.length > 0 ? `${carry.length}개` : '없음'}
        </span>
      </div>
      {carry.length > 0 && (
        <div className="border-b border-line">
          <ul>
            {carry.slice(0, 5).map((t) => (
              <li key={t.id} className="px-3 py-1 text-sm truncate text-sub">
                · {t.title}
              </li>
            ))}
            {carry.length > 5 && (
              <li className="px-3 py-1 text-xs text-sub">+ {carry.length - 5}개 더</li>
            )}
          </ul>
          <div className="px-3 py-1.5 flex">
            <button
              className="border border-line bg-ink text-bg px-2 py-0.5 text-xs hover:opacity-90 disabled:opacity-50"
              disabled={carryBusy}
              onClick={moveAllToToday}
            >
              {carryBusy ? '옮기는 중…' : '전부 오늘로 옮기기'}
            </button>
          </div>
        </div>
      )}

      {/* 시간 사용 */}
      <div className="border-b border-line px-3 py-2 text-xs uppercase tracking-wider text-sub flex items-center">
        시간 사용
        <span className="ml-auto normal-case tracking-normal text-sub">
          {fmtHours(totalPlanned)} / {fmtHours(dayMinutes)}
        </span>
      </div>
      <div className="px-3 py-2 space-y-2">
        {/* 누적 막대 */}
        <div className="flex h-2 border border-line">
          {byCat.map((c) => (
            <div
              key={c.id}
              title={`${c.name} ${fmtHours(c.mins)}`}
              style={{
                width: `${(c.mins / dayMinutes) * 100}%`,
                background: c.color,
              }}
            />
          ))}
          {freeMin > 0 && (
            <div
              title={`빈 시간 ${fmtHours(freeMin)}`}
              style={{ width: `${(freeMin / dayMinutes) * 100}%` }}
            />
          )}
        </div>
        {/* 카테고리 리스트 */}
        <ul className="space-y-0.5">
          {byCat.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 inline-block" style={{ background: c.color }} />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="tabular-nums text-sub">{fmtHours(c.mins)}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 inline-block border border-line" />
            <span className="flex-1 truncate text-sub">빈 시간</span>
            <span className="tabular-nums text-sub">{fmtHours(freeMin)}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function fmtHours(min: number): string {
  if (min <= 0) return '0h';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}
