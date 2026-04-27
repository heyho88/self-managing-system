import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { apiClient } from '@/lib/api';
import type { EventRow, JournalHeader, TaskRow, TransactionRow } from '@/lib/types';
import {
  addDays,
  endOfMonth,
  formatDateLong,
  formatKRW,
  fromISO,
  minToHHMM,
  pad2,
  startOfMonth,
  startOfWeekMonday,
  todayISO,
  toISO,
} from '@/lib/utils';

const MOOD_LABEL = ['😞', '😕', '😐', '🙂', '😄'];

export function JournalPage() {
  const today = todayISO();
  const [params, setParams] = useSearchParams();
  const date = params.get('d') && /^\d{4}-\d{2}-\d{2}$/.test(params.get('d')!) ? params.get('d')! : today;

  const [content, setContent] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [headers, setHeaders] = useState<JournalHeader[]>([]);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<{ content: string; mood: number | null }>({ content: '', mood: null });

  const setDate = useCallback(
    (iso: string) => {
      if (iso === today) {
        const next = new URLSearchParams(params);
        next.delete('d');
        setParams(next);
      } else {
        setParams({ d: iso });
      }
    },
    [params, setParams, today]
  );

  // 헤더 로드 (최근 60일)
  const reloadHeaders = useCallback(async () => {
    try {
      const list = await apiClient.listJournalHeaders();
      setHeaders(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    reloadHeaders();
  }, [reloadHeaders]);

  // 날짜 바뀌면 본문 로드
  useEffect(() => {
    let alive = true;
    apiClient
      .getJournal(date)
      .then((row) => {
        if (!alive) return;
        const c = row?.content ?? '';
        const m = row?.mood ?? null;
        setContent(c);
        setMood(m);
        lastSaved.current = { content: c, mood: m };
        setSavingState('idle');
      })
      .catch(() => {
        if (!alive) return;
        setContent('');
        setMood(null);
      });
    return () => {
      alive = false;
    };
  }, [date]);

  // 자동 저장 (디바운스 800ms)
  useEffect(() => {
    if (content === lastSaved.current.content && mood === lastSaved.current.mood) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSavingState('saving');
      try {
        await apiClient.upsertJournal(date, { content, mood });
        lastSaved.current = { content, mood };
        setSavingState('saved');
        await reloadHeaders();
      } catch {
        setSavingState('error');
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [content, mood, date, reloadHeaders]);

  // 헤더에 현재 날짜 보장
  const headersWithToday: JournalHeader[] = (() => {
    const has = headers.some((h) => h.date === date);
    return has
      ? headers
      : [{ date, mood, content_length: content.length }, ...headers].sort((a, b) =>
          a.date < b.date ? 1 : -1
        );
  })();

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="일기"
        subtitle={formatDateLong(date)}
        right={
          <div className="flex items-center gap-2 text-xs">
            <button className="text-sub hover:text-ink px-1" onClick={() => setDate(addDays(date, -1))}>
              〈
            </button>
            {date !== today && (
              <button
                className="border border-line px-2 py-0.5 hover:bg-hover"
                onClick={() => setDate(today)}
              >
                오늘
              </button>
            )}
            <button className="text-sub hover:text-ink px-1" onClick={() => setDate(addDays(date, 1))}>
              〉
            </button>
            <span className="text-sub ml-2">
              {savingState === 'saving'
                ? '저장 중…'
                : savingState === 'saved'
                ? '저장됨'
                : savingState === 'error'
                ? '저장 실패'
                : ''}
            </span>
          </div>
        }
      />
      <div className="flex-1 grid grid-cols-[240px_1fr] min-h-0">
        {/* 좌: 미니 캘린더 + 최근 리스트 */}
        <aside className="border-r border-line overflow-auto flex flex-col">
          <MiniCalendar
            anchor={date}
            today={today}
            headers={headersWithToday}
            onPick={setDate}
          />
          <div className="px-3 py-2 border-y border-line text-xs uppercase tracking-wider text-sub">
            최근 ({headersWithToday.length})
          </div>
          <ul>
            {headersWithToday.map((h) => {
              const isCur = h.date === date;
              return (
                <li key={h.date}>
                  <button
                    className="w-full text-left px-3 py-1.5 border-b border-line hover:bg-hover flex items-center gap-2 text-sm"
                    style={{
                      background: isCur ? 'var(--c-hover)' : undefined,
                      fontWeight: isCur ? 500 : 400,
                    }}
                    onClick={() => setDate(h.date)}
                  >
                    <span className="font-mono text-xs text-sub w-16 shrink-0">
                      {h.date.slice(5).replace('-', '.')}
                    </span>
                    <span className="flex-1 truncate text-xs">
                      {h.mood != null ? MOOD_LABEL[h.mood - 1] : '·'} {h.content_length}자
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* 우: 본문 */}
        <section className="flex flex-col min-h-0">
          <div className="border-b border-line px-3 py-2 flex items-center gap-2 text-sm">
            <span className="text-sub text-xs">기분</span>
            {[1, 2, 3, 4, 5].map((m) => (
              <button
                key={m}
                className="px-1.5 py-0.5 border border-line hover:bg-hover"
                style={{
                  background: mood === m ? 'var(--c-ink)' : undefined,
                  color: mood === m ? 'var(--c-bg)' : 'var(--c-ink)',
                }}
                onClick={() => setMood(mood === m ? null : m)}
              >
                {MOOD_LABEL[m - 1]}
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-xs text-sub font-mono">{content.length}자</span>
          </div>
          <AutoAttach date={date} />
          <textarea
            className="flex-1 resize-none border-0 px-4 py-3 text-base leading-relaxed focus:border-0 focus:outline-none"
            placeholder={`${formatDateLong(date)} — 오늘은…`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </section>
      </div>
    </div>
  );
}

function MiniCalendar({
  anchor,
  today,
  headers,
  onPick,
}: {
  anchor: string;
  today: string;
  headers: JournalHeader[];
  onPick: (iso: string) => void;
}) {
  const [viewAnchor, setViewAnchor] = useState(anchor);
  useEffect(() => {
    setViewAnchor(anchor);
  }, [anchor]);

  const monthStart = startOfMonth(viewAnchor);
  const monthEnd = endOfMonth(viewAnchor);
  const monthIdx = fromISO(viewAnchor).getMonth();
  const gridStart = startOfWeekMonday(monthStart);

  const cells = useMemo(() => {
    const arr: string[] = [];
    let cur = gridStart;
    for (let i = 0; i < 42; i++) {
      arr.push(cur);
      cur = addDays(cur, 1);
      if (i >= 27 && cur > monthEnd && (i + 1) % 7 === 0) break;
    }
    return arr;
  }, [gridStart, monthEnd]);

  const headerByDate = useMemo(() => new Map(headers.map((h) => [h.date, h])), [headers]);

  const ad = fromISO(viewAnchor);
  const yearMonth = `${ad.getFullYear()}.${pad2(ad.getMonth() + 1)}`;

  function jump(delta: number) {
    const d = fromISO(viewAnchor);
    d.setMonth(d.getMonth() + delta);
    d.setDate(1);
    setViewAnchor(toISO(d));
  }

  return (
    <div className="border-b border-line">
      <div className="flex items-center px-2 py-1 text-xs">
        <button className="text-sub hover:text-ink px-1" onClick={() => jump(-1)}>
          〈
        </button>
        <span className="flex-1 text-center font-mono">{yearMonth}</span>
        <button className="text-sub hover:text-ink px-1" onClick={() => jump(1)}>
          〉
        </button>
      </div>
      <div className="grid grid-cols-7 text-[10px] text-sub border-t border-line">
        {['월', '화', '수', '목', '금', '토', '일'].map((w) => (
          <div key={w} className="text-center py-0.5">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-t border-line">
        {cells.map((iso) => {
          const d = fromISO(iso);
          const isCur = d.getMonth() === monthIdx;
          const isToday = iso === today;
          const isSelected = iso === anchor;
          const h = headerByDate.get(iso);
          return (
            <button
              key={iso}
              className="aspect-square flex flex-col items-center justify-center text-xs border-r border-b border-line hover:bg-hover relative"
              style={{
                background: isSelected ? 'var(--c-hover)' : undefined,
                color: isCur ? 'var(--c-ink)' : 'var(--c-muted)',
                fontWeight: isToday ? 500 : 400,
              }}
              onClick={() => onPick(iso)}
            >
              <span className={isToday ? 'underline' : ''}>{d.getDate()}</span>
              {h && (h.content_length > 0 || h.mood != null) && (
                <span
                  className="absolute bottom-0.5 w-1 h-1"
                  style={{ background: h.mood != null ? 'var(--c-ink)' : 'var(--c-muted)' }}
                />
              )}
            </button>
          );
        })}
      </div>
      {viewAnchor !== today && (
        <button
          className="w-full text-xs text-sub hover:text-ink py-1 border-t border-line"
          onClick={() => setViewAnchor(today)}
        >
          오늘 달로
        </button>
      )}
    </div>
  );
}

function AutoAttach({ date }: { date: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [doneTasks, setDoneTasks] = useState<TaskRow[]>([]);
  const [txs, setTxs] = useState<TransactionRow[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiClient.listEvents(date, date),
      apiClient.listTasks({ status: 'done', scheduled: date }),
      apiClient.listTransactions({ from: date, to: date }),
    ])
      .then(([ev, tk, tx]) => {
        if (!alive) return;
        setEvents(ev);
        setDoneTasks(tk);
        setTxs(tx);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      alive = false;
    };
  }, [date]);

  const txInc = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const txExp = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const total = events.length + doneTasks.length + txs.length;
  if (total === 0) return null;

  return (
    <div className="border-b border-line text-xs">
      <button
        className="w-full px-3 py-1 flex items-center gap-3 text-left hover:bg-hover text-sub"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="font-mono">{collapsed ? '▸' : '▾'}</span>
        <span>이 날의 기록</span>
        <span className="text-ink">이벤트 {events.length}</span>
        <span className="text-ink">완료 {doneTasks.length}</span>
        {txs.length > 0 && (
          <span className="text-ink">
            거래 {txs.length}{' '}
            <span className="text-sub">
              ({txInc > 0 ? `+${formatKRW(txInc)} ` : ''}
              {txExp > 0 ? `-${formatKRW(txExp)}` : ''})
            </span>
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-sub mb-0.5">이벤트</div>
            {events.length === 0 ? (
              <div className="text-sub">—</div>
            ) : (
              <ul className="space-y-0.5">
                {events.map((e) => (
                  <li key={e.id} className="truncate">
                    <span className="font-mono text-sub">
                      {minToHHMM(e.start_min)}
                    </span>{' '}
                    {e.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-sub mb-0.5">완료한 일</div>
            {doneTasks.length === 0 ? (
              <div className="text-sub">—</div>
            ) : (
              <ul className="space-y-0.5">
                {doneTasks.map((t) => (
                  <li key={t.id} className="truncate">
                    ✓ {t.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-sub mb-0.5">거래</div>
            {txs.length === 0 ? (
              <div className="text-sub">—</div>
            ) : (
              <ul className="space-y-0.5">
                {txs.map((t) => (
                  <li key={t.id} className="truncate font-mono">
                    <span style={{ color: t.type === 'income' ? '#5a8f5a' : t.type === 'expense' ? '#d44c47' : 'var(--c-sub)' }}>
                      {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '⇄'}
                      {formatKRW(t.amount)}
                    </span>
                    <span className="text-sub ml-1">{t.memo ?? ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
