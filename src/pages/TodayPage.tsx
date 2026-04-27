import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { TimeGrid } from '@/components/TimeGrid';
import { EventInspector } from '@/components/EventInspector';
import { TodayCenter } from '@/components/TodayCenter';
import { TodaySidebar } from '@/components/TodaySidebar';
import { ResizeHandle } from '@/components/ResizeHandle';
import { useCategories, useEvents, useNowHHMM, useNowMin } from '@/lib/hooks';
import { apiClient } from '@/lib/api';
import { addDays, formatDateLong, todayISO } from '@/lib/utils';
import {
  getEventClip,
  hasTextSelection,
  isTypingTarget,
  setEventClip,
} from '@/lib/eventClipboard';
import { DAY_END_MIN, DAY_START_MIN, SLOT_MIN } from '@/lib/timeGrid';

const LS_KEY = 'todayLayoutWidths';
const MIN_LEFT = 320;
const MIN_MIDDLE = 200;
const MIN_RIGHT = 180;
const DEFAULT_MIDDLE = 320;
const DEFAULT_RIGHT = 260;

export function TodayPage() {
  const today = todayISO();
  const [params, setParams] = useSearchParams();
  const date = params.get('d') && /^\d{4}-\d{2}-\d{2}$/.test(params.get('d')!) ? params.get('d')! : today;
  const events = useEvents(date);
  const eventCategories = useCategories('event');
  const nowMin = useNowMin();
  const nowText = useNowHHMM();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categoryColor = useMemo(() => {
    const map = new Map(eventCategories.map((c) => [c.id, c.color ?? '#8a8a85']));
    return (id: string | null) => (id ? map.get(id) ?? '#8a8a85' : '#8a8a85');
  }, [eventCategories]);

  const selected = selectedId ? events.events.find((e) => e.id === selectedId) ?? null : null;

  // ── 리사이즈 가능한 가운데/우측 컬럼 폭. 좌측(TimeGrid)은 flex-1로 나머지 차지.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [middleW, setMiddleW] = useState(DEFAULT_MIDDLE);
  const [rightW, setRightW] = useState(DEFAULT_RIGHT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (typeof v?.middle === 'number') setMiddleW(v.middle);
      if (typeof v?.right === 'number') setRightW(v.right);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ middle: middleW, right: rightW }));
    } catch {
      // ignore
    }
  }, [middleW, rightW]);

  function clampLayout(nextMiddle: number, nextRight: number): { m: number; r: number } {
    const total = rowRef.current?.clientWidth ?? 1200;
    const r = Math.max(MIN_RIGHT, nextRight);
    const maxM = Math.max(MIN_MIDDLE, total - MIN_LEFT - r - 4); // 좌측 최소폭 + 우측 + 핸들 폭
    const m = Math.max(MIN_MIDDLE, Math.min(nextMiddle, maxM));
    return { m, r };
  }

  function setDate(iso: string | null) {
    setSelectedId(null);
    if (iso == null || iso === today) {
      const next = new URLSearchParams(params);
      next.delete('d');
      setParams(next);
    } else {
      setParams({ d: iso });
    }
  }

  // 새로 만들거나 옮긴 일정이 우선 — 같은 날짜에서 겹치는 기존 일정을 제거.
  async function evictOverlapping(startMin: number, endMin: number, excludeId?: string) {
    const overlapping = events.events.filter(
      (e) => e.id !== excludeId && e.start_min < endMin && e.end_min > startMin
    );
    if (overlapping.length === 0) return;
    await Promise.all(overlapping.map((e) => events.remove(e.id)));
  }

  // ── 복사·붙여넣기 (Ctrl/Cmd + C / V)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.shiftKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'c') {
        if (hasTextSelection()) return;
        if (!selected) return;
        e.preventDefault();
        setEventClip({
          title: selected.title,
          category: selected.category,
          notes: selected.notes,
          duration_min: selected.end_min - selected.start_min,
        });
      } else if (k === 'v') {
        const clip = getEventClip();
        if (!clip) return;
        e.preventDefault();
        void pasteClip(clip);
      }
    }
    async function pasteClip(clip: NonNullable<ReturnType<typeof getEventClip>>) {
      const dur = clip.duration_min;
      // 시작 위치 결정: 선택된 일정이 있으면 그 끝, 아니면 오늘이면 현재 시각, 아니면 09:00
      let start: number;
      if (selected) {
        start = selected.end_min;
      } else if (date === today) {
        start = Math.round(nowMin / SLOT_MIN) * SLOT_MIN;
      } else {
        start = 9 * 60;
      }
      // 하루 범위로 클램프
      if (start + dur > DAY_END_MIN) start = Math.max(DAY_START_MIN, DAY_END_MIN - dur);
      if (start < DAY_START_MIN) start = DAY_START_MIN;
      const end = Math.min(DAY_END_MIN, start + dur);
      await evictOverlapping(start, end);
      const ev = await events.create({
        date,
        start_min: start,
        end_min: end,
        title: clip.title,
        category: clip.category,
        notes: clip.notes,
      });
      setSelectedId(ev.id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, date, today, nowMin, events]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="오늘"
        subtitle={
          <span className="flex items-baseline gap-2">
            <span>{formatDateLong(date)}</span>
            {date === today && (
              <span className="text-xs tabular-nums" style={{ color: '#d44c47' }}>
                ● {nowText}
              </span>
            )}
          </span>
        }
        right={
          <div className="flex items-center gap-2">
            <button className="text-sub hover:text-ink px-1" onClick={() => setDate(addDays(date, -1))}>
              〈
            </button>
            {date !== today && (
              <button
                className="text-sm border border-line px-2 py-0.5 hover:bg-hover"
                onClick={() => setDate(today)}
              >
                오늘
              </button>
            )}
            <button className="text-sub hover:text-ink px-1" onClick={() => setDate(addDays(date, 1))}>
              〉
            </button>
            {events.error ? (
              <span className="text-xs text-cat-red">오류: {events.error}</span>
            ) : events.loading ? (
              <span className="text-xs text-sub">로딩…</span>
            ) : (
              <span className="text-xs text-sub ml-2">{events.events.length}개 일정</span>
            )}
          </div>
        }
      />
      <div ref={rowRef} className="flex-1 flex min-h-0 min-w-0">
        <section className="flex-1 min-h-0 min-w-0">
          <TimeGrid
            events={events.events}
            categoryColor={categoryColor}
            isToday={date === today}
            nowMin={nowMin}
            selectedId={selectedId}
            onSelect={setSelectedId}
            categories={eventCategories}
            onCreate={async (range, title, categoryId) => {
              await evictOverlapping(range.startMin, range.endMin);
              const ev = await events.create({
                date,
                start_min: range.startMin,
                end_min: range.endMin,
                title,
                category: categoryId,
              });
              setSelectedId(ev.id);
            }}
            onDropTask={async (range, taskId, taskTitle) => {
              await evictOverlapping(range.startMin, range.endMin);
              const ev = await events.create({
                date,
                start_min: range.startMin,
                end_min: range.endMin,
                title: taskTitle,
              });
              await apiClient.updateTask(taskId, { scheduled_date: date }).catch(() => {});
              setSelectedId(ev.id);
            }}
            onMove={async (id, range) => {
              await evictOverlapping(range.startMin, range.endMin, id);
              await events.update(id, { start_min: range.startMin, end_min: range.endMin });
            }}
          />
        </section>

        <ResizeHandle
          onDrag={(dx) => {
            const next = clampLayout(middleW - dx, rightW);
            setMiddleW(next.m);
            setRightW(next.r);
          }}
        />

        <section
          className="border-l border-line flex flex-col min-h-0 min-w-0"
          style={{ width: middleW }}
        >
          {selected ? (
            <EventInspector
              event={selected}
              categories={eventCategories}
              onUpdate={(patch) => events.update(selected.id, patch)}
              onDelete={async () => {
                await events.remove(selected.id);
                setSelectedId(null);
              }}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <TodayCenter date={date} />
          )}
        </section>

        <section
          className="border-l border-line flex flex-col min-h-0 min-w-0"
          style={{ width: rightW }}
        >
          <TodaySidebar
            date={date}
            events={events.events}
            categories={eventCategories}
            nowMin={nowMin}
          />
        </section>
      </div>
    </div>
  );
}
