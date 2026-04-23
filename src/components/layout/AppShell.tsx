import { useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { MobileNav } from './MobileNav';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppTopbar
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        onDesktopSidebarToggle={() => setDesktopSidebarCollapsed((value) => !value)}
        isDesktopSidebarCollapsed={desktopSidebarCollapsed}
      />
      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex">
          <AppSidebar collapsed={desktopSidebarCollapsed} />
        </div>

        {/* Main Content */}
        <main className="minimal-scrollbar flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(154,202,82,0.1),_transparent_22%),linear-gradient(180deg,#fcfdf8_0%,#f6f9ef_46%,#ffffff_100%)] dark:bg-slate-900">
          {children}
        </main>
      </div>

      {/* Mobile Nav */}
      <MobileNav
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
}
