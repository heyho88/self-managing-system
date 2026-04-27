import { useNavigate } from 'react-router-dom';
import { formatDateLong, todayISO } from '@/lib/utils';

export function Topbar({
  theme,
  onToggleTheme,
  onOpenPalette,
  sidebarOpen,
  onToggleSidebar,
  agentOpen,
  onToggleAgent,
}: {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenPalette: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  agentOpen: boolean;
  onToggleAgent: () => void;
}) {
  const today = todayISO();
  const navigate = useNavigate();
  return (
    <header className="h-9 shrink-0 border-b border-line flex items-center text-sm bg-bg">
      <div className="flex items-center gap-2 px-3 border-r border-line h-full">
        <button
          className="text-sub hover:text-ink"
          title={sidebarOpen ? '사이드바 닫기 [' : '사이드바 열기 ['}
          onClick={onToggleSidebar}
        >
          {sidebarOpen ? '◧' : '◨'}
        </button>
        <span className="text-ink">{formatDateLong(today)}</span>
        <button
          className="ml-2 text-ink hover:bg-hover px-2 py-0.5 border border-line"
          onClick={() => navigate('/today')}
        >
          오늘
        </button>
      </div>
      <div className="flex-1 flex items-center justify-end px-3 gap-3">
        <button
          className="text-sub hover:text-ink flex items-center gap-1"
          onClick={onOpenPalette}
        >
          <span>⌘K</span>
          <span>검색</span>
        </button>
        <button
          className={`flex items-center gap-1 ${agentOpen ? 'text-ink' : 'text-sub hover:text-ink'}`}
          title={agentOpen ? '코파일럿 숨기기 (⌘J)' : '코파일럿 보기 (⌘J)'}
          onClick={onToggleAgent}
        >
          <span>⌘J</span>
          <span>코파일럿</span>
        </button>
        <button
          className="text-sub hover:text-ink"
          title="다크모드 (⌘D)"
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? '☀' : '◐'}
        </button>
      </div>
    </header>
  );
}
