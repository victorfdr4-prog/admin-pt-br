import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, LayoutDashboard, Users, Kanban, CalendarDays, ShieldCheck,
  DollarSign, HardDrive, FileText, Settings, Inbox, User,
  ChevronRight, Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ptBR } from '@/lib/ptBR';
import { useAuthStore } from '@/store/useAuthStore';
import { canAccessModule } from '@/domain/accessControl';
import { supabase } from '@/lib/supabase';
import { buildDriveFileUrl } from '@/services/_shared';
import { useBoardStore } from '@/store/useBoardStore';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  group: string;
  keywords?: string[];
}

interface SearchEntityItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  group: string;
}

// ─────────────────────────────────────────────────────
// Hook global para abrir/fechar
// ─────────────────────────────────────────────────────
let _setOpen: ((v: boolean) => void) | null = null;

export const openCommandPalette = () => _setOpen?.(true);
export const closeCommandPalette = () => _setOpen?.(false);

// ─────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────
export const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const userRole = useAuthStore((state) => state.user?.role);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [entityResults, setEntityResults] = useState<SearchEntityItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Registrar setter global
  useEffect(() => {
    _setOpen = setOpen;
    return () => { _setOpen = null; };
  }, []);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const go = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
    setQuery('');
  }, [navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  const items: CommandItem[] = useMemo(() => [
    // Navegação
    canAccessModule(userRole, 'dashboard') ? { id: 'dashboard',    group: ptBR.commandPalette.groups.navigation, icon: LayoutDashboard, label: ptBR.layout.dashboard,           action: () => go('/dashboard'),          keywords: ['inicio', 'painel', 'operacao'] } : null,
    canAccessModule(userRole, 'boards') ? { id: 'boards',       group: ptBR.commandPalette.groups.navigation, icon: Kanban,          label: 'Quadro de tarefas',   action: () => go('/boards'),             keywords: ['kanban', 'tasks', 'tarefas'] } : null,
    canAccessModule(userRole, 'clients') ? { id: 'clients',      group: ptBR.commandPalette.groups.navigation, icon: Users,           label: 'Clientes',             action: () => go('/clients'),            keywords: ['client', 'empresa'] } : null,
    canAccessModule(userRole, 'posting_calendar') ? { id: 'calendar',     group: ptBR.commandPalette.groups.navigation, icon: CalendarDays,    label: 'Calendário de posts',  action: () => go('/posting-calendar'),   keywords: ['posts', 'publicações'] } : null,
    canAccessModule(userRole, 'posting_calendar') && canAccessModule(userRole, 'content_approvals') ? { id: 'approvals',    group: ptBR.commandPalette.groups.navigation, icon: ShieldCheck,     label: 'Central · Aprovações',    action: () => go('/hub?tab=approvals'),  keywords: ['aprovar', 'revisao', 'central', 'cliente', 'agenda'] } : null,
    canAccessModule(userRole, 'posting_calendar') && canAccessModule(userRole, 'intake') ? { id: 'intake',       group: ptBR.commandPalette.groups.navigation, icon: Inbox,           label: 'Central · Solicitações',   action: () => go('/hub?tab=requests'),   keywords: ['solicitacao', 'pedido', 'central', 'intake'] } : null,
    canAccessModule(userRole, 'drive') ? { id: 'drive',        group: ptBR.commandPalette.groups.navigation, icon: HardDrive,       label: 'Drive',                action: () => go('/drive'),              keywords: ['arquivo', 'file'] } : null,
    canAccessModule(userRole, 'documents') ? { id: 'documents',    group: ptBR.commandPalette.groups.navigation, icon: FileText,        label: 'Documentos',           action: () => go('/documents'),          keywords: ['doc', 'proposta'] } : null,
    canAccessModule(userRole, 'finance') ? { id: 'finance',      group: ptBR.commandPalette.groups.navigation, icon: DollarSign,      label: 'Financeiro',           action: () => go('/finance'),            keywords: ['money', 'dinheiro', 'pagamento'] } : null,
    canAccessModule(userRole, 'team') ? { id: 'team',         group: ptBR.commandPalette.groups.navigation, icon: User,            label: ptBR.layout.navigation.team, action: () => go('/team'), keywords: ['equipe', 'membros', 'acesso'] } : null,
    canAccessModule(userRole, 'settings') ? { id: 'settings',     group: ptBR.commandPalette.groups.navigation, icon: Settings,        label: 'Configurações',        action: () => go('/settings'),           keywords: ['config', 'preferências'] } : null,
    // Ações rápidas
    canAccessModule(userRole, 'clients') ? { id: 'new-client',   group: ptBR.commandPalette.groups.actions,     icon: Users,           label: 'Novo cliente',         description: 'Cadastrar cliente rápido', action: () => { go('/clients'); setTimeout(() => window.dispatchEvent(new CustomEvent('cromia:quick-create-client')), 100); } } : null,
    canAccessModule(userRole, 'posting_calendar') ? { id: 'new-post',     group: ptBR.commandPalette.groups.actions,     icon: CalendarDays,    label: 'Nova publicação',      description: 'Abrir calendário',         action: () => go('/posting-calendar') } : null,
    canAccessModule(userRole, 'settings') ? { id: 'settings-profile', group: ptBR.commandPalette.groups.actions, icon: Settings,       label: 'Editar perfil',        description: 'Configurações → Perfil',   action: () => go('/settings?tab=profile') } : null,
  ].filter(Boolean) as CommandItem[], [go, userRole]);

  useEffect(() => {
    let cancelled = false;

    const searchEntities = async () => {
      const term = debouncedQuery.trim();
      if (term.length < 2) {
        setEntityResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      const escaped = term.replace(/[%_]/g, '');
      const likeTerm = `%${escaped}%`;

      try {
        const [tasksRes, clientsRes, filesRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('id, title, board_id, client_id, clients!tasks_client_id_fkey(name)')
            .ilike('title', likeTerm)
            .limit(5),
          supabase
            .from('clients')
            .select('id, name, industry, segment')
            .or(`name.ilike.${likeTerm},industry.ilike.${likeTerm},segment.ilike.${likeTerm}`)
            .limit(5),
          supabase
            .from('drive_files')
            .select('id, name, file_id, client_id, clients(name)')
            .ilike('name', likeTerm)
            .limit(5),
        ]);

        if (cancelled) return;

        const taskItems: SearchEntityItem[] = (tasksRes.data || []).map((task: any) => ({
          id: `task-${task.id}`,
          group: 'Resultados · Tarefas',
          icon: Kanban,
          label: task.title || 'Tarefa sem título',
          description: (task.clients as { name?: string } | null)?.name
            ? `Abrir no quadro • ${(task.clients as { name?: string }).name}`
            : 'Abrir no quadro operacional',
          action: () => {
            const boardStore = useBoardStore.getState();
            if (task.board_id) boardStore.setActiveBoardId(String(task.board_id));
            boardStore.setOpenTaskId(String(task.id));
            go('/boards');
          },
        }));

        const clientItems: SearchEntityItem[] = (clientsRes.data || []).map((client: any) => ({
          id: `client-${client.id}`,
          group: 'Resultados · Clientes',
          icon: Users,
          label: client.name || 'Cliente sem nome',
          description: [client.industry, client.segment].filter(Boolean).join(' • ') || 'Abrir registro do cliente',
          action: () => go(`/clients?client=${encodeURIComponent(String(client.id))}`),
        }));

        const fileItems: SearchEntityItem[] = (filesRes.data || []).map((file: any) => ({
          id: `file-${file.id}`,
          group: 'Resultados · Arquivos',
          icon: HardDrive,
          label: file.name || 'Arquivo sem nome',
          description: (file.clients as { name?: string } | null)?.name
            ? `Google Drive • ${(file.clients as { name?: string }).name}`
            : 'Google Drive',
          action: () => {
            setOpen(false);
            setQuery('');
            if (file.file_id) {
              window.open(buildDriveFileUrl(String(file.file_id)), '_blank', 'noopener,noreferrer');
              return;
            }
            go('/drive');
          },
        }));

        setEntityResults([...taskItems, ...clientItems, ...fileItems]);
      } catch (error) {
        console.error('Falha ao pesquisar tarefas, clientes e arquivos.', error);
        if (!cancelled) setEntityResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };

    void searchEntities();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, go]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const commandMatches = !q
      ? items
      : items.filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.keywords?.some((k) => k.includes(q)) ||
      item.group.toLowerCase().includes(q)
    );

    return q ? [...entityResults, ...commandMatches] : commandMatches;
  }, [entityResults, items, query]);

  // Agrupa resultados
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach((item) => {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const flatList = filtered;

  // Reset index ao filtrar
  useEffect(() => { setActiveIndex(0); }, [query]);

  // Foco ao abrir
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flatList[activeIndex]?.action();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Índice global no flat list
  let flatIdx = -1;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: 'spring', stiffness: 600, damping: 40 }}
            className="relative z-10 w-full max-w-[560px] rounded-2xl bg-white shadow-2xl border border-border/60 overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-[#f0f2f5] px-4 py-3.5">
              <Search size={16} className="shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={ptBR.commandPalette.searchPlaceholder}
                className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-[11px] text-muted-foreground hover:text-foreground bg-muted px-1.5 py-0.5 rounded"
                >
                  {ptBR.commandPalette.shortcuts.clear}
                </button>
              )}
              <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground font-mono">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[360px] overflow-y-auto minimal-scrollbar py-2">
              {searching && (
                <div className="px-4 pb-2 text-[11px] font-medium text-muted-foreground">
                  Buscando tarefas, clientes e arquivos...
                </div>
              )}
              {grouped.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Search size={22} className="text-muted-foreground/40" />
                  <p className="text-[13px] text-muted-foreground">{ptBR.commandPalette.emptyResults(query)}</p>
                </div>
              ) : (
                grouped.map(([group, groupItems]) => (
                  <div key={group} className="mb-1">
                    <p className="mx-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                      {group}
                    </p>
                    {groupItems.map((item) => {
                      flatIdx++;
                      const thisIdx = flatIdx;
                      const isActive = activeIndex === thisIdx;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={item.action}
                          onMouseEnter={() => setActiveIndex(thisIdx)}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                            isActive ? 'bg-foreground/5' : 'hover:bg-foreground/[0.03]'
                          )}
                        >
                          <div className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60',
                            isActive ? 'bg-foreground text-white border-transparent' : 'bg-white text-muted-foreground'
                          )}>
                            <item.icon size={14} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-foreground leading-tight">{item.label}</p>
                            {item.description && (
                              <p className="text-[11px] text-muted-foreground">{item.description}</p>
                            )}
                          </div>

                          {isActive && (
                            <ChevronRight size={13} className="shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between border-t border-[#f5f6f8] px-4 py-2.5 bg-[#fafbfc]">
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border px-1 font-mono text-[10px]">↑↓</kbd>
                  {ptBR.commandPalette.shortcuts.navigate}
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border px-1 font-mono text-[10px]">↵</kbd>
                  {ptBR.commandPalette.shortcuts.open}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                <Clock size={10} />
                {ptBR.commandPalette.shortcuts.reopen}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
