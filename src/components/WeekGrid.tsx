import { useEffect, useRef, useState } from 'react';
import type { CategoryRow, EventRow } from '@/lib/types';
import { minToHHMM } from '@/lib/utils';
import {
  DAY_END_MIN,
  DAY_START_MIN,
  SLOT_MIN,
  TIME_LABEL_W,
  TOTAL_SLOTS,
  clampMin,
  minToPct,
  pxToMin,
} from '@/lib/timeGrid';

type DraftSelection = { date: string; startMin: number; endMin: number };

type Props = {
  weekDates: string[]; // 7개 ISO 날짜 (월~일)
  events: EventRow[];
  categoryColor: (id: string | null) => string;
  todayISO: string;
  nowMin: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (
    range: DraftSelection,
    title: string,
    categoryId: string | null
  ) => Promise<unknown> | unknown;
  categories: CategoryRow[];
  onMove?: (
    id: string,
    patch: { date: string; start_min: number; end_min: number }
  ) => Promise<unknown> | unknown;
};

export function WeekGrid({
  weekDates,
  events,
  categoryColor,
  todayISO,
  nowMin,
  selectedId,
  onSelect,
  onCreate,
  categories,
  onMove,
}: Props) {
  const colsRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<DraftSelection | null>(null);
  const [draftMode, setDraftMode] = useState<'dragging' | 'modal' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // ── 이벤트 블록 드래그-이동 (요일 + 시간)
  const moveRef = useRef<{
    id: string;
    pointerStartX: number;
    pointerStartY: number;
    originalDateIdx: number;
    originalStart: number;
    duration: number;
    currentDateIdx: number;
    currentStart: number;
    moved: boolean;
    pending: boolean;
  } | null>(null);
  const justMovedRef = useRef(false);
  const [, setMoveTick] = useState(0);

  function startEventDrag(e: React.MouseEvent, ev: EventRow) {
    if (e.button !== 0) return;
    if (!onMove) return;
    const idx = weekDates.indexOf(ev.date);
    if (idx < 0) return;
    e.stopPropagation();
    const m = {
      id: ev.id,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      originalDateIdx: idx,
      originalStart: ev.start_min,
      duration: ev.end_min - ev.start_min,
      currentDateIdx: idx,
      currentStart: ev.start_min,
      moved: false,
      pending: false,
    };
    moveRef.current = m;
    function bump() {
      setMoveTick((t) => t + 1);
    }
    function onWinMove(ev2: MouseEvent) {
      const cur = moveRef.current;
      const g = colsRef.current;
      if (!cur || !g) return;
      const rect = g.getBoundingClientRect();
      const colW = rect.width / 7;
      const dx = ev2.clientX - cur.pointerStartX;
      const dy = ev2.clientY - cur.pointerStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) cur.moved = true;
      const dCol = colW > 0 ? Math.round(dx / colW) : 0;
      cur.currentDateIdx = Math.max(0, Math.min(6, cur.originalDateIdx + dCol));
      const totalMin = DAY_END_MIN - DAY_START_MIN;
      const dMin = (dy / rect.height) * totalMin;
      const snapped = Math.round(dMin / SLOT_MIN) * SLOT_MIN;
      cur.currentStart = Math.max(
        DAY_START_MIN,
        Math.min(DAY_END_MIN - cur.duration, cur.originalStart + snapped)
      );
      bump();
    }
    function onWinUp() {
      window.removeEventListener('mousemove', onWinMove);
      window.removeEventListener('mouseup', onWinUp);
      document.body.style.userSelect = '';
      const cur = moveRef.current;
      if (!cur) return;
      if (cur.moved) {
        justMovedRef.current = true;
        setTimeout(() => {
          justMovedRef.current = false;
        }, 0);
      }
      const moved =
        cur.moved &&
        (cur.currentStart !== cur.originalStart ||
          cur.currentDateIdx !== cur.originalDateIdx);
      if (moved && onMove) {
        cur.pending = true;
        bump();
        Promise.resolve(
          onMove(cur.id, {
            date: weekDates[cur.currentDateIdx],
            start_min: cur.currentStart,
            end_min: cur.currentStart + cur.duration,
          })
        ).finally(() => {
          if (moveRef.current === cur) {
            moveRef.current = null;
            bump();
          }
        });
      } else {
        moveRef.current = null;
        bump();
      }
    }
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onWinMove);
    window.addEventListener('mouseup', onWinUp);
  }

  useEffect(() => {
    if (draftMode === 'modal') {
      setTimeout(() => titleInputRef.current?.focus(), 30);
    }
  }, [draftMode]);

  function handleMouseDown(date: string, e: React.MouseEvent) {
    if (e.button !== 0) return;
    if (draftMode === 'modal') return;
    if ((e.target as HTMLElement).closest('[data-event-block]')) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startMin = clampMin(pxToMin(e.clientY - rect.top, rect.height));
    setDraft({ date, startMin, endMin: Math.min(DAY_END_MIN, startMin + SLOT_MIN) });
    setDraftMode('dragging');
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (draftMode !== 'dragging' || !draft) return;
    const colEl = e.currentTarget as HTMLElement;
    const rect = colEl.getBoundingClientRect();
    const cur = clampMin(pxToMin(e.clientY - rect.top, rect.height) + SLOT_MIN);
    const endMin = Math.max(draft.startMin + SLOT_MIN, cur);
    setDraft({ ...draft, endMin });
  }

  function handleMouseUp() {
    if (draftMode !== 'dragging' || !draft) return;
    setDraftMode('modal');
    setDraftTitle('');
    setDraftCategory(null);
  }

  async function commitDraft() {
    if (!draft || submitting) return;
    const t = draftTitle.trim();
    if (t === '') {
      titleInputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onCreate(draft, t, draftCategory);
      cancelDraft();
    } finally {
      setSubmitting(false);
    }
  }
  function cancelDraft() {
    setDraft(null);
    setDraftMode(null);
    setDraftTitle('');
    setDraftCategory(null);
    setSubmitting(false);
  }

  const moving = moveRef.current;
  const eventsByDate = new Map<string, EventRow[]>();
  for (const ev of events) {
    const effDate =
      moving?.id === ev.id ? weekDates[moving.currentDateIdx] : ev.date;
    const arr = eventsByDate.get(effDate) ?? [];
    arr.push(ev);
    eventsByDate.set(effDate, arr);
  }

  const slotPct = 100 / TOTAL_SLOTS;
  const totalHours = (DAY_END_MIN - DAY_START_MIN) / 60;

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 (요일 + 날짜) */}
      <div className="flex border-b border-line text-sm shrink-0">
        <div
          className="shrink-0 border-r border-line"
          style={{ width: TIME_LABEL_W }}
        />
        <div className="flex-1 grid grid-cols-7">
          {weekDates.map((iso) => {
            const isToday = iso === todayISO;
            const d = new Date(iso + 'T00:00:00');
            const wk = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
            return (
              <div
                key={iso}
                className="px-2 py-1 border-l border-line text-center"
                style={{ background: isToday ? 'var(--c-hover)' : undefined }}
              >
                <div className="text-xs text-sub">{wk}</div>
                <div className="text-base">
                  {d.getDate()}
                  {isToday && <span className="ml-1 inline-block w-1.5 h-1.5 align-middle bg-ink" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* 시간 라벨 컬럼 (1시간 단위 boundary: 06:00 ~ 24:00) */}
        <div
          className="relative shrink-0 border-r border-line text-xs"
          style={{ width: TIME_LABEL_W }}
        >
          {Array.from({ length: totalHours + 1 }, (_, h) => {
            const min = DAY_START_MIN + h * 60;
            const isFirst = h === 0;
            const isLast = h === totalHours;
            return (
              <div
                key={h}
                className="absolute right-0 px-2 text-right text-ink"
                style={{
                  top: `${(h / totalHours) * 100}%`,
                  transform: isFirst
                    ? 'translateY(0)'
                    : isLast
                      ? 'translateY(-100%)'
                      : 'translateY(-50%)',
                  fontWeight: 500,
                }}
              >
                {minToHHMM(min)}
              </div>
            );
          })}
        </div>

        {/* 7일 컬럼 */}
        <div ref={colsRef} className="flex-1 grid grid-cols-7">
          {weekDates.map((iso) => {
            const isToday = iso === todayISO;
            const dayEvents = eventsByDate.get(iso) ?? [];
            return (
              <div
                key={iso}
                className="relative border-l border-line cursor-crosshair h-full"
                style={{ background: isToday ? 'var(--c-panel)' : undefined }}
                onMouseDown={(e) => handleMouseDown(iso, e)}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  if (draftMode === 'dragging') handleMouseUp();
                }}
              >
                {/* 시간 그리드 라인 (정시 실선, 30분 점선) */}
                {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
                  const min = DAY_START_MIN + i * SLOT_MIN;
                  const isHour = min % 60 === 0;
                  return (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-line"
                      style={{
                        top: `${i * slotPct}%`,
                        height: `${slotPct}%`,
                        borderBottomWidth: 1,
                        borderBottomStyle: isHour ? 'solid' : 'dashed',
                      }}
                    />
                  );
                })}

                {/* 이벤트 */}
                {dayEvents.map((ev) => {
                  const isMoving = moving?.id === ev.id;
                  const evStart = isMoving ? moving!.currentStart : ev.start_min;
                  const evEnd = isMoving
                    ? moving!.currentStart + moving!.duration
                    : ev.end_min;
                  const top = minToPct(evStart);
                  const height = minToPct(evEnd) - top;
                  const color = categoryColor(ev.category);
                  const selected = ev.id === selectedId;
                  const draggable = !!onMove;
                  return (
                    <div
                      key={ev.id}
                      data-event-block
                      className={`absolute left-0.5 right-0.5 border bg-bg overflow-hidden hover:bg-hover ${draggable ? 'cursor-move' : 'cursor-pointer'}`}
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        borderColor: selected ? 'var(--c-ink)' : 'var(--c-line)',
                        opacity: isMoving && !moving!.pending ? 0.85 : 1,
                      }}
                      onMouseDown={(e) => {
                        if (draggable) startEventDrag(e, ev);
                        else e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (justMovedRef.current) return;
                        onSelect(ev.id);
                      }}
                    >
                      <div
                        className="absolute top-0 bottom-0 left-0"
                        style={{ width: 3, background: color }}
                      />
                      <div className="pl-1.5 pr-1 py-0.5 text-xs text-ink truncate">
                        {ev.title}
                      </div>
                    </div>
                  );
                })}

                {/* 드래프트 — 영역 표시만 (모달이 입력 담당) */}
                {draft && draft.date === iso && (
                  <div
                    className="absolute left-0.5 right-0.5 border-2 border-dashed bg-hover pointer-events-none"
                    style={{
                      top: `${minToPct(draft.startMin)}%`,
                      height: `${minToPct(draft.endMin) - minToPct(draft.startMin)}%`,
                      borderColor: 'var(--c-ink)',
                    }}
                  >
                    <div className="px-1 py-0.5 text-xs text-sub">
                      {minToHHMM(draft.startMin)}–{minToHHMM(draft.endMin)}
                    </div>
                  </div>
                )}

                {/* 현재 시각 마커 (오늘 컬럼만) */}
                {isToday && nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN && (
                  <div
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{ top: `${minToPct(nowMin)}%` }}
                  >
                    <div className="h-px" style={{ background: '#d44c47' }} />
                    <div
                      className="absolute -left-1 -top-1 w-2 h-2"
                      style={{ background: '#d44c47' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 새 일정 모달 */}
      {draft && draftMode === 'modal' && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancelDraft();
          }}
        >
          <div
            className="bg-bg border border-line w-[420px] max-w-[90vw] text-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelDraft();
              }
            }}
          >
            <div className="border-b border-line px-4 py-2 flex items-center">
              <h2 className="font-medium">새 일정</h2>
              <span className="ml-2 text-xs text-sub tabular-nums">
                {draft.date} {minToHHMM(draft.startMin)}–{minToHHMM(draft.endMin)}
              </span>
              <div className="flex-1" />
              <button className="text-sub hover:text-ink px-1" onClick={cancelDraft}>
                ✕
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <input
                ref={titleInputRef}
                className="w-full border border-line px-2 py-1"
                placeholder="제목"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitDraft();
                  }
                }}
              />
              <select
                className="w-full border border-line px-2 py-1"
                value={draftCategory ?? ''}
                onChange={(e) =>
                  setDraftCategory(e.target.value === '' ? null : e.target.value)
                }
              >
                <option value="">카테고리 (선택)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="border-t border-line px-4 py-2 flex items-center justify-end gap-2">
              <button
                className="border border-line px-3 py-1 hover:bg-hover"
                onClick={cancelDraft}
              >
                취소
              </button>
              <button
                className="border border-line bg-ink text-bg px-3 py-1 hover:opacity-90 disabled:opacity-50"
                onClick={commitDraft}
                disabled={submitting || draftTitle.trim() === ''}
              >
                {submitting ? '저장 중…' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
