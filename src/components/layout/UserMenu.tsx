import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut, 
  User as UserIcon, 
  Key, 
  Settings, 
  ChevronDown,
  Mail,
  Shield
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/utils/cn';
import { useNavigate } from 'react-router-dom';

export function UserMenu() {
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';

  const menuItems = [
    { 
      label: 'Meu perfil', 
      icon: UserIcon, 
      action: () => { navigate('/settings?tab=profile'); setIsOpen(false); } 
    },
    { 
      label: 'Trocar senha', 
      icon: Key, 
      action: () => { navigate('/settings?tab=security'); setIsOpen(false); } 
    },
    { 
      label: 'Configurações', 
      icon: Settings, 
      action: () => { navigate('/settings'); setIsOpen(false); } 
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-full transition-all interactive-card",
          isOpen ? "bg-slate-100 dark:bg-slate-800 ring-2 ring-primary/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
        )}
      >
        <div className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-white shadow-sm dark:border-slate-800">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary-900 text-sm font-bold text-white">
              {initials}
            </div>
          )}
          <div className="absolute inset-0 bg-black/5" />
        </div>
        
        <div className="hidden text-left md:block">
          <p className="text-[13px] font-bold text-slate-900 leading-none dark:text-slate-100">{user.name}</p>
          <p className="mt-1 text-[11px] font-medium text-slate-500 uppercase tracking-tight">{user.role_label || 'Usuário'}</p>
        </div>

        <ChevronDown size={14} className={cn("text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-[22px] bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 dark:bg-slate-900 dark:border-slate-800 z-50"
          >
            {/* User Info Header */}
            <div className="px-3 py-4 border-b border-slate-50 dark:border-slate-800 mb-1">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate dark:text-slate-100">{user.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                    <Mail size={12} />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="space-y-0.5">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white group"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 group-hover:bg-primary/10 transition-colors dark:bg-slate-800">
                    <item.icon size={16} className="text-slate-500 group-hover:text-primary transition-colors" />
                  </div>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Logout Footer */}
            <div className="mt-1 pt-1 border-t border-slate-50 dark:border-slate-800">
              <button
                onClick={() => { logout(); setIsOpen(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-rose-500 transition-all hover:bg-rose-50 dark:hover:bg-rose-950/30 group"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 group-hover:bg-rose-100 transition-colors dark:bg-rose-950/50">
                  <LogOut size={16} />
                </div>
                Sair da conta
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
