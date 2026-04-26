import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../lib/utils';

const tabs = [
  { to: '/', label: '오늘', icon: '📅' },
  { to: '/expenses', label: '가계부', icon: '💸' },
  { to: '/habits', label: '습관', icon: '✅' },
  { to: '/journal', label: '회고', icon: '📝' },
  { to: '/goals', label: '목표', icon: '🎯' },
  { to: '/stats', label: '통계', icon: '📊' },
];

export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col pb-24">
      <header className="sticky top-0 z-10 border-b border-neutral-900 bg-neutral-950/80 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold tracking-tight">자기관리</h1>
      </header>
      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-900 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-6">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors',
                  isActive ? 'text-white' : 'text-neutral-500 hover:text-neutral-300',
                )
              }
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
