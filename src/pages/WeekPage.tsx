import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { WeekGrid } from '@/components/WeekGrid';
import { WeekBar } from '@/components/WeekBar';
import { EventInspector } from '@/components/EventInspector';
import { apiClient } from '@/lib/api';
import { useCategories, useEventsRange, useNowHHMM, useNowMin } from '@/lib/hooks';
import type { WeeklyTemplate } from '@/lib/types';
import { addDays, isoWeekKey, startOfWeekMonday, todayISO } from '@/lib/utils';
import {
  getEventClip,
  hasTextSelection,
  isTypingTarget,
  setEventClip,
} from '@/lib/eventClipboard';
import { DAY_END_MIN, DAY_START_MIN, SLOT_MIN } from '@/lib/timeGrid';

const AUTO_TEMPLATE_WEEK_KEY = 'last_auto_template_week';

function weekRange(monIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monIso, i));
}

function formatRange(from: string, to: string): string {
  const f = from.replace(/-/g, '.');
  const t = to.split('-').slice(1).join('.');
  return `${f} ~ ${t}`;
}

export function WeekPage() {
  const today = todayISO();
  const [anchorIso, setAnchorIso] = useState(today);
  const monIso = startOfWeekMonday(anchorIso);
  const sunIso = addDays(monIso, 6);
  const dates = weekRange(monIso);
  const weekKey = isoWeekKey(monIso);

  const range = useEventsRange(monIso, sunIso);
  const eventCategories = useCategories('event');
  const nowMin = useNowMin();
  const nowText = useNowHHMM();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categoryColor = useMemo(() => {
    const map = new Map(eventCategories.map((c) => [c.id, c.color ?? '#8a8a85']));
    return (id: string | null) => (id ? map.get(id) ?? '#8a8a85' : '#8a8a85');
  }, [eventCategories]);

  const selected = selectedId ? range.events.find((e) => e.id === selectedId) ?? null : null;

  // ★ 기본 템플릿 로딩
  const [defaultTemplate, setDefaultTemplate] = useState<WeeklyTemplate | null>(null);
  const [applyingDefault, setApplyingDefault] = useState(false);
  useEffect(() => {
    let alive = true;
    apiClient
      .listTemplates()
      .then((list) => {
        if (!alive) return;
        setDefaultTemplate(list.find((t) => t.is_default) ?? null);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      alive = false;
    };
  }, []);

  // ★ 마지막 자동 적용 주차 (settings)
  const [lastAutoWeek, setLastAutoWeek] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    apiClient
      .listSettings()
      .then((rows) => {
        if (!alive) return;
        const r = rows.find((s) => s.key === AUTO_TEMPLATE_WEEK_KEY);
        setLastAutoWeek(r?.value ?? null);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (alive) setSettingsLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // ★ 자동 적용 토스트 (되돌리기용)
  const [toast, setToast] = useState<{ ids: string[]; reverting: boolean } | null>(null);
  const toastTimer = useRef<number | null>(null);
  function dismissToast() {
    if (toastTimer.current != null) {
      window.clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast(null);
  }
  function scheduleToastDismiss() {
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 8000);
  }
  useEffect(() => {
    return () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // ★ 자동 적용 시도 (주가 바뀔 때마다 평가, 주당 최대 1회)
  const triedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!settingsLoaded) return;
    if (range.loading) return;
    if (!defaultTemplate) return;
    if (lastAutoWeek === weekKey) return;
    if (triedRef.current.has(weekKey)) return;
    if (range.events.length !== 0) return; // 충돌 시 스킵 (배너로 폴백)

    triedRef.current.add(weekKey);
    let alive = true;
    (async () => {
      try {
        const r = await apiClient.applyTemplate(defaultTemplate.id, monIso, { only_guide: true });
        if (!alive) return;
        if (r.created_ids.length === 0) {
          // 가이드 블록 없는 템플릿 — 마킹만 하고 패스
          await apiClient.setSetting(AUTO_TEMPLATE_WEEK_KEY, weekKey);
          setLastAutoWeek(weekKey);
          return;
        }
        await apiClient.setSetting(AUTO_TEMPLATE_WEEK_KEY, weekKey);
        setLastAutoWeek(weekKey);
        await range.reload();
        setToast({ ids: r.created_ids, reverting: false });
        scheduleToastDismiss();
      } catch {
        // 실패 시 다음 진입에서 재시도 가능하도록 triedRef 유지하지 않음
        triedRef.current.delete(weekKey);
      }
    })();
    return () => {
      alive = false;
    };
  }, [settingsLoaded, range.loading, range.events.length, defaultTemplate, weekKey, lastAutoWeek, monIso, range]);

  async function revertAuto() {
    if (!toast) return;
    setToast({ ...toast, reverting: true });
    try {
      await Promise.all(toast.ids.map((id) => apiClient.deleteEvent(id).catch(() => null)));
      await range.reload();
    } finally {
      dismissToast();
    }
  }

  const showDefaultBanner =
    !range.loading && range.events.length === 0 && defaultTemplate != null && toast == null;

  async function applyDefault() {
    if (!defaultTemplate) return;
    setApplyingDefault(true);
    try {
      const r = await apiClient.applyTemplate(defaultTemplate.id, monIso);
      await range.reload();
      alert(`${r.applied}건 적용됨`);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setApplyingDefault(false);
    }
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
      // 대상 날짜: 선택된 일정의 날짜 → 오늘이 이번주에 있으면 오늘 → 월요일
      const targetDate =
        selected?.date ?? (today >= monIso && today <= sunIso ? today : monIso);
      let start: number;
      if (selected) {
        start = selected.end_min;
      } else if (targetDate === today) {
        start = Math.round(nowMin / SLOT_MIN) * SLOT_MIN;
      } else {
        start = 9 * 60;
      }
      if (start + dur > DAY_END_MIN) start = Math.max(DAY_START_MIN, DAY_END_MIN - dur);
      if (start < DAY_START_MIN) start = DAY_START_MIN;
      const end = Math.min(DAY_END_MIN, start + dur);
      const overlapping = range.events.filter(
        (e2) => e2.date === targetDate && e2.start_min < end && e2.end_min > start
      );
      if (overlapping.length > 0) {
        await Promise.all(overlapping.map((e2) => range.remove(e2.id)));
      }
      const ev = await range.create({
        date: targetDate,
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
  }, [selected, today, monIso, sunIso, nowMin, range]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="주간"
        subtitle={
          <span className="flex items-baseline gap-2">
            <span>{formatRange(monIso, sunIso)}</span>
            <span className="text-xs tabular-nums" style={{ color: '#d44c47' }}>
              ● {nowText}
            </span>
          </span>
        }
        right={
          <div className="flex items-center gap-2">
            <button
              className="text-sub hover:text-ink px-1"
              onClick={() => setAnchorIso(addDays(monIso, -7))}
              title="지난주"
            >
              〈
            </button>
            <button
              className="text-sm border border-line px-2 py-0.5 hover:bg-hover"
              onClick={() => setAnchorIso(today)}
            >
              이번주
            </button>
            <button
              className="text-sub hover:text-ink px-1"
              onClick={() => setAnchorIso(addDays(monIso, 7))}
              title="다음주"
            >
              〉
            </button>
            {range.error && <span className="text-xs text-cat-red">오류: {range.error}</span>}
          </div>
        }
      />
      <WeekBar monIso={monIso} sunIso={sunIso} />
      {showDefaultBanner && (
        <div className="border-b border-line bg-panel px-4 py-1.5 flex items-center gap-3 text-xs">
          <span>이 주에 일정이 없습니다.</span>
          <span className="text-sub">★기본 템플릿: {defaultTemplate?.name}</span>
          <div className="flex-1" />
          <button
            className="border border-line bg-ink text-bg px-2 py-0.5 hover:opacity-90 disabled:opacity-50"
            disabled={applyingDefault}
            onClick={applyDefault}
          >
            {applyingDefault ? '적용 중…' : '기본 템플릿 적용'}
          </button>
          <button
            className="text-sub hover:text-ink px-1"
            onClick={() => setDefaultTemplate(null)}
            title="배너 닫기"
          >
            ✕
          </button>
        </div>
      )}
      {toast && (
        <div className="border-b border-line bg-panel px-4 py-1.5 flex items-center gap-3 text-xs">
          <span>기본 템플릿이 깔렸어요.</span>
          <span className="text-sub">{toast.ids.length}개 자동 블록</span>
          <div className="flex-1" />
          <button
            className="border border-line px-2 py-0.5 hover:bg-hover disabled:opacity-50"
            disabled={toast.reverting}
            onClick={revertAuto}
          >
            {toast.reverting ? '되돌리는 중…' : '되돌리기'}
          </button>
          <button
            className="text-sub hover:text-ink px-1"
            onClick={dismissToast}
            title="닫기"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex-1 grid grid-cols-[1fr_320px] min-h-0">
        <section className="border-r border-line min-h-0">
          <WeekGrid
            weekDates={dates}
            events={range.events}
            categoryColor={categoryColor}
            todayISO={today}
            nowMin={nowMin}
            selectedId={selectedId}
            onSelect={setSelectedId}
            categories={eventCategories}
            onCreate={async (r, title, categoryId) => {
              const overlapping = range.events.filter(
                (e) =>
                  e.date === r.date && e.start_min < r.endMin && e.end_min > r.startMin
              );
              if (overlapping.length > 0) {
                await Promise.all(overlapping.map((e) => range.remove(e.id)));
              }
              const ev = await range.create({
                date: r.date,
                start_min: r.startMin,
                end_min: r.endMin,
                title,
                category: categoryId,
              });
              setSelectedId(ev.id);
            }}
            onMove={async (id, patch) => {
              const overlapping = range.events.filter(
                (e) =>
                  e.id !== id &&
                  e.date === patch.date &&
                  e.start_min < patch.end_min &&
                  e.end_min > patch.start_min
              );
              if (overlapping.length > 0) {
                await Promise.all(overlapping.map((e) => range.remove(e.id)));
              }
              await range.update(id, patch);
            }}
          />
        </section>
        <section className="flex flex-col min-h-0">
          {selected ? (
            <EventInspector
              event={selected}
              categories={eventCategories}
              onUpdate={(patch) => range.update(selected.id, patch)}
              onDelete={async () => {
                await range.remove(selected.id);
                setSelectedId(null);
              }}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="px-3 py-3 text-sm text-sub">
              <div className="border border-dashed border-line px-3 py-4">
                이벤트를 선택하면 상세가 여기에 — 빈 칸 드래그로 생성, 클릭으로 편집
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
