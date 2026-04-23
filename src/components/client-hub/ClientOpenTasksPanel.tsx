import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { VARIANTS } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface OpenTask {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'overdue';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assignee?: string;
  onClick?: () => void;
}

interface ClientOpenTasksPanelProps {
  tasks: OpenTask[];
  viewAllHref?: string;
  onViewAll?: () => void;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
}

const PriorityDot: React.FC<{ priority?: string }> = ({ priority }) => {
  const config = {
    low: 'bg-slate-400',
    medium: 'bg-blue-500',
    high: 'bg-amber-500',
    urgent: 'bg-rose-500',
  };

  return <div className={cn('h-2 w-2 rounded-full', config[priority as keyof typeof config] || 'bg-slate-300')} />;
};

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Clock size={16} className="text-amber-600" />;
    case 'in_progress':
      return <CheckCircle2 size={16} className="text-blue-600" />;
    case 'overdue':
      return <AlertTriangle size={16} className="text-rose-600" />;
    default:
      return null;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending':
      return 'Pendente';
    case 'in_progress':
      return 'Em andamento';
    case 'overdue':
      return 'Atrasada';
    default:
      return status;
  }
};

export const ClientOpenTasksPanel: React.FC<ClientOpenTasksPanelProps> = ({
  tasks,
  viewAllHref,
  onViewAll,
  isEmpty = false,
  emptyMessage = 'Nenhuma tarefa aberta',
  className,
}) => {
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const overdueCount = tasks.filter((t) => t.status === 'overdue').length;

  return (
    <motion.div
      variants={VARIANTS.slideInUp}
      initial="hidden"
      animate="visible"
      className={cn('rounded-2xl border border-border bg-white overflow-hidden', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h3 className="font-semibold text-foreground">Tarefas em aberto</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {pendingCount} pendente{pendingCount !== 1 ? 's' : ''} • {inProgressCount} em andamento • {overdueCount} atrasada{overdueCount !== 1 ? 's' : ''}
          </p>
        </div>

        {(viewAllHref || onViewAll) && (
          <motion.button
            type="button"
            onClick={onViewAll}
            whileHover={{ x: 4 }}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline flex-shrink-0"
          >
            Ver todas <ArrowRight size={14} />
          </motion.button>
        )}
      </div>

      {/* Content */}
      {isEmpty || tasks.length === 0 ? (
        <div className="flex h-40 items-center justify-center px-6 py-8">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {tasks.slice(0, 5).map((task, index) => (
            <motion.button
              key={task.id}
              type="button"
              onClick={task.onClick}
              custom={index}
              variants={{
                hidden: { opacity: 0, x: -10 },
                visible: {
                  opacity: 1,
                  x: 0,
                  transition: { delay: index * 0.05 },
                },
              }}
              initial="hidden"
              animate="visible"
              whileHover={{ x: 4 }}
              className={cn(
                'interactive-list-clickable w-full px-6 py-3 text-left transition-colors',
                task.status === 'overdue' ? 'hover:bg-rose-50/30' : 'hover:bg-border/30'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1.5 pt-0.5">
                    <PriorityDot priority={task.priority} />
                    <StatusIcon status={task.status} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground">
                        {getStatusLabel(task.status)}
                      </span>
                      {task.dueDate && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(task.dueDate).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {task.assignee && (
                        <span className="text-xs text-muted-foreground truncate">
                          por {task.assignee}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <ArrowRight size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Footer if more than 5 */}
      {tasks.length > 5 && (
        <div className="border-t border-border px-6 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            +{tasks.length - 5} tarefa{tasks.length - 5 !== 1 ? 's' : ''} não mostrada{tasks.length - 5 !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </motion.div>
  );
};
