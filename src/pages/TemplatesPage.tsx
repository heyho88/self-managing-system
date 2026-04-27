import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { apiClient } from '@/lib/api';
import {
  DAY_END_MIN,
  DAY_START_MIN,
  SLOT_MIN,
  TIME_LABEL_W,
  TOTAL_SLOTS,
  clampMin,
  minToPct,
  pxToMin as gridPxToMin,
} from '@/lib/timeGrid';
import { useCategories } from '@/lib/hooks';
import type { CategoryRow, EventRow, WeeklyTemplate, WeeklyTemplateBlock } from '@/lib/types';
import { addDays, minToHHMM, startOfWeekMonday, todayISO } from '@/lib/utils';

type Conflict = {
  weekday: number;
  blockTitle: string;
  blockStart: number;
  blockEnd: number;
  events: EventRow[];
};

const WEEKDAY = ['월', '화', '수', '목', '금', '토', '일'];

export function TemplatesPage() {
  const [templates, setTemplates] = useState<WeeklyTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<WeeklyTemplateBlock[]>([]);
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const eventCategories = useCategories('event');

  useEffect(() => {
    setSelectedBlockIds(new Set());
  }, [selectedId]);

  function toggleBlockSelection(id: string) {
    setSelectedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllBlocks() {
    setSelectedBlockIds(new Set(blocks.map((b) => b.id)));
  }
  function clearBlockSelection() {
    setSelectedBlockIds(new Set());
  }
  async function removeSelectedBlocks() {
    const ids = Array.from(selectedBlockIds);
    if (ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}개 블록을 삭제하시겠습니까?`)) return;
    await Promise.all(ids.map((id) => apiClient.deleteTemplateBlock(id)));
    setBlocks((prev) => prev.filter((b) => !selectedBlockIds.has(b.id)));
    clearBlockSelection();
  }

  async function reloadTemplates() {
    try {
      const list = await apiClient.listTemplates();
      setTemplates(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    reloadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setBlocks([]);
      return;
    }
    let alive = true;
    apiClient
      .listTemplateBlocks(selectedId)
      .then((list) => alive && setBlocks(list))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [selectedId]);

  async function newTemplate() {
    const name = prompt('템플릿 이름');
    if (!name?.trim()) return;
    const t = await apiClient.createTemplate({ name: name.trim() });
    setTemplates((prev) => [t, ...prev]);
    setSelectedId(t.id);
  }

  async function renameTemplate(t: WeeklyTemplate) {
    const next = prompt('템플릿 이름', t.name);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === t.name) return;
    try {
      const updated = await apiClient.updateTemplate(t.id, { name: trimmed });
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  const [previewWeek, setPreviewWeek] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [previewBusy, setPreviewBusy] = useState(false);

  async function startPreview() {
    if (!selectedId) return;
    const def = startOfWeekMonday(todayISO());
    const ws = prompt('적용할 주의 월요일 (YYYY-MM-DD)', def);
    if (!ws || !/^\d{4}-\d{2}-\d{2}$/.test(ws)) return;
    setPreviewBusy(true);
    try {
      const sun = addDays(ws, 6);
      const events = await apiClient.listEvents(ws, sun);
      const list: Conflict[] = [];
      for (const b of blocks) {
        const dayIso = addDays(ws, b.weekday);
        const overlaps = events.filter(
          (e) => e.date === dayIso && e.start_min < b.end_min && e.end_min > b.start_min
        );
        if (overlaps.length > 0) {
          list.push({
            weekday: b.weekday,
            blockTitle: b.title,
            blockStart: b.start_min,
            blockEnd: b.end_min,
            events: overlaps,
          });
        }
      }
      setConflicts(list);
      setPreviewWeek(ws);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewBusy(false);
    }
  }

  async function confirmApply() {
    if (!selectedId || !previewWeek) return;
    setPreviewBusy(true);
    try {
      const r = await apiClient.applyTemplate(selectedId, previewWeek);
      setPreviewWeek(null);
      setConflicts([]);
      alert(`${r.applied}건 적용됨`);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewBusy(false);
    }
  }

  async function setDefault(t: WeeklyTemplate) {
    await apiClient.updateTemplate(t.id, { is_default: t.is_default ? 0 : 1 });
    reloadTemplates();
  }

  async function removeTemplate(t: WeeklyTemplate) {
    if (!confirm(`'${t.name}' 템플릿과 모든 블록을 삭제하시겠습니까?`)) return;
    await apiClient.deleteTemplate(t.id);
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    if (selectedId === t.id) setSelectedId(null);
  }

  async function addBlock(
    weekday: number,
    start_min: number,
    end_min: number,
    title: string,
    category: string | null,
    is_fixed: boolean
  ) {
    if (!selectedId) return;
    const b = await apiClient.createTemplateBlock(selectedId, {
      weekday,
      start_min,
      end_min,
      title,
      category,
      is_fixed,
    });
    setBlocks((prev) => [...prev, b]);
  }

  async function updateBlock(
    bid: string,
    patch: Partial<{
      title: string;
      category: string | null;
      is_fixed: boolean | number;
      start_min: number;
      end_min: number;
      weekday: number;
    }>
  ) {
    const b = await apiClient.updateTemplateBlock(bid, patch);
    setBlocks((prev) => prev.map((x) => (x.id === bid ? b : x)));
  }

  async function removeBlock(id: string) {
    await apiClient.deleteTemplateBlock(id);
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  const selected = templates.find((t) => t.id === selectedId);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="주간 템플릿"
        subtitle={selected?.name}
        right={
          <div className="flex items-center gap-2 text-xs">
            {error && <span className="text-cat-red">{error}</span>}
            {selected && (
              <>
                <button
                  className="border border-line px-2 py-0.5 hover:bg-hover"
                  onClick={() => renameTemplate(selected)}
                  title="이름 변경"
                >
                  ✎ 이름
                </button>
                <button
                  className="border border-line px-2 py-0.5 hover:bg-hover"
                  onClick={() => setDefault(selected)}
                  title="기본 템플릿 설정"
                >
                  {selected.is_default ? '★ 기본' : '☆ 기본'}
                </button>
                <button
                  className="border border-line bg-ink text-bg px-2 py-0.5 hover:opacity-90 disabled:opacity-50"
                  disabled={previewBusy}
                  onClick={startPreview}
                >
                  주에 적용
                </button>
                <button
                  className="border border-line px-2 py-0.5 hover:bg-hover text-cat-red"
                  onClick={() => removeTemplate(selected)}
                >
                  ✕ 삭제
                </button>
              </>
            )}
            <button
              className="text-sm border border-line bg-ink text-bg px-2 py-0.5 hover:opacity-90"
              onClick={newTemplate}
            >
              + 새 템플릿
            </button>
          </div>
        }
      />
      <div className="flex-1 grid grid-cols-[200px_1fr] min-h-0">
        <aside className="border-r border-line overflow-auto">
          <div className="px-3 py-2 border-b border-line text-xs uppercase tracking-wider text-sub">
            템플릿
          </div>
          {templates.length === 0 ? (
            <div className="px-3 py-3 text-xs text-sub">없음</div>
          ) : (
            <ul>
              {templates.map((t) => (
                <li key={t.id} className="relative group border-b border-line">
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-hover"
                    style={{
                      background: selectedId === t.id ? 'var(--c-hover)' : undefined,
                      fontWeight: selectedId === t.id ? 500 : 400,
                    }}
                    onClick={() => setSelectedId(t.id)}
                    onDoubleClick={() => renameTemplate(t)}
                  >
                    <div className="text-sm flex items-center gap-1 pr-6">
                      {t.is_default ? <span className="text-xs">★</span> : null}
                      <span className="truncate">{t.name}</span>
                    </div>
                  </button>
                  <button
                    className="absolute top-1.5 right-1 px-1 text-xs text-sub opacity-0 group-hover:opacity-100 hover:text-ink"
                    title="이름 변경"
                    onClick={(e) => {
                      e.stopPropagation();
                      renameTemplate(t);
                    }}
                  >
                    ✎
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="overflow-auto min-h-0 flex flex-col">
          {!selected ? (
            <div className="px-4 py-6 text-sm text-sub">
              <div className="border border-dashed border-line px-4 py-6">
                템플릿을 선택하거나 [+ 새 템플릿]으로 시작
              </div>
            </div>
          ) : (
            <>
              {selectedBlockIds.size > 0 && (
                <div className="border-b border-line bg-panel px-3 py-1.5 flex items-center gap-2 text-xs">
                  <span className="font-medium">{selectedBlockIds.size}개 선택</span>
                  <span className="text-sub">/ 전체 {blocks.length}</span>
                  <div className="flex-1" />
                  <button
                    className="border border-line px-2 py-0.5 hover:bg-hover"
                    onClick={selectAllBlocks}
                  >
                    전체 선택
                  </button>
                  <button
                    className="border border-line px-2 py-0.5 hover:bg-hover"
                    onClick={clearBlockSelection}
                  >
                    해제
                  </button>
                  <button
                    className="border border-line bg-ink text-bg px-2 py-0.5 hover:opacity-90"
                    onClick={removeSelectedBlocks}
                  >
                    ✕ 선택 삭제
                  </button>
                </div>
              )}
              <div className="flex-1 min-h-0">
                <TemplateGrid
                  blocks={blocks}
                  categories={eventCategories}
                  selectedBlockIds={selectedBlockIds}
                  onToggleSelect={toggleBlockSelection}
                  onAdd={addBlock}
                  onUpdate={updateBlock}
                  onRemove={removeBlock}
                />
              </div>
            </>
          )}
        </section>
      </div>
      {previewWeek && (
        <ApplyPreview
          weekStart={previewWeek}
          blockCount={blocks.length}
          conflicts={conflicts}
          busy={previewBusy}
          onCancel={() => {
            setPreviewWeek(null);
            setConflicts([]);
          }}
          onConfirm={confirmApply}
        />
      )}
    </div>
  );
}

function ApplyPreview({
  weekStart,
  blockCount,
  conflicts,
  busy,
  onCancel,
  onConfirm,
}: {
  weekStart: string;
  blockCount: number;
  conflicts: Conflict[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const weekEnd = addDays(weekStart, 6);
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-bg border border-line w-[480px] max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2 border-b border-line text-sm font-medium">
          템플릿 적용 미리보기
        </div>
        <div className="px-4 py-3 text-sm space-y-2">
          <div>
            <span className="text-sub">주: </span>
            <span className="font-mono">
              {weekStart} ~ {weekEnd}
            </span>
          </div>
          <div>
            <span className="text-sub">추가될 블록: </span>
            <span className="font-mono">{blockCount}개</span>
          </div>
          {conflicts.length === 0 ? (
            <div className="text-sub text-xs border border-dashed border-line px-3 py-2">
              충돌 없음 — 그대로 추가됩니다.
            </div>
          ) : (
            <div className="border border-cat-red/60">
              <div className="px-3 py-1 border-b border-line text-xs text-cat-red">
                ⚠ 충돌 {conflicts.length}건 (기존 일정과 겹침 — 적용해도 기존은 그대로 유지됩니다)
              </div>
              <ul className="text-xs">
                {conflicts.map((c, i) => (
                  <li key={i} className="px-3 py-1.5 border-b border-line last:border-b-0">
                    <div className="font-medium">
                      {WEEKDAY[c.weekday]} {minToHHMM(c.blockStart)}–{minToHHMM(c.blockEnd)}{' '}
                      {c.blockTitle}
                    </div>
                    {c.events.map((e) => (
                      <div key={e.id} className="text-sub pl-3 truncate">
                        ↳ 기존: {minToHHMM(e.start_min)}–{minToHHMM(e.end_min)} {e.title}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-line flex justify-end gap-2 text-sm">
          <button
            className="border border-line px-3 py-0.5 hover:bg-hover disabled:opacity-50"
            disabled={busy}
            onClick={onCancel}
          >
            취소
          </button>
          <button
            className="border border-line bg-ink text-bg px-3 py-0.5 hover:opacity-90 disabled:opacity-50"
            disabled={busy}
            onClick={onConfirm}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateGrid({
  blocks,
  categories,
  selectedBlockIds,
  onToggleSelect,
  onAdd,
  onUpdate,
  onRemove,
}: {
  blocks: WeeklyTemplateBlock[];
  categories: CategoryRow[];
  selectedBlockIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onAdd: (
    weekday: number,
    start_min: number,
    end_min: number,
    title: string,
    category: string | null,
    is_fixed: boolean
  ) => Promise<void>;
  onUpdate: (
    bid: string,
    patch: Partial<{
      title: string;
      category: string | null;
      is_fixed: boolean | number;
      start_min: number;
      end_min: number;
      weekday: number;
    }>
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const colorById = useMemo(() => new Map(categories.map((c) => [c.id, c.color ?? '#8a8a85'])), [categories]);

  // ── 블록 드래그-이동 (요일 + 시간)
  const dayGridRef = useRef<HTMLDivElement | null>(null);
  const moveRef = useRef<{
    id: string;
    pointerStartX: number;
    pointerStartY: number;
    originalWeekday: number;
    originalStart: number;
    duration: number;
    currentWeekday: number;
    currentStart: number;
    moved: boolean;
    pending: boolean;
  } | null>(null);
  const justMovedRef = useRef(false);
  const [, setMoveTick] = useState(0);

  function startBlockDrag(e: React.MouseEvent, b: WeeklyTemplateBlock) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const m = {
      id: b.id,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      originalWeekday: b.weekday,
      originalStart: b.start_min,
      duration: b.end_min - b.start_min,
      currentWeekday: b.weekday,
      currentStart: b.start_min,
      moved: false,
      pending: false,
    };
    moveRef.current = m;
    function bump() {
      setMoveTick((t) => t + 1);
    }
    function onWinMove(ev2: MouseEvent) {
      const cur = moveRef.current;
      const g = dayGridRef.current;
      if (!cur || !g) return;
      const rect = g.getBoundingClientRect();
      const colW = Math.max(1, (rect.width - TIME_LABEL_W) / 7);
      const dx = ev2.clientX - cur.pointerStartX;
      const dy = ev2.clientY - cur.pointerStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) cur.moved = true;
      const dCol = Math.round(dx / colW);
      cur.currentWeekday = Math.max(0, Math.min(6, cur.originalWeekday + dCol));
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
          cur.currentWeekday !== cur.originalWeekday);
      if (moved) {
        cur.pending = true;
        bump();
        Promise.resolve(
          onUpdate(cur.id, {
            weekday: cur.currentWeekday,
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

  const moving = moveRef.current;
  const blocksByDay = new Map<number, WeeklyTemplateBlock[]>();
  for (const b of blocks) {
    const effDay = moving?.id === b.id ? moving.currentWeekday : b.weekday;
    const arr = blocksByDay.get(effDay) ?? [];
    arr.push(b);
    blocksByDay.set(effDay, arr);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="grid border-b border-line text-xs text-sub"
        style={{
          gridTemplateColumns: `${TIME_LABEL_W}px repeat(7, 1fr)`,
        }}
      >
        <div></div>
        {WEEKDAY.map((w) => (
          <div key={w} className="px-2 py-1 border-l border-line uppercase tracking-wider">
            {w}
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <div
          ref={dayGridRef}
          className="grid relative h-full"
          style={{
            gridTemplateColumns: `${TIME_LABEL_W}px repeat(7, 1fr)`,
          }}
        >
          {/* time labels (1시간 단위 boundary: 06:00 ~ 24:00) */}
          <div className="relative border-r border-line">
            {Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 }, (_, h) => {
              const totalHours = (DAY_END_MIN - DAY_START_MIN) / 60;
              const min = DAY_START_MIN + h * 60;
              const isFirst = h === 0;
              const isLast = h === totalHours;
              return (
                <div
                  key={h}
                  className="absolute right-0 px-1 text-xs text-sub text-right"
                  style={{
                    top: `${(h / totalHours) * 100}%`,
                    transform: isFirst
                      ? 'translateY(0)'
                      : isLast
                        ? 'translateY(-100%)'
                        : 'translateY(-50%)',
                  }}
                >
                  {minToHHMM(min)}
                </div>
              );
            })}
          </div>
          {WEEKDAY.map((_, di) => (
            <DayColumn
              key={di}
              weekday={di}
              blocks={blocksByDay.get(di) ?? []}
              categories={categories}
              colorById={colorById}
              selectedBlockIds={selectedBlockIds}
              onToggleSelect={onToggleSelect}
              onAdd={onAdd}
              onUpdate={onUpdate}
              onRemove={onRemove}
              movingId={moving?.id ?? null}
              movingStart={moving?.currentStart ?? null}
              movingDuration={moving?.duration ?? null}
              movingPending={moving?.pending ?? false}
              justMovedRef={justMovedRef}
              onStartDrag={startBlockDrag}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  weekday,
  blocks,
  categories,
  colorById,
  selectedBlockIds,
  onToggleSelect,
  onAdd,
  onUpdate,
  onRemove,
  movingId,
  movingStart,
  movingDuration,
  movingPending,
  justMovedRef,
  onStartDrag,
}: {
  weekday: number;
  blocks: WeeklyTemplateBlock[];
  categories: CategoryRow[];
  colorById: Map<string, string>;
  selectedBlockIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onAdd: (
    weekday: number,
    start_min: number,
    end_min: number,
    title: string,
    category: string | null,
    is_fixed: boolean
  ) => Promise<void>;
  onUpdate: (
    bid: string,
    patch: Partial<{
      title: string;
      category: string | null;
      is_fixed: boolean | number;
      start_min: number;
      end_min: number;
      weekday: number;
    }>
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  movingId: string | null;
  movingStart: number | null;
  movingDuration: number | null;
  movingPending: boolean;
  justMovedRef: React.MutableRefObject<boolean>;
  onStartDrag: (e: React.MouseEvent, b: WeeklyTemplateBlock) => void;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<{ startMin: number; endMin: number } | null>(null);
  const [pendingTitle, setPendingTitle] = useState<{ startMin: number; endMin: number } | null>(null);
  const [title, setTitle] = useState('');
  const [pendingCat, setPendingCat] = useState<string | null>(null);
  const [pendingFixed, setPendingFixed] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (pendingTitle) {
      setTimeout(() => titleInputRef.current?.focus(), 30);
    }
  }, [pendingTitle]);

  function pxToMin(clientY: number): number {
    if (!colRef.current) return DAY_START_MIN;
    const rect = colRef.current.getBoundingClientRect();
    return clampMin(gridPxToMin(clientY - rect.top, rect.height));
  }

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    if (pendingTitle) return;
    const m = pxToMin(e.clientY);
    setDrag({ startMin: m, endMin: m + SLOT_MIN });
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    const m = pxToMin(e.clientY);
    setDrag({ ...drag, endMin: clampMin(Math.max(drag.startMin + SLOT_MIN, m + SLOT_MIN)) });
  }
  function onMouseUp() {
    if (!drag) return;
    const start = Math.min(drag.startMin, drag.endMin - SLOT_MIN);
    const end = Math.max(drag.endMin, drag.startMin + SLOT_MIN);
    setPendingTitle({ startMin: start, endMin: Math.min(DAY_END_MIN, end) });
    setDrag(null);
    setTitle('');
    setPendingCat(null);
    setPendingFixed(true);
    setSubmitting(false);
  }

  function cancelPending() {
    setPendingTitle(null);
    setTitle('');
    setPendingCat(null);
    setPendingFixed(true);
    setSubmitting(false);
  }

  async function commit() {
    if (!pendingTitle || submitting) return;
    const t = title.trim();
    if (!t) {
      titleInputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onAdd(weekday, pendingTitle.startMin, pendingTitle.endMin, t, pendingCat, pendingFixed);
      cancelPending();
    } finally {
      setSubmitting(false);
    }
  }

  const slotPct = 100 / TOTAL_SLOTS;
  return (
    <div
      ref={colRef}
      className="relative border-l border-line select-none h-full"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => drag && onMouseUp()}
    >
      {/* slot grid lines (정시 실선, 30분 점선) */}
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
      {/* blocks */}
      {blocks.map((b) => {
        const isMoving = movingId === b.id;
        const bStart =
          isMoving && movingStart != null ? movingStart : b.start_min;
        const bEnd =
          isMoving && movingStart != null && movingDuration != null
            ? movingStart + movingDuration
            : b.end_min;
        const top = minToPct(bStart);
        const h = minToPct(bEnd) - top;
        const color = b.category ? colorById.get(b.category) ?? '#8a8a85' : '#8a8a85';
        const fixed = !!b.is_fixed;
        const isSelected = selectedBlockIds.has(b.id);
        return (
          <div
            key={b.id}
            className="absolute left-0.5 right-0.5 bg-bg overflow-hidden text-xs flex group cursor-move"
            style={{
              top: `${top}%`,
              height: `${h}%`,
              border: `${isSelected ? 2 : 1}px ${fixed ? 'solid' : 'dashed'} ${
                isSelected ? 'var(--c-cat-red, #d44c47)' : fixed ? 'var(--c-ink)' : 'var(--c-muted)'
              }`,
              boxShadow: isSelected ? 'inset 0 0 0 1px var(--c-bg)' : undefined,
              opacity: isMoving && !movingPending ? 0.85 : 1,
            }}
            onMouseDown={(e) => onStartDrag(e, b)}
          >
            <span style={{ width: 4, background: color, flexShrink: 0 }} />
            <input
              type="checkbox"
              className="ml-0.5 mt-0.5 self-start cursor-pointer"
              checked={isSelected}
              onChange={() => onToggleSelect(b.id)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              title="선택"
            />
            <div className="flex-1 px-1 py-0.5 truncate min-w-0">
              <div className="truncate font-medium">{b.title}</div>
              <div className="text-sub text-xs flex items-center gap-1">
                <span>
                  {minToHHMM(bStart)}–{minToHHMM(bEnd)}
                </span>
                <select
                  className="border border-line bg-bg px-0.5 text-xs flex-1 min-w-0"
                  value={b.category ?? ''}
                  onChange={(e) => {
                    if (justMovedRef.current) return;
                    onUpdate(b.id, { category: e.target.value || null });
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  title="카테고리"
                >
                  <option value="">— 분류 —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col">
              <button
                className="text-xs px-1 hover:bg-hover"
                title={
                  fixed
                    ? '수동 — [주에 적용] 눌러야만 깔림 (클릭해 자동으로 변경)'
                    : '자동 — 매주 빈 주에 알아서 깔림 (클릭해 수동으로 변경)'
                }
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (justMovedRef.current) return;
                  onUpdate(b.id, { is_fixed: fixed ? 0 : 1 });
                }}
              >
                {fixed ? '◼' : '◻'}
              </button>
              <button
                className="opacity-0 group-hover:opacity-100 text-cat-red text-xs px-1"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (justMovedRef.current) return;
                  onRemove(b.id);
                }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
      {/* drag preview */}
      {drag && (
        <div
          className="absolute left-0.5 right-0.5 border border-ink bg-hover text-xs pointer-events-none"
          style={{
            top: `${minToPct(Math.min(drag.startMin, drag.endMin - SLOT_MIN))}%`,
            height: `${
              minToPct(Math.max(drag.endMin, drag.startMin + SLOT_MIN)) -
              minToPct(Math.min(drag.startMin, drag.endMin - SLOT_MIN))
            }%`,
          }}
        />
      )}
      {/* 새 블록 모달 */}
      {pendingTitle && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancelPending();
          }}
        >
          <div
            className="bg-bg border border-line w-[420px] max-w-[90vw] text-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelPending();
              }
            }}
          >
            <div className="border-b border-line px-4 py-2 flex items-center">
              <h2 className="font-medium">새 블록</h2>
              <span className="ml-2 text-xs text-sub tabular-nums">
                {WEEKDAY[weekday]} {minToHHMM(pendingTitle.startMin)}–
                {minToHHMM(pendingTitle.endMin)}
              </span>
              <div className="flex-1" />
              <button className="text-sub hover:text-ink px-1" onClick={cancelPending}>
                ✕
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <input
                ref={titleInputRef}
                className="w-full border border-line px-2 py-1"
                placeholder="제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                  }
                }}
              />
              <select
                className="w-full border border-line px-2 py-1"
                value={pendingCat ?? ''}
                onChange={(e) => setPendingCat(e.target.value || null)}
              >
                <option value="">카테고리 (선택)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-sub cursor-pointer">
                <input
                  type="checkbox"
                  checked={pendingFixed}
                  onChange={(e) => setPendingFixed(e.target.checked)}
                />
                수동 — [주에 적용] 눌러야만 깔림 (해제 시 자동: 매주 자동 적용)
              </label>
            </div>
            <div className="border-t border-line px-4 py-2 flex items-center justify-end gap-2">
              <button
                className="border border-line px-3 py-1 hover:bg-hover"
                onClick={cancelPending}
              >
                취소
              </button>
              <button
                className="border border-line bg-ink text-bg px-3 py-1 hover:opacity-90 disabled:opacity-50"
                onClick={commit}
                disabled={submitting || title.trim() === ''}
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
