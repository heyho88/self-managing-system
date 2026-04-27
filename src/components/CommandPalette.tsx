import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import type { SearchResult } from '@/lib/types';

const NAV_COMMANDS: { label: string; path: string; hint?: string }[] = [
  { label: '오늘', path: '/today' },
  { label: '주간', path: '/week' },
  { label: '월간', path: '/month' },
  { label: '할일', path: '/inbox' },
  { label: '목표', path: '/goals' },
  { label: '일기', path: '/journal' },
  { label: '템플릿', path: '/templates' },
  { label: '코파일럿', path: '/agent' },
  { label: '가계부', path: '/budget' },
  { label: '자산', path: '/accounts' },
  { label: '통계', path: '/stats' },
  { label: '설정', path: '/settings' },
];

const KIND_LABEL: Record<string, string> = {
  event: '일정',
  task: '할일',
  goal: '목표',
  tx: '거래',
  journal: '일기',
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term === '') {
      setResults([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const list = await apiClient.search(term);
        if (alive) setResults(list);
      } catch {
        // ignore
      }
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, open]);

  if (!open) return null;

  const filteredNavs = q.trim()
    ? NAV_COMMANDS.filter((n) => n.label.toLowerCase().includes(q.toLowerCase()) || n.path.includes(q.toLowerCase()))
    : NAV_COMMANDS;
  const allItems: { kind: 'nav' | 'data'; label: string; sub?: string; action: () => void }[] = [
    ...filteredNavs.map((n) => ({
      kind: 'nav' as const,
      label: n.label,
      sub: n.path,
      action: () => {
        navigate(n.path);
        onClose();
      },
    })),
    ...results.map((r) => ({
      kind: 'data' as const,
      label: r.label,
      sub: `${KIND_LABEL[r.kind] ?? r.kind}${r.sub ? ` · ${r.sub}` : ''}`,
      action: () => {
        const path =
          r.kind === 'event'
            ? `/today?d=${(r.sub ?? '').slice(0, 10)}`
            : r.kind === 'task'
            ? '/inbox'
            : r.kind === 'goal'
            ? '/goals'
            : r.kind === 'tx'
            ? '/budget'
            : r.kind === 'journal'
            ? `/journal?d=${r.id}`
            : '/today';
        navigate(path);
        onClose();
      },
    })),
  ];

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(allItems.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = allItems[active];
      if (it) it.action();
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 pt-[15vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg border border-line w-[560px] max-w-[90vw] flex flex-col">
        <div className="border-b border-line">
          <input
            ref={inputRef}
            className="w-full px-3 py-2 text-base border-0"
            placeholder="검색 또는 이동…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="max-h-[50vh] overflow-auto">
          {allItems.length === 0 ? (
            <div className="px-3 py-3 text-sm text-sub">결과 없음</div>
          ) : (
            <ul>
              {allItems.map((it, i) => (
                <li key={i}>
                  <button
                    className="w-full text-left px-3 py-1.5 border-b border-line text-sm flex items-center gap-2"
                    style={{ background: i === active ? 'var(--c-hover)' : undefined }}
                    onMouseEnter={() => setActive(i)}
                    onClick={it.action}
                  >
                    <span
                      className="text-xs uppercase tracking-wider w-12 shrink-0 text-sub"
                    >
                      {it.kind === 'nav' ? '이동' : '검색'}
                    </span>
                    <span className="flex-1 truncate">{it.label}</span>
                    <span className="text-xs text-sub truncate max-w-[40%]">{it.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-line px-3 py-1.5 text-xs text-sub flex items-center gap-3">
          <span>↑↓ 이동</span>
          <span>↵ 선택</span>
          <span>esc 닫기</span>
        </div>
      </div>
    </div>
  );
}
