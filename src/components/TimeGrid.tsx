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

type DraftSelection = { startMin: number; endMin: number };

type Props = {
  events: EventRow[];
  categoryColor: (id: string | null) => string;
  isToday: boolean;
  nowMin: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (
    range: DraftSelection,
    title: string,
    categoryId: string | null
  ) => Promise<unknown> | unknown;
  categories: CategoryRow[];
  onDropTask?: (range: DraftSelection, taskId: string, taskTitle: string) => Promise<unknown> | unknown;
  onMove?: (id: string, range: DraftSelection) => Promise<unknown> | unknown;
};

export function TimeGrid({
  events,
  categoryColor,
  isToday,
  nowMin,
  selectedId,
  onSelect,
  onCreate,
  categories,
  onDropTask,
  onMove,
}: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<DraftSelection | null>(null);
  const [draftMode, setDraftMode] = useState<'dragging' | 'modal' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dropPreview, setDropPreview] = useState<DraftSelection | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // ── 이벤트 블록 이동 (드래그)
  const moveRef = useRef<{
    id: string;
    pointerStartY: number;
    originalStart: number;
    duration: number;
    currentStart: number;
    moved: boolean;
    pending: boolean;
  } | null>(null);
  const justMovedRef = useRef(false);
  const [, setMoveTick] = useState(0);

  function startEventDrag(e: React.MouseEvent, ev: EventRow) {
    if (e.button !== 0) return;
    if (!onMove) return;
    e.stopPropagation();
    const m = {
      id: ev.id,
      pointerStartY: e.clientY,
      originalStart: ev.start_min,
      duration: ev.end_min - ev.start_min,
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
      const r = bodyRef.current?.getBoundingClientRect();
      if (!cur || !r) return;
      const dy = ev2.clientY - cur.pointerStartY;
      if (Math.abs(dy) > 4) cur.moved = true;
      const totalMin = DAY_END_MIN - DAY_START_MIN;
      const dMin = (dy / r.height) * totalMin;
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
      const moved = cur.moved && cur.currentStart !== cur.originalStart;
      if (moved && onMove) {
        cur.pending = true;
        bump();
        Promise.resolve(
          onMove(cur.id, { startMin: cur.currentStart, endMin: cur.currentStart + cur.duration })
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

  function pxFromEvent(e: React.MouseEvent): { px: number; height: number } {
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return { px: 0, height: 0 };
    return { px: e.clientY - rect.top, height: rect.height };
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    if (draftMode === 'modal') return;
    if ((e.target as HTMLElement).closest('[data-event-block]')) return;
    const { px, height } = pxFromEvent(e);
    const startMin = clampMin(pxToMin(px, height));
    setDraft({ startMin, endMin: Math.min(DAY_END_MIN, startMin + SLOT_MIN) });
    setDraftMode('dragging');
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (draftMode !== 'dragging' || !draft) return;
    const { px, height } = pxFromEvent(e);
    const cur = clampMin(pxToMin(px, height) + SLOT_MIN);
    const endMin = Math.max(draft.startMin + SLOT_MIN, cur);
    setDraft({ startMin: draft.startMin, endMin });
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

  const slotPct = 100 / TOTAL_SLOTS;
  const totalHours = (DAY_END_MIN - DAY_START_MIN) / 60;

  return (
    <div className="relative h-full select-none flex">
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

      {/* 이벤트 본문 영역 */}
      <div
        ref={bodyRef}
        className="relative flex-1 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (draftMode === 'dragging') handleMouseUp();
        }}
        onDragOver={(e) => {
          if (!onDropTask) return;
          if (!Array.from(e.dataTransfer.types).includes('application/x-task-id')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          const rect = bodyRef.current?.getBoundingClientRect();
          if (!rect) return;
          const startMin = clampMin(pxToMin(e.clientY - rect.top, rect.height));
          setDropPreview({ startMin, endMin: Math.min(DAY_END_MIN, startMin + 60) });
        }}
        onDragLeave={() => setDropPreview(null)}
        onDrop={async (e) => {
          if (!onDropTask) return;
          const taskId = e.dataTransfer.getData('application/x-task-id');
          const taskTitle = e.dataTransfer.getData('application/x-task-title');
          if (!taskId || !taskTitle) return;
          e.preventDefault();
          const rect = bodyRef.current?.getBoundingClientRect();
          if (!rect) return;
          const startMin = clampMin(pxToMin(e.clientY - rect.top, rect.height));
          const range = { startMin, endMin: Math.min(DAY_END_MIN, startMin + 60) };
          setDropPreview(null);
          await onDropTask(range, taskId, taskTitle);
        }}
      >
        {/* 30분 그리드 라인 (정시 실선, 30분 점선) */}
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

        {/* 이벤트 블록 */}
        {events.map((ev) => {
          const m = moveRef.current;
          const isMoving = m?.id === ev.id;
          const evStart = isMoving ? m!.currentStart : ev.start_min;
          const evEnd = isMoving ? m!.currentStart + m!.duration : ev.end_min;
          const top = minToPct(evStart);
          const height = minToPct(evEnd) - top;
          const color = categoryColor(ev.category);
          const selected = ev.id === selectedId;
          const draggable = !!onMove;
          return (
            <div
              key={ev.id}
              data-event-block
              className={`absolute left-0.5 right-1 border bg-bg overflow-hidden hover:bg-hover ${draggable ? 'cursor-move' : 'cursor-pointer'}`}
              style={{
                top: `${top}%`,
                height: `${height}%`,
                borderColor: selected ? 'var(--c-ink)' : 'var(--c-line)',
                opacity: isMoving && !m!.pending ? 0.85 : 1,
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
                style={{ width: 4, background: color }}
              />
              <div className="pl-2 pr-1 py-0.5 text-xs text-ink truncate">
                <span className="font-medium">{ev.title}</span>
                <span className="text-sub ml-1">
                  {minToHHMM(evStart)}–{minToHHMM(evEnd)}
                </span>
              </div>
            </div>
          );
        })}

        {/* 드롭 프리뷰 — 인박스에서 드래그 중 */}
        {dropPreview && (
          <div
            className="absolute left-0.5 right-1 border-2 border-dashed bg-hover pointer-events-none"
            style={{
              top: `${minToPct(dropPreview.startMin)}%`,
              height: `${minToPct(dropPreview.endMin) - minToPct(dropPreview.startMin)}%`,
              borderColor: '#5a8f5a',
            }}
          >
            <div className="px-2 py-0.5 text-xs" style={{ color: '#5a8f5a' }}>
              {minToHHMM(dropPreview.startMin)}–{minToHHMM(dropPreview.endMin)} · 할일 추가
            </div>
          </div>
        )}

        {/* 드래프트 — 드래그 중이거나 모달이 열려있을 때 그리드 위에 영역 표시만 */}
        {draft && (
          <div
            className="absolute left-0.5 right-1 border-2 border-dashed bg-hover pointer-events-none"
            style={{
              top: `${minToPct(draft.startMin)}%`,
              height: `${minToPct(draft.endMin) - minToPct(draft.startMin)}%`,
              borderColor: 'var(--c-ink)',
            }}
          >
            <div className="px-2 py-0.5 text-xs text-sub">
              {minToHHMM(draft.startMin)}–{minToHHMM(draft.endMin)}
            </div>
          </div>
        )}

        {/* 현재 시각 마커 */}
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
                {minToHHMM(draft.startMin)}–{minToHHMM(draft.endMin)}
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
