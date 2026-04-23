import { useState } from 'react';
import { X, FileText, MessageSquare, Clock, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { VARIANTS } from '@/lib/motion';
import { EditableTitle } from '../ui/EditableTitle';
import { StatusChip } from '../ui/StatusChip';
import { MetaField } from '../ui/MetaField';
import { PriorityDot } from '../ui/PriorityDot';

type Tab = 'details' | 'files' | 'comments' | 'activity';

interface TaskDrawerPremiumProps {
  taskId: string;
  title: string;
  description?: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  clientName: string;
  assignee?: string;
  dueDate?: string;
  fileCount: number;
  commentCount: number;
  isOpen: boolean;
  onClose: () => void;
  onTitleSave?: (newTitle: string) => Promise<void>;
  onStatusChange?: (newStatus: string) => void;
}

export function TaskDrawerPremium({
  taskId,
  title,
  description,
  status,
  priority,
  clientName,
  assignee,
  dueDate,
  fileCount,
  commentCount,
  isOpen,
  onClose,
  onTitleSave,
  onStatusChange,
}: TaskDrawerPremiumProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details');

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        transition={{ type: 'spring', damping: 20 }}
        className="fixed right-0 top-0 z-50 h-full w-96 flex flex-col bg-surface border-l border-border shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <CheckCircle size={20} className="flex-shrink-0 text-text-secondary" />
            <span className="text-xs text-text-tertiary truncate">#{taskId.slice(0, 8)}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-card transition-colors"
            aria-label="Fechar"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* Title */}
        <div className="px-6 py-4 border-b border-border flex-shrink-0">
          <EditableTitle
            value={title}
            onSave={onTitleSave || (async () => {})}
            size="md"
          />
          <p className="text-sm text-text-secondary mt-2">{clientName}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border px-6 flex-shrink-0">
          {(['details', 'files', 'comments', 'activity'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab === 'details' && 'Detalhes'}
              {tab === 'files' && `Arquivos (${fileCount})`}
              {tab === 'comments' && `Comentários (${commentCount})`}
              {tab === 'activity' && 'Atividade'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' && (
            <div className="space-y-4 p-6">
              {description && (
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-2">
                    Descrição
                  </h4>
                  <p className="text-sm text-text-secondary">{description}</p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-3">
                  Informações
                </h4>
                <div className="space-y-2">
                  <MetaField label="Status" value={status} />
                  <MetaField
                    label="Prioridade"
                    value={
                      <PriorityDot priority={priority} showLabel size="sm" />
                    }
                  />
                  {assignee && (
                    <MetaField label="Responsável" value={assignee} />
                  )}
                  {dueDate && (
                    <MetaField label="Vencimento" value={dueDate} />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="p-6">
              <div className="text-center py-8">
                <FileText size={32} className="mx-auto mb-2 text-text-tertiary" />
                <p className="text-sm text-text-secondary">
                  {fileCount > 0 ? `${fileCount} arquivo(s)` : 'Nenhum arquivo'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="p-6">
              <div className="text-center py-8">
                <MessageSquare
                  size={32}
                  className="mx-auto mb-2 text-text-tertiary"
                />
                <p className="text-sm text-text-secondary">
                  {commentCount > 0
                    ? `${commentCount} comentário(s)`
                    : 'Nenhum comentário'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="p-6">
              <div className="text-center py-8">
                <Clock size={32} className="mx-auto mb-2 text-text-tertiary" />
                <p className="text-sm text-text-secondary">
                  Histórico de atividade
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border px-6 py-4 flex-shrink-0 flex gap-2">
          <button className="flex-1 rounded-md bg-primary text-white py-2 font-medium hover:bg-primary/90 transition-colors">
            Salvar
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border text-text-primary py-2 font-medium hover:bg-card transition-colors"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </>
  );
}
