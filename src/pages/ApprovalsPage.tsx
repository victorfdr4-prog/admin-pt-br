import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  Filter,
  Image as ImageIcon,
  Link as LinkIcon,
  PlayCircle,
  X,
  XCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useApprovals, useDecideApproval } from '@/hooks/useApprovals';
import type { Approval, ApprovalEntityType, ApprovalStatus } from '@/services/approval.service';

type CalendarApprovalItem = {
  id?: string;
  day_number?: number | null;
  post_type?: string | null;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  label_color?: string | null;
  status?: string | null;
  approval_status?: string | null;
  approved_by_name?: string | null;
  post_date?: string | null;
};

type CalendarApprovalMetadata = {
  source?: string;
  calendar_id?: string;
  client_id?: string | null;
  client_name?: string | null;
  month?: number | null;
  month_label?: string | null;
  year?: number | null;
  exported_file_url?: string | null;
  public_approval_url?: string | null;
  public_approval_slug?: string | null;
  items_count?: number | null;
  items?: CalendarApprovalItem[];
  approval_requested_at?: string | null;
};

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; dot: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  approved: { label: 'Aprovado', color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  rejected: { label: 'Rejeitado', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  revision_requested: {
    label: 'Revisão solicitada',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
  },
  cancelled: { label: 'Cancelado', color: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
};

const ENTITY_LABELS: Record<ApprovalEntityType, string> = {
  file: 'Arquivo',
  post: 'Post',
  creative: 'Criativo',
  campaign: 'Campanha',
  task: 'Tarefa',
  calendar_item: 'Calendário',
};

const STATUS_TABS: { id: ApprovalStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'approved', label: 'Aprovados' },
  { id: 'rejected', label: 'Rejeitados' },
  { id: 'revision_requested', label: 'Revisão' },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'agora';
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

function formatDatePtBr(dateStr?: string | null) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function safeCalendarMetadata(approval: Approval): CalendarApprovalMetadata | null {
  if (!approval.metadata || typeof approval.metadata !== 'object') return null;
  const metadata = approval.metadata as CalendarApprovalMetadata;
  if (metadata.source !== 'posting_calendar') return null;
  return metadata;
}

function getReadablePostType(value?: string | null) {
  if (!value) return 'Sem tipo';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

const ApprovalCard: React.FC<{
  approval: Approval;
  selected: boolean;
  onClick: () => void;
}> = ({ approval, selected, onClick }) => {
  const status = STATUS_CONFIG[approval.status];
  const metadata = safeCalendarMetadata(approval);
  const itemsCount = metadata?.items_count ?? metadata?.items?.length ?? null;

  const isOverdue =
    approval.status === 'pending' &&
    approval.due_date &&
    new Date(approval.due_date) < new Date();

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border p-4 transition-all hover:shadow-sm',
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
        isOverdue && 'border-red-200'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border shrink-0',
            status.color
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
          {status.label}
        </span>

        <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
          {ENTITY_LABELS[approval.entity_type]}
        </span>

        {isOverdue && (
          <span className="ml-auto text-[11px] font-medium text-red-600 flex items-center gap-1">
            <Clock size={11} />
            Atrasada
          </span>
        )}
      </div>

      <p className="mt-2 text-sm font-medium text-foreground line-clamp-2">{approval.title}</p>

      {itemsCount !== null && (
        <p className="mt-1 text-xs text-muted-foreground">
          {itemsCount} postagem(ns) neste calendário
        </p>
      )}

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {approval.client_name && <span className="truncate max-w-[160px]">{approval.client_name}</span>}
        <span className="ml-auto shrink-0">{timeAgo(approval.created_at)}</span>
      </div>
    </button>
  );
};

function CalendarApprovalDetails({ approval }: { approval: Approval }) {
  const metadata = safeCalendarMetadata(approval);

  if (!metadata) return null;

  const items = Array.isArray(metadata.items) ? metadata.items : [];
  const exportedFileUrl = metadata.exported_file_url || null;
  const publicApprovalUrl = metadata.public_approval_url || null;
  const monthLabel =
    metadata.month_label && metadata.year
      ? `${metadata.month_label}/${metadata.year}`
      : metadata.month_label || metadata.year
      ? `${metadata.month || ''}/${metadata.year || ''}`
      : null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-background p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Resumo da aprovação</p>
              <p className="text-sm font-medium text-foreground">
                {metadata.client_name || approval.client_name || 'Cliente'}
                {monthLabel ? ` • ${monthLabel}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border px-2 py-1 bg-muted text-foreground">
                {items.length} postagem(ns)
              </span>
              {metadata.approval_requested_at && (
                <span className="rounded-full border px-2 py-1 bg-muted text-foreground">
                  Enviado em {formatDatePtBr(metadata.approval_requested_at)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {exportedFileUrl && (
              <a
                href={exportedFileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <ExternalLink size={14} />
                Abrir arquivo exportado
              </a>
            )}

            {publicApprovalUrl && (
              <a
                href={publicApprovalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <LinkIcon size={14} />
                Abrir link público
              </a>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">Itens do calendário</p>
        {items.length === 0 ? (
          <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
            Nenhum item detalhado encontrado no metadata.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id || `${item.day_number || 'dia'}-${index}`} className="rounded-lg border bg-background p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Dia {String(item.day_number ?? '—').padStart(2, '0')}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
                        style={item.label_color ? { backgroundColor: item.label_color } : undefined}
                      >
                        {getReadablePostType(item.post_type)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-foreground">
                      {item.title || 'Sem título'}
                    </p>

                    {item.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {item.status && (
                      <span className="rounded-full border px-2 py-1 bg-muted text-foreground">
                        Status: {item.status}
                      </span>
                    )}
                    {item.approval_status && (
                      <span className="rounded-full border px-2 py-1 bg-muted text-foreground">
                        Aprovação: {item.approval_status}
                      </span>
                    )}
                  </div>
                </div>

                {(item.notes || item.image_url || item.video_url || item.post_date || item.approved_by_name) && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      {item.post_date && (
                        <div>
                          <p className="text-xs text-muted-foreground">Data</p>
                          <p className="text-sm text-foreground">{formatDatePtBr(item.post_date)}</p>
                        </div>
                      )}

                      {item.notes && (
                        <div>
                          <p className="text-xs text-muted-foreground">Observações</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{item.notes}</p>
                        </div>
                      )}

                      {item.approved_by_name && (
                        <div>
                          <p className="text-xs text-muted-foreground">Aprovado por</p>
                          <p className="text-sm text-foreground">{item.approved_by_name}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {item.image_url && (
                        <a
                          href={item.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-lg border p-2 text-sm hover:bg-muted transition-colors"
                        >
                          <ImageIcon size={14} />
                          Abrir imagem
                        </a>
                      )}

                      {item.video_url && (
                        <a
                          href={item.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-lg border p-2 text-sm hover:bg-muted transition-colors"
                        >
                          <PlayCircle size={14} />
                          Abrir vídeo
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionPanel({
  approval,
  onClose,
}: {
  approval: Approval;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const decide = useDecideApproval();
  const status = STATUS_CONFIG[approval.status];
  const isCalendarApproval = useMemo(
    () => safeCalendarMetadata(approval)?.source === 'posting_calendar',
    [approval]
  );

  const handleDecide = (decision: 'approved' | 'rejected' | 'revision_requested') => {
    decide.mutate({ id: approval.id, decision, notes: notes || undefined }, { onSuccess: onClose });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border',
              status.color
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
            {status.label}
          </span>
          <p className="text-xs text-muted-foreground mt-1">{ENTITY_LABELS[approval.entity_type]}</p>
        </div>

        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{approval.title}</h2>
          {approval.description && (
            <p className="text-sm text-muted-foreground mt-1">{approval.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {approval.client_name && (
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium text-foreground">{approval.client_name}</p>
            </div>
          )}

          {approval.requester_name && (
            <div>
              <p className="text-xs text-muted-foreground">Solicitante</p>
              <p className="font-medium text-foreground">{approval.requester_name}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground">Criado</p>
            <p className="font-medium text-foreground">{timeAgo(approval.created_at)}</p>
          </div>

          {approval.due_date && (
            <div>
              <p className="text-xs text-muted-foreground">Prazo</p>
              <p
                className={cn(
                  'font-medium',
                  new Date(approval.due_date) < new Date() ? 'text-red-600' : 'text-foreground'
                )}
              >
                {new Date(approval.due_date).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}
        </div>

        {isCalendarApproval && <CalendarApprovalDetails approval={approval} />}

        {approval.decision_notes && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground mb-1">Nota da decisão</p>
            <p className="text-sm">{approval.decision_notes}</p>
          </div>
        )}

        {approval.status === 'pending' && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nota (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comentário sobre a decisão..."
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDecide('approved')}
                disabled={decide.isPending}
                className="flex items-center justify-center gap-2 w-full rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 size={15} />
                Aprovar
              </button>

              <button
                onClick={() => handleDecide('revision_requested')}
                disabled={decide.isPending}
                className="flex items-center justify-center gap-2 w-full rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-50 text-sm font-medium py-2.5 transition-colors disabled:opacity-50"
              >
                <FileCheck size={15} />
                Solicitar revisão
              </button>

              <button
                onClick={() => handleDecide('rejected')}
                disabled={decide.isPending}
                className="flex items-center justify-center gap-2 w-full rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-sm font-medium py-2.5 transition-colors disabled:opacity-50"
              >
                <XCircle size={15} />
                Rejeitar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const [activeStatus, setActiveStatus] = useState<ApprovalStatus | 'all'>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterEntity, setFilterEntity] = useState<ApprovalEntityType | ''>('');

  const { data: approvals = [], isLoading } = useApprovals({
    status: activeStatus === 'all' ? undefined : activeStatus,
    entityType: filterEntity || undefined,
  });

  const selected = approvals.find((a) => a.id === selectedId) ?? null;
  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="flex h-full">
      <div className={cn('flex flex-col h-full', selected ? 'w-[420px] border-r' : 'flex-1')}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h1 className="text-base font-semibold text-foreground">Central de Aprovações</h1>
            {pendingCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter size={13} className="text-muted-foreground" />
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value as ApprovalEntityType | '')}
              className="text-xs border border-border rounded-lg px-2 py-1 bg-background text-foreground focus:outline-none"
            >
              <option value="">Todos os tipos</option>
              {(Object.entries(ENTITY_LABELS) as [ApprovalEntityType, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-1 px-4 py-2 border-b overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveStatus(tab.id as ApprovalStatus | 'all')}
              className={cn(
                'text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors',
                activeStatus === tab.id ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[88px] rounded-xl bg-muted animate-pulse" />
            ))
          ) : approvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 size={40} className="text-green-500 mb-3" />
              <p className="text-sm font-medium text-foreground">Tudo em dia!</p>
              <p className="text-xs text-muted-foreground mt-1">Nenhuma aprovação encontrada.</p>
            </div>
          ) : (
            approvals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                selected={selectedId === approval.id}
                onClick={() => setSelectedId(selectedId === approval.id ? null : approval.id)}
              />
            ))
          )}
        </div>
      </div>

      {selected && (
        <div className="flex-1 bg-card">
          <DecisionPanel approval={selected} onClose={() => setSelectedId(null)} />
        </div>
      )}

      {!selected && approvals.length > 0 && (
        <div className="hidden lg:flex flex-1 items-center justify-center text-center p-8">
          <div>
            <ChevronRight size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Selecione uma aprovação para ver os detalhes</p>
          </div>
        </div>
      )}
    </div>
  );
}