import React, { useState } from 'react';
import {
  Plus,
  Inbox,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  User,
  Calendar,
  Tag,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useIntakeRequests, useUpdateIntakeStatus, useCreateTaskFromIntake } from '@/hooks/useIntake';
import { useIntakeTemplates, useCreateIntakeRequest } from '@/hooks/useIntake';
import { IntakeForm } from '@/components/IntakeForm';
import type { IntakeRequest, IntakeStatus, IntakeType } from '@/services/intake.service';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// -----------------------------------------------
// Constants
// -----------------------------------------------

const STATUS_TABS: { key: IntakeStatus | 'all'; label: string; icon: React.ElementType }[] = [
  { key: 'all',         label: 'Todas',        icon: Inbox },
  { key: 'new',         label: 'Novas',        icon: AlertCircle },
  { key: 'triaged',     label: 'Triadas',      icon: ArrowRight },
  { key: 'in_progress', label: 'Em Andamento', icon: Clock },
  { key: 'completed',   label: 'Concluídas',   icon: CheckCircle2 },
  { key: 'cancelled',   label: 'Canceladas',   icon: XCircle },
];

const STATUS_STYLE: Record<IntakeStatus, { bg: string; text: string; label: string }> = {
  new:         { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-300',   label: 'Nova' },
  triaged:     { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Triada' },
  in_progress: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'Em Andamento' },
  completed:   { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Concluída' },
  cancelled:   { bg: 'bg-muted',                          text: 'text-muted-foreground',               label: 'Cancelada' },
};

const PRIORITY_STYLE: Record<string, { dot: string; label: string }> = {
  low:    { dot: 'bg-slate-400',  label: 'Baixa' },
  medium: { dot: 'bg-amber-400',  label: 'Média' },
  high:   { dot: 'bg-orange-500', label: 'Alta' },
  urgent: { dot: 'bg-red-500',    label: 'Urgente' },
};

const TYPE_LABEL: Record<IntakeType, string> = {
  general:    'Geral',
  creative:   'Criativo',
  campaign:   'Campanha',
  support:    'Suporte',
  onboarding: 'Onboarding',
  internal:   'Interno',
};

// -----------------------------------------------
// Card
// -----------------------------------------------

const IntakeCard: React.FC<{
  request: IntakeRequest;
  onUpdateStatus: (id: string, status: IntakeStatus) => void;
  onCreateTask: (id: string) => void;
  isUpdating: boolean;
}> = ({ request, onUpdateStatus, onCreateTask, isUpdating }) => {
  const st = STATUS_STYLE[request.status];
  const pr = PRIORITY_STYLE[request.priority] ?? PRIORITY_STYLE.medium;

  const nextStatus: Partial<Record<IntakeStatus, IntakeStatus>> = {
    new: 'triaged',
    triaged: 'in_progress',
    in_progress: 'completed',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="rounded-2xl border border-border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{request.title}</p>
          {request.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{request.description}</p>
          )}
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', st.bg, st.text)}>
          {st.label}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className={cn('h-2 w-2 rounded-full', pr.dot)} />
          {pr.label}
        </span>
        <span className="flex items-center gap-1">
          <Tag size={10} />
          {TYPE_LABEL[request.type] ?? request.type}
        </span>
        {request.client_name && (
          <span className="flex items-center gap-1">
            <User size={10} />
            {request.client_name}
          </span>
        )}
        {request.assignee_name && (
          <span className="flex items-center gap-1">
            <User size={10} />
            {request.assignee_name}
          </span>
        )}
        {request.deadline && (
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            {new Date(request.deadline).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      {/* Actions */}
      {request.status !== 'completed' && request.status !== 'cancelled' && (
        <div className="flex items-center gap-2 pt-1">
          {nextStatus[request.status] && (
            <button
              onClick={() => onUpdateStatus(request.id, nextStatus[request.status]!)}
              disabled={isUpdating}
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <ArrowRight size={12} />
              Avançar
            </button>
          )}
          {request.status === 'triaged' && request.client_id && (
            <button
              onClick={() => onCreateTask(request.id)}
              disabled={isUpdating}
              className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors disabled:opacity-50"
            >
              <Plus size={12} />
              Criar tarefa
            </button>
          )}
          <button
            onClick={() => onUpdateStatus(request.id, 'cancelled')}
            disabled={isUpdating}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"
          >
            <XCircle size={12} />
            Cancelar
          </button>
        </div>
      )}
    </motion.div>
  );
};

// -----------------------------------------------
// Page
// -----------------------------------------------

const IntakePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<IntakeStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const { data: requests = [], isLoading } = useIntakeRequests(
    activeTab !== 'all' ? { status: activeTab } : undefined
  );
  const { data: templates = [] } = useIntakeTemplates();
  const updateStatus = useUpdateIntakeStatus();
  const createTask = useCreateTaskFromIntake();
  const createRequest = useCreateIntakeRequest();

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0] ?? null;

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Solicitações</p>
          <h1 className="mt-1 text-lg font-semibold text-foreground">Fila de pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Triagem, andamento e conversão em tarefa.</p>
        </div>
        <button
          onClick={() => navigate('/portal/solicitar')}
          className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Nova solicitação
        </button>
      </div>

      {/* New request form */}
      <AnimatePresence>
        {showForm && selectedTemplate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Registrar solicitação</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Template:</label>
                  <select
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                    value={selectedTemplateId || selectedTemplate.id}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <IntakeForm
                template={selectedTemplate}
                onSubmit={(payload) => {
                  createRequest.mutate(payload, {
                    onSuccess: () => setShowForm(false),
                  });
                }}
                isPending={createRequest.isPending}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {STATUS_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
              activeTab === key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Inbox size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma solicitação</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {activeTab === 'all'
              ? 'Crie a primeira solicitação usando o botão acima.'
              : `Nenhuma solicitação com status "${STATUS_TABS.find((t) => t.key === activeTab)?.label}".`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {requests.map((req) => (
              <IntakeCard
                key={req.id}
                request={req}
                onUpdateStatus={(id, status) => updateStatus.mutate({ id, status })}
                onCreateTask={(id) => createTask.mutate(id)}
                isUpdating={updateStatus.isPending || createTask.isPending}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default IntakePage;
