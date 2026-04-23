import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  RefreshCw,
  Search,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from '@/components/ui/sonner';
import { cn, formatDate } from '@/utils/cn';
import { OnboardingService } from '@/services';
import { subscribeRealtimeChange } from '@/lib/realtime';

interface OnboardingTask {
  id: string;
  client_id: string | null;
  client_name: string | null;
  title: string;
  description?: string | null;
  status: 'pending' | 'completed';
  required?: boolean | null;
  due_date?: string | null;
  completed_at?: string | null;
}

const normalizeTask = (task: any): OnboardingTask => ({
  id: String(task.id),
  client_id: task.client_id ? String(task.client_id) : null,
  client_name: task.client_name ? String(task.client_name) : null,
  title: String(task.title || 'Sem título'),
  description: task.description ? String(task.description) : null,
  status: task.status === 'completed' ? 'completed' : 'pending',
  required: task.required ?? null,
  due_date: task.due_date ? String(task.due_date) : null,
  completed_at: task.completed_at ? String(task.completed_at) : null,
});

export const OnboardingPage: React.FC = () => {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedClients, setCollapsedClients] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await OnboardingService.getAll();
      setTasks((data || []).map(normalizeTask));
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar o onboarding.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  useEffect(() => {
    return subscribeRealtimeChange((detail) => {
      if (detail.schema !== 'public' || detail.table !== 'onboarding_tasks') return;

      const row = detail.eventType === 'DELETE' ? detail.oldRow : detail.newRow;
      if (!row) return;

      const normalized = normalizeTask(row);
      setTasks((current) => {
        if (detail.eventType === 'DELETE') {
          return current.filter((task) => task.id !== normalized.id);
        }

        const exists = current.some((task) => task.id === normalized.id);
        return exists
          ? current.map((task) => (task.id === normalized.id ? normalized : task))
          : [normalized, ...current];
      });
    });
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return tasks;

    return tasks.filter((task) => {
      return (
        task.title.toLowerCase().includes(q) ||
        (task.client_name || '').toLowerCase().includes(q) ||
        (task.description || '').toLowerCase().includes(q)
      );
    });
  }, [tasks, searchTerm]);

  const grouped = useMemo(() => {
    const map = new Map<string, OnboardingTask[]>();

    filtered.forEach((task) => {
      const key = task.client_name || 'Sem cliente';
      const items = map.get(key) || [];
      items.push(task);
      map.set(key, items);
    });

    return Array.from(map.entries()).map(([name, items]) => {
      const completed = items.filter((item) => item.status === 'completed').length;
      const pending = items.length - completed;
      const progress = items.length ? Math.round((completed / items.length) * 100) : 0;
      return { name, tasks: items, completed, pending, total: items.length, progress };
    });
  }, [filtered]);

  const summary = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === 'completed').length;
    const pending = total - completed;
    const clients = new Set(tasks.map((task) => task.client_name || 'Sem cliente')).size;
    return { total, completed, pending, clients, rate: total ? Math.round((completed / total) * 100) : 0 };
  }, [tasks]);

  const toggleTask = async (task: OnboardingTask) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    const snapshot = tasks;
    const now = new Date().toISOString();
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, status: nextStatus, completed_at: nextStatus === 'completed' ? now : null }
          : item
      )
    );
    setSavingTaskId(task.id);

    try {
      await OnboardingService.updateStatus(task.id, nextStatus);
    } catch (error) {
      console.error(error);
      setTasks(snapshot);
      toast.error('Não foi possível atualizar a etapa.');
    } finally {
      setSavingTaskId(null);
    }
  };

  if (loading) {
    return (
<div className="mx-auto flex min-h-full w-full max-w-[1560px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6 xl:px-8">
<div className="premium-card flex min-h-[180px] items-center justify-center p-5">
          <div className="flex items-center gap-3 text-muted-foreground">
            <RefreshCw size={18} className="animate-spin text-primary" />
            <span className="text-ui-meta">Carregando implantação...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
<div className="mx-auto flex min-h-full w-full max-w-[1560px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6 xl:px-8">
      <section className="premium-card overflow-hidden">
        <div className="border-b border-border/70 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Implantação</h1>
              <p className="mt-1 text-sm text-muted-foreground">Checklist de entrada e organização inicial dos clientes ativos.</p>
            </div>

            <button type="button" onClick={() => void loadTasks()} className="btn-secondary">
              <RefreshCw size={16} />
              Atualizar
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar cliente, tarefa ou observação"
                className="field-control pl-11"
              />
            </div>
            <span className="text-ui-meta">
              {summary.clients} clientes • {summary.completed} concluídas • {summary.pending} pendentes • {summary.rate}%
            </span>
          </div>
        </div>

      </section>

      <div className="space-y-4">
        {grouped.map((group) => {
          const isCollapsed = collapsedClients[group.name];

          return (
            <section key={group.name} className="premium-card overflow-hidden">
              <button
                type="button"
                onClick={() => setCollapsedClients((current) => ({ ...current, [group.name]: !current[group.name] }))}
                className="interactive-list-clickable flex w-full items-center gap-3 border-b border-border/70 px-4 py-2.5 text-left"
              >
                <motion.div animate={{ rotate: isCollapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
                  <ChevronRight size={15} className="text-muted-foreground" />
                </motion.div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-ui-title">{group.name}</h2>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={cn(
                          'h-full rounded-full transition-[width] duration-[120ms] ease-out',
                          group.progress === 100 ? 'bg-status-success' : 'bg-primary'
                        )}
                        style={{ width: `${group.progress}%` }}
                      />
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {!isCollapsed ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="divide-y divide-border/70">
                      {group.tasks.map((task) => {
                        const isDone = task.status === 'completed';
                        return (
                          <div key={task.id} className="interactive-list-item flex flex-wrap items-start gap-3 px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => void toggleTask(task)}
                              disabled={savingTaskId === task.id}
                              className="mt-0.5 shrink-0"
                            >
                              {isDone ? (
                                <CheckCircle2 size={18} className="text-status-success" />
                              ) : (
                                <Circle size={18} className="text-muted-foreground/40 transition-colors hover:text-primary" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={cn('text-ui-title', isDone ? 'text-ui-attr line-through' : 'text-foreground')}>
                                  {task.title}
                                </p>
                                {task.required ? <span className="pill pill-warning">Obrigatória</span> : null}
                              </div>
                              {task.description ? <p className="mt-1 text-ui-meta">{task.description}</p> : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={cn('status-badge', isDone ? 'status-badge-done' : 'status-badge-todo')}>
                                {isDone ? 'Concluída' : 'Pendente'}
                              </span>
                              {task.due_date ? (
                                <span className="pill pill-muted">
                                  <Clock3 size={12} />
                                  {formatDate(task.due_date)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>
          );
        })}

        {!grouped.length ? (
          <div className="premium-card px-6 py-12 text-center text-ui-meta">Nenhuma etapa de implantação encontrada para este filtro.</div>
        ) : null}
      </div>
    </div>
  );
};

export default OnboardingPage;
