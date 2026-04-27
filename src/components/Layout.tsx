import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { AgentDrawer } from './AgentDrawer';
import { useTheme } from '@/lib/theme';
import { addDays, todayISO } from '@/lib/utils';

export function Layout() {
  const [theme, toggleTheme] = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(() => {
    if (typeof localStorage === 'undefined') return true;
    const v = localStorage.getItem('agentPanelOpen');
    return v === null ? true : v === '1';
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem('agentPanelOpen', agentOpen ? '1' : '0');
    } catch {
      // ignore
    }
  }, [agentOpen]);
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  // 현재 보고있는 날짜 (오늘/일기 등 ?d= 파라미터)
  function shiftDate(delta: number) {
    const cur = params.get('d') ?? todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cur)) return;
    const next = addDays(cur, delta);
    if (next === todayISO()) {
      const p = new URLSearchParams(params);
      p.delete('d');
      setParams(p);
    } else {
      setParams({ d: next });
    }
  }

  function goToday() {
    const p = new URLSearchParams(params);
    p.delete('d');
    setParams(p);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const target = e.target as HTMLElement | null;
      const inEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // ⌘K — 통합검색
      if (cmd && !shift && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      // ⌘J — 코파일럿 사이드바 토글
      if (cmd && !shift && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAgentOpen((v) => !v);
        return;
      }
      // ⌘D — 다크모드
      if (cmd && !shift && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleTheme();
        return;
      }
      // ⌘1/2/3 — 오늘/주간/월간
      if (cmd && !shift && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault();
        navigate(e.key === '1' ? '/today' : e.key === '2' ? '/week' : '/month');
        return;
      }
      // ⌘N — 새 이벤트 (오늘로 이동 + 키 보존, 페이지에서 처리하도록 query flag)
      if (cmd && !shift && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('/today');
        return;
      }
      // ⌘⇧N — 새 거래
      if (cmd && shift && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('/budget?new=1');
        return;
      }
      // ⌘. — 오늘로 이동
      if (cmd && e.key === '.') {
        e.preventDefault();
        goToday();
        return;
      }

      if (inEditable) return;

      // J / K — 다음·이전 날짜 (날짜 컨텍스트를 가진 페이지에서만)
      const datePages = ['/today', '/journal', '/week', '/month', '/budget'];
      if (!cmd && (e.key === 'j' || e.key === 'k') && datePages.some((p) => location.pathname.startsWith(p))) {
        e.preventDefault();
        shiftDate(e.key === 'j' ? 1 : -1);
        return;
      }
      // [ — 사이드바 토글
      if (!cmd && e.key === '[') {
        e.preventDefault();
        setSidebarOpen((v) => !v);
        return;
      }
      // Esc — 팔레트 열려있으면 닫음 (자체 처리되지만 안전망)
      if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
        return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, toggleTheme, paletteOpen, location.pathname, params]);

  return (
    <div className="flex h-full bg-bg">
      {sidebarOpen && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenPalette={() => setPaletteOpen(true)}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          agentOpen={agentOpen}
          onToggleAgent={() => setAgentOpen((v) => !v)}
        />
        <main className="flex-1 min-h-0 overflow-auto">
          <Outlet />
        </main>
      </div>
      <AgentDrawer open={agentOpen && location.pathname !== '/agent'} onClose={() => setAgentOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
