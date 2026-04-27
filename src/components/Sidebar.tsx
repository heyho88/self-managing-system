import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Item = { to: string; label: string; hint?: string };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: 'WORKSPACE',
    items: [
      { to: '/today', label: '오늘' },
      { to: '/week', label: '주간' },
      { to: '/month', label: '월간' },
    ],
  },
  {
    label: 'PLAN',
    items: [
      { to: '/goals', label: '목표' },
      { to: '/journal', label: '일기' },
      { to: '/templates', label: '템플릿' },
    ],
  },
  {
    label: 'AGENT',
    items: [{ to: '/agent', label: '코파일럿', hint: '⌘J' }],
  },
  {
    label: 'MONEY',
    items: [
      { to: '/budget', label: '가계부' },
      { to: '/accounts', label: '자산' },
      { to: '/stats', label: '통계' },
    ],
  },
  {
    label: 'SETTINGS',
    items: [{ to: '/settings', label: '설정' }],
  },
];

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-panel border-r border-line h-full overflow-y-auto">
      <div className="px-3 py-3 border-b border-line">
        <div className="text-md font-medium text-ink">라이프OS</div>
        <div className="text-xs text-sub mt-0.5">workspace</div>
      </div>
      <nav className="py-2">
        {GROUPS.map((g) => (
          <div key={g.label} className="mb-3">
            <div className="px-3 py-1 text-xs font-medium uppercase tracking-wider text-sub">
              {g.label}
            </div>
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between px-3 py-1 text-base text-ink relative',
                    'hover:bg-hover',
                    isActive && 'bg-hover font-medium'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />
                    )}
                    <span className="pl-1">{it.label}</span>
                    {it.hint && <span className="text-xs text-sub">{it.hint}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
