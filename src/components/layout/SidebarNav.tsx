import { Link } from 'react-router-dom';

interface SidebarNavProps {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  isActive: boolean;
  collapsed?: boolean;
}

export function SidebarNav({
  label,
  href,
  icon,
  badge,
  isActive,
  collapsed = false,
}: SidebarNavProps) {
  return (
    <Link
      to={href}
      title={collapsed ? label : undefined}
      className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all ${
        isActive
          ? 'bg-[linear-gradient(135deg,#1b1c15_0%,#9aca52_100%)] text-white shadow-[0_18px_36px_rgba(154,202,82,0.28)]'
          : 'text-slate-700 hover:bg-[#f5f9eb] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      } ${collapsed ? 'justify-center px-2' : ''}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
          isActive ? 'bg-white/16 text-white' : 'bg-[linear-gradient(135deg,#f0f8df_0%,#fbfdf4_100%)] text-[#6f8f2f]'
        }`}
      >
        {icon}
      </span>
      {!collapsed ? <span className="flex-1">{label}</span> : null}
      {!collapsed && badge !== undefined ? (
        <span className="rounded-full bg-error/20 px-2 py-0.5 text-xs font-semibold text-error">
          {badge}
        </span>
      ) : null}
      {collapsed && badge !== undefined ? (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-error" />
      ) : null}
    </Link>
  );
}
