import { Menu, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { UserMenu } from './UserMenu';

interface AppTopbarProps {
  onMenuClick: () => void;
  onDesktopSidebarToggle: () => void;
  isDesktopSidebarCollapsed: boolean;
}

export function AppTopbar({
  onMenuClick,
  onDesktopSidebarToggle,
  isDesktopSidebarCollapsed,
}: AppTopbarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between border-b border-[#dfe8cf] bg-[linear-gradient(180deg,#fdfef9_0%,#fbfdf5_100%)] px-4 py-3.5 backdrop-blur md:px-6 lg:px-8 dark:border-slate-800/80 dark:bg-slate-950/80">
      {/* Left: Menu + Logo */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Menu"
        >
          <Menu size={24} className="text-text-primary" />
        </button>
        <h1 className="hidden text-lg font-bold text-slate-900 dark:text-slate-100 md:block">
          Cromia
        </h1>
        <button
          onClick={onDesktopSidebarToggle}
          className="hidden md:inline-flex items-center justify-center rounded-xl border border-[#dfe8cf] bg-white p-2 text-slate-600 transition-colors hover:bg-[#f6faed] hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label={isDesktopSidebarCollapsed ? 'Expandir lateral' : 'Recolher lateral'}
          title={isDesktopSidebarCollapsed ? 'Expandir lateral' : 'Recolher lateral'}
        >
          {isDesktopSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Right: Search + User */}
      <div className="flex items-center gap-3">
        {/* Command Palette Trigger */}
        <button
          onClick={() => {
            // Trigger command palette
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
            });
            window.dispatchEvent(event);
          }}
          className="hidden md:flex items-center gap-2 rounded-full border border-[#dfe8cf] bg-white px-4 py-2 text-sm text-slate-600 transition-all hover:border-[#c8dba9] hover:bg-[#f8fbf0] hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Search size={16} />
          <span className="font-medium">Buscar tarefas, clientes e arquivos...</span>
          <kbd className="rounded-md bg-[#f1f7e2] px-1.5 py-0.5 text-[10px] font-bold text-[#5d7b22] dark:bg-slate-800">⌘K</kbd>
        </button>

        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 hidden md:block mx-1" />

        <UserMenu />
      </div>
    </header>
  );
}
