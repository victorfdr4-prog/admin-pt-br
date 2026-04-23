import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Users, Flag, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskDetail {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string;
  assignee?: string;
  attachments?: Array<{ id: string; name: string }>;
}

interface TaskDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task?: TaskDetail;
  onUpdate?: (task: TaskDetail) => Promise<void>;
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'Em progresso', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Concluído', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

const priorityConfig = {
  low: { label: 'Baixa', color: 'text-gray-600' },
  medium: { label: 'Média', color: 'text-amber-600' },
  high: { label: 'Alta', color: 'text-orange-600' },
  urgent: { label: 'Urgente', color: 'text-red-600' },
};

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  isOpen,
  onClose,
  task,
  onUpdate,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [editedTask, setEditedTask] = useState<TaskDetail | undefined>(task);

  React.useEffect(() => {
    setEditedTask(task);
  }, [task]);

  const handleSave = async () => {
    if (!editedTask) return;
    setIsLoading(true);
    try {
      await onUpdate?.(editedTask);
      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!task) return null;

  const status = statusConfig[editedTask?.status || 'pending'];
  const priority = priorityConfig[editedTask?.priority || 'medium'];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ opacity: 0, x: 384 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 384 }}
            className="fixed inset-y-0 right-0 z-50 w-96 bg-white border-l border-border shadow-lg overflow-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-foreground">Detalhes da tarefa</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1 hover:bg-border rounded-lg transition-colors"
              >
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Title */}
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{editedTask?.title}</h3>
                <p className="text-sm text-muted-foreground">{editedTask?.description}</p>
              </div>

              {/* Status and Priority */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
                  <div className={cn('inline-flex px-3 py-1 rounded-full text-sm font-medium', status.color)}>
                    {status.label}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Prioridade</p>
                  <div className={cn('text-sm font-medium', priority.color)}>
                    {priority.label}
                  </div>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={16} className="text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Data de vencimento</p>
                </div>
                <p className="text-sm text-foreground">
                  {editedTask?.dueDate ? new Date(editedTask.dueDate).toLocaleDateString('pt-BR') : 'Sem data'}
                </p>
              </div>

              {/* Assignee */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Responsável</p>
                </div>
                <p className="text-sm text-foreground">{editedTask?.assignee || 'Não atribuído'}</p>
              </div>

              {/* Attachments */}
              {editedTask?.attachments && editedTask.attachments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Anexos</p>
                  <div className="space-y-2">
                    {editedTask.attachments.map((file) => (
                      <div key={file.id} className="p-3 rounded-lg border border-border bg-muted/30">
                        <p className="text-sm text-foreground truncate">{file.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments section placeholder */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={16} className="text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Comentários</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 h-32 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Nenhum comentário</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-border/30 transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isLoading}
                  className={cn(
                    'flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    isLoading
                      ? 'bg-primary/50 text-primary-foreground cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  {isLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
