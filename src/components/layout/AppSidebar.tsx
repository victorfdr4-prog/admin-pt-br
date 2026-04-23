import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  User,
  FileText,
  Settings,
  Calendar,
  FolderOpen,
  DollarSign,
  Activity,
  MessageCircle,
  Layers,
} from 'lucide-react';
import { SidebarNav } from './SidebarNav';
import { ptBR } from '@/lib/ptBR';
import { useAuthStore } from '@/store/useAuthStore';
import { canAccessModule } from '@/domain/accessControl';

interface NavGroup {
  label: string;
  items: Array<{
    label: string;
    href: string;
    icon: React.ReactNode;
    badge?: number;
  }>;
}

interface AppSidebarProps {
  collapsed?: boolean;
}

export function AppSidebar({ collapsed = false }: AppSidebarProps) {
  const location = useLocation();
  const userRole = useAuthStore((state) => state.user?.role);

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        label: '',
        items: [
          canAccessModule(userRole, 'dashboard')
            ? {
                label: ptBR.layout.dashboard,
                href: '/dashboard',
                icon: <LayoutDashboard size={20} />,
              }
            : null,
        ].filter(Boolean) as NavGroup['items'],
      },
      {
        label: ptBR.layout.navigation.operation,
        items: [
          canAccessModule(userRole, 'boards')
            ? {
                label: ptBR.layout.navigation.boards,
                href: '/boards',
                icon: <BarChart3 size={20} />,
              }
            : null,
          canAccessModule(userRole, 'posting_calendar')
            ? {
                label: ptBR.layout.navigation.calendar,
                href: '/posting-calendar',
                icon: <Calendar size={20} />,
              }
            : null,
          canAccessModule(userRole, 'posting_calendar')
            ? {
                label: ptBR.layout.navigation.hub,
                href: '/hub',
                icon: <Layers size={20} />,
              }
            : null,
        ].filter(Boolean) as NavGroup['items'],
      },
      {
        label: ptBR.layout.navigation.clients,
        items: [
          canAccessModule(userRole, 'clients')
            ? {
                label: ptBR.layout.navigation.clients,
                href: '/clients',
                icon: <Users size={20} />,
              }
            : null,
        ].filter(Boolean) as NavGroup['items'],
      },
      {
        label: ptBR.layout.navigation.resources,
        items: [
          canAccessModule(userRole, 'drive')
            ? {
                label: ptBR.layout.navigation.drive,
                href: '/drive',
                icon: <FolderOpen size={20} />,
              }
            : null,
          canAccessModule(userRole, 'documents')
            ? {
                label: ptBR.layout.navigation.documents,
                href: '/documents',
                icon: <FileText size={20} />,
              }
            : null,
          canAccessModule(userRole, 'finance')
            ? {
                label: ptBR.layout.navigation.finance,
                href: '/finance',
                icon: <DollarSign size={20} />,
              }
            : null,
        ].filter(Boolean) as NavGroup['items'],
      },
      {
        label: ptBR.layout.navigation.system,
        items: [
          canAccessModule(userRole, 'team')
            ? {
                label: ptBR.layout.navigation.team,
                href: '/team',
                icon: <User size={20} />,
              }
            : null,
          canAccessModule(userRole, 'logs')
            ? {
                label: ptBR.layout.navigation.logs,
                href: '/logs',
                icon: <Activity size={20} />,
              }
            : null,
          canAccessModule(userRole, 'whatsapp')
            ? {
                label: 'WhatsApp',
                href: '/whatsapp',
                icon: <MessageCircle size={20} />,
              }
            : null,
          canAccessModule(userRole, 'settings')
            ? {
                label: ptBR.layout.navigation.settings,
                href: '/settings',
                icon: <Settings size={20} />,
              }
            : null,
        ].filter(Boolean) as NavGroup['items'],
      },
    ].filter((group) => group.items.length > 0),
    [userRole]
  );

  return (
    <aside
      className={`border-r border-slate-200/80 bg-white/95 backdrop-blur transition-all duration-200 dark:border-slate-800/80 dark:bg-slate-950/90 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        <nav className={`flex-1 overflow-y-auto ${collapsed ? 'px-2 py-4' : 'px-3 py-4'}`}>
          {navGroups.map((group, index) => (
            <div key={`${group.label || 'group'}-${index}`} className="mb-6">
              {group.label && !collapsed ? (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {group.label}
                </h3>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <SidebarNav
                    key={item.href}
                    {...item}
                    isActive={location.pathname === item.href}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
