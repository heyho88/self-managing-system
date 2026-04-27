import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { useCategories, useEventsRange, useTransactions } from '@/lib/hooks';
import {
  addDays,
  endOfMonth,
  formatKRW,
  fromISO,
  pad2,
  startOfMonth,
  startOfWeekMonday,
  todayISO,
  toISO,
} from '@/lib/utils';

const WEEKDAY = ['월', '화', '수', '목', '금', '토', '일'];

function buildMonthGrid(anchor: string): { weeks: string[][]; monthIdx: number } {
  const first = startOfMonth(anchor);
  const last = endOfMonth(anchor);
  const monthIdx = fromISO(anchor).getMonth();
  const gridStart = startOfWeekMonday(first);
  // 6주 보장 (월간 표준)
  const weeks: string[][] = [];
  let cur = gridStart;
  for (let w = 0; w < 6; w++) {
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(cur);
      cur = addDays(cur, 1);
    }
    weeks.push(row);
    if (w >= 4 && cur > last && weeks.length >= 5) break;
  }
  return { weeks, monthIdx };
}

export function MonthPage() {
  const today = todayISO();
  const [anchor, setAnchor] = useState(today);
  const { weeks, monthIdx } = useMemo(() => buildMonthGrid(anchor), [anchor]);
  const navigate = useNavigate();

  const gridStart = weeks[0][0];
  const gridEnd = weeks[weeks.length - 1][6];
  const range = useEventsRange(gridStart, gridEnd);
  const eventCategories = useCategories('event');

  const categoryColor = useMemo(() => {
    const map = new Map(eventCategories.map((c) => [c.id, c.color ?? '#8a8a85']));
    return (id: string | null) => (id ? map.get(id) ?? '#8a8a85' : '#8a8a85');
  }, [eventCategories]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, typeof range.events>();
    for (const ev of range.events) {
      const arr = m.get(ev.date) ?? [];
      arr.push(ev);
      m.set(ev.date, arr);
    }
    return m;
  }, [range.events]);

  const anchorDate = fromISO(anchor);
  const yearMonth = `${anchorDate.getFullYear()}년 ${pad2(anchorDate.getMonth() + 1)}월`;

  const monthStartIso = startOfMonth(anchor);
  const monthEndIso = endOfMonth(anchor);
  const { transactions } = useTransactions({ from: monthStartIso, to: monthEndIso });

  const monthStats = useMemo(() => {
    const monthEvents = range.events.filter((e) => fromISO(e.date).getMonth() === monthIdx);
    const eventCount = monthEvents.length;
    const focusMin = monthEvents.reduce((s, e) => s + (e.end_min - e.start_min), 0);
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
    }
    return { eventCount, focusMin, income, expense };
  }, [range.events, monthIdx, transactions]);
  const focusH = Math.floor(monthStats.focusMin / 60);
  const focusM = monthStats.focusMin % 60;
  const eventCount = monthStats.eventCount;

  function jumpMonth(delta: number) {
    const d = fromISO(anchor);
    d.setMonth(d.getMonth() + delta);
    d.setDate(1);
    setAnchor(toISO(d));
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="월간"
        subtitle={yearMonth}
        right={
          <div className="flex items-center gap-2">
            <button className="text-sub hover:text-ink px-1" onClick={() => jumpMonth(-1)}>
              〈
            </button>
            <button
              className="text-sm border border-line px-2 py-0.5 hover:bg-hover"
              onClick={() => setAnchor(today)}
            >
              이번달
            </button>
            <button className="text-sub hover:text-ink px-1" onClick={() => jumpMonth(1)}>
              〉
            </button>
            <span className="text-xs text-sub ml-2">이벤트 {eventCount}건</span>
          </div>
        }
      />
      <div className="flex-1 flex flex-col min-h-0">
        {/* 월 통계 줄 */}
        <div className="border-b border-line px-4 py-1.5 flex items-center gap-6 text-xs">
          <span className="text-sub">
            이벤트 <span className="text-ink font-medium font-mono">{eventCount}</span>건
          </span>
          <span className="text-sub">
            집중시간{' '}
            <span className="text-ink font-medium font-mono">
              {focusH}h{focusM > 0 ? ` ${focusM}m` : ''}
            </span>
          </span>
          <span className="text-sub">
            수입{' '}
            <span className="text-ink font-medium font-mono">{formatKRW(monthStats.income)}</span>
          </span>
          <span className="text-sub">
            지출{' '}
            <span className="text-ink font-medium font-mono">{formatKRW(monthStats.expense)}</span>
          </span>
          <span className="text-sub">
            잔액{' '}
            <span
              className="font-medium font-mono"
              style={{ color: monthStats.income - monthStats.expense < 0 ? '#d44c47' : 'var(--c-ink)' }}
            >
              {formatKRW(monthStats.income - monthStats.expense)}
            </span>
          </span>
        </div>
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-line text-sm">
          {WEEKDAY.map((w) => (
            <div
              key={w}
              className="px-2 py-1 border-l border-line first:border-l-0 text-sub text-xs uppercase tracking-wider"
            >
              {w}
            </div>
          ))}
        </div>
        {/* 6주 그리드 */}
        <div
          className="flex-1 grid"
          style={{
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          {weeks.flatMap((row) =>
            row.map((iso) => {
              const d = fromISO(iso);
              const isCurMonth = d.getMonth() === monthIdx;
              const isToday = iso === today;
              const dayEvents = eventsByDate.get(iso) ?? [];
              const visible = dayEvents.slice(0, 3);
              const more = dayEvents.length - visible.length;
              return (
                <button
                  key={iso}
                  className="border-l border-t border-line first:border-l-0 text-left p-1 overflow-hidden hover:bg-hover"
                  style={{
                    background: isToday ? 'var(--c-hover)' : undefined,
                    color: isCurMonth ? 'var(--c-ink)' : 'var(--c-muted)',
                  }}
                  onClick={() => navigate(`/today?d=${iso}`)}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-base font-medium">{d.getDate()}</span>
                    {isToday && <span className="w-1.5 h-1.5 inline-block bg-ink" />}
                  </div>
                  <div className="space-y-0.5">
                    {visible.map((ev) => (
                      <div
                        key={ev.id}
                        className="text-xs truncate flex items-center gap-1"
                        title={ev.title}
                      >
                        <span
                          className="inline-block shrink-0"
                          style={{
                            width: 6,
                            height: 6,
                            background: categoryColor(ev.category),
                          }}
                        />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                    {more > 0 && <div className="text-xs text-sub">+{more} 더보기</div>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
