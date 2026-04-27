import { useEffect, useState } from 'react';
import type { CategoryRow, EventRow } from '@/lib/types';
import { minToHHMM } from '@/lib/utils';
import { DAY_END_MIN, DAY_START_MIN, SLOT_MIN } from '@/lib/timeGrid';

function timeOptions(): number[] {
  const out: number[] = [];
  for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += SLOT_MIN) out.push(m);
  return out;
}

type Props = {
  event: EventRow;
  categories: CategoryRow[];
  onUpdate: (patch: Partial<EventRow>) => Promise<unknown> | unknown;
  onDelete: () => Promise<unknown> | unknown;
  onClose: () => void;
};

export function EventInspector({ event, categories, onUpdate, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(event.title);
  const [startMin, setStartMin] = useState(event.start_min);
  const [endMin, setEndMin] = useState(event.end_min);
  const [category, setCategory] = useState<string | null>(event.category);
  const [notes, setNotes] = useState(event.notes ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(event.title);
    setStartMin(event.start_min);
    setEndMin(event.end_min);
    setCategory(event.category);
    setNotes(event.notes ?? '');
  }, [event.id, event.title, event.start_min, event.end_min, event.category, event.notes]);

  async function save(patch: Partial<EventRow>) {
    setSaving(true);
    try {
      await onUpdate(patch);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col text-sm">
      <div className="px-3 py-2 border-b border-line flex items-center">
        <div className="text-xs uppercase tracking-wider text-sub">이벤트</div>
        <div className="flex-1" />
        <button
          className="text-sub hover:text-ink"
          onClick={onClose}
          title="닫기 (Esc)"
        >
          ✕
        </button>
      </div>

      <div className="px-3 py-3 space-y-3 overflow-auto flex-1">
        <div>
          <div className="text-xs text-sub mb-1">제목</div>
          <input
            className="w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== event.title) save({ title: title.trim() });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-sub mb-1">시작</div>
            <select
              className="w-full border border-line px-1 py-0.5"
              value={startMin}
              onChange={(e) => {
                const v = Number(e.target.value);
                setStartMin(v);
                if (v < endMin) save({ start_min: v });
              }}
            >
              {timeOptions().map((m) => (
                <option key={m} value={m}>
                  {minToHHMM(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-sub mb-1">종료</div>
            <select
              className="w-full border border-line px-1 py-0.5"
              value={endMin}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEndMin(v);
                if (v > startMin) save({ end_min: v });
              }}
            >
              {timeOptions().map((m) => (
                <option key={m} value={m}>
                  {minToHHMM(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="text-xs text-sub mb-1">카테고리</div>
          <div className="flex flex-wrap gap-1">
            <button
              className="border border-line px-2 py-0.5 text-xs hover:bg-hover"
              onClick={() => {
                setCategory(null);
                save({ category: null });
              }}
              style={{ background: category == null ? 'var(--c-hover)' : undefined }}
            >
              없음
            </button>
            {categories.map((c) => {
              const active = c.id === category;
              return (
                <button
                  key={c.id}
                  className="border border-line px-2 py-0.5 text-xs hover:bg-hover flex items-center gap-1"
                  onClick={() => {
                    setCategory(c.id);
                    save({ category: c.id });
                  }}
                  style={{ background: active ? 'var(--c-hover)' : undefined }}
                >
                  <span
                    className="inline-block"
                    style={{
                      width: 8,
                      height: 8,
                      background: c.color ?? '#8a8a85',
                    }}
                  />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs text-sub mb-1">메모</div>
          <textarea
            className="w-full"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if ((notes || '') !== (event.notes ?? '')) save({ notes: notes || null });
            }}
          />
        </div>
      </div>

      <div className="px-3 py-2 border-t border-line flex items-center gap-2">
        <button
          className="border border-line px-2 py-0.5 text-xs hover:bg-hover text-cat-red"
          onClick={() => {
            if (confirm('이벤트 삭제?')) onDelete();
          }}
        >
          삭제
        </button>
        <div className="flex-1" />
        {saving && <span className="text-xs text-sub">저장 중…</span>}
      </div>
    </div>
  );
}
