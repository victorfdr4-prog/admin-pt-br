import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ContentApprovalService,
  type ApprovalItemStatus,
  type CalendarChecklistField,
  type CentralApprovalQueueItem,
  type CreateContentApprovalPayload,
  type DecideItemPayload,
  type CreateApprovalItemPayload,
} from '@/services/content-approval.service';

// ─── Listagem ─────────────────────────────────────────────────────────────────

/** Hook para buscar a lista de pacotes de aprovação com filtros opcionais */
export function useContentApprovals(opts?: {
  status?: string;
  clientId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['content-approvals', opts?.status ?? 'all', opts?.clientId ?? 'all'],
    queryFn: () => ContentApprovalService.getAll(opts),
    staleTime: 30_000,
  });
}

export function useCentralApprovalQueue(opts?: {
  clientId?: string;
  status?: string;
  limit?: number;
}) {
  return useQuery<CentralApprovalQueueItem[]>({
    queryKey: ['content-approvals', 'central-queue', opts?.clientId ?? 'all', opts?.status ?? 'all'],
    queryFn: () => ContentApprovalService.getCentralQueue(opts as any),
    staleTime: 20_000,
  });
}

// ─── Detalhe Único ────────────────────────────────────────────────────────────

/** Hook para buscar um pacote de aprovação específico pelo ID */
export function useContentApproval(id: string | null) {
  return useQuery({
    queryKey: ['content-approvals', 'detail', id],
    queryFn: () => ContentApprovalService.getById(id!),
    enabled: !!id,
    staleTime: 20_000,
  });
}

// ─── Busca por Slug Público ─────────────────────────────────────────────────────

/** Hook para buscar aprovação via link público (utilizado no portal do cliente) */
export function useContentApprovalBySlug(slug: string) {
  return useQuery({
    queryKey: ['content-approvals', 'slug', slug],
    queryFn: () => ContentApprovalService.getBySlug(slug),
    enabled: !!slug,
    staleTime: 60_000,
    retry: 1,
  });
}

// ─── Criação ──────────────────────────────────────────────────────────────────

/** Hook para criar um novo pacote de aprovação */
export function useCreateContentApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateContentApprovalPayload) =>
      ContentApprovalService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content-approvals'] });
      toast.success('Central de aprovação criada com sucesso!');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao processar a criação da aprovação.'),
  });
}

// ─── Decisão por Item ──────────────────────────────────────────────────────────

/** Hook para registrar a decisão do cliente em um item individual */
export function useDecideItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DecideItemPayload) => ContentApprovalService.decideItem(payload),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: ['content-approvals'] });
      const labels: Record<ApprovalItemStatus, string> = {
        approved: 'Publicação aprovada! ✅',
        rejected: 'Publicação reprovada. ❌',
        revision_requested: 'Ajustes solicitados. 🟡',
        pending: '',
      };
      if (labels[item.status]) toast.success(labels[item.status]);
    },
    onError: (err: any) => toast.error(err.message || 'Falha ao registrar decisão no sistema.'),
  });
}

// ─── Decisão em Lote ──────────────────────────────────────────────────────────

/** Hook para aplicar a mesma decisão em todos os itens pendentes de um pacote */
export function useDecideAllItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      approvalId,
      decision,
      feedback,
      reviewerName,
      actorRole,
    }: {
      approvalId: string;
      decision: ApprovalItemStatus;
      feedback?: string | null;
      reviewerName?: string | null;
      actorRole?: string | null;
    }) => ContentApprovalService.decideAll(approvalId, decision, feedback, reviewerName, actorRole as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content-approvals'] });
      toast.success('Decisão aplicada com sucesso a todos os itens!');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao processar decisão em lote.'),
  });
}

export function useTransitionCentralQueueItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      action,
      actorRole,
      comment,
    }: {
      postId: string;
      action: 'approve_internal' | 'send_client' | 'request_adjustment';
      actorRole?: string | null;
      comment?: string | null;
    }) => ContentApprovalService.transitionCentralQueueItem({ postId, action, actorRole: actorRole as any, comment }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['content-approvals'] });
      qc.invalidateQueries({ queryKey: ['posting-calendar'] });
      const labels: Record<string, string> = {
        approve_internal: 'Post aprovado internamente.',
        send_client: 'Post enviado para o portal do cliente.',
        request_adjustment: 'Post retornado para ajustes.',
      };
      toast.success(labels[variables.action] || 'Fluxo atualizado.');
    },
    onError: (err: any) => toast.error(err.message || 'Falha ao atualizar o fluxo.'),
  });
}

// ─── Checklist Interno ───────────────────────────────────────────────────────

/** Hook para atualizar checklist interno diretamente no post do calendário */
export function useUpdateApprovalChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      field,
      value,
    }: {
      itemId: string;
      field: CalendarChecklistField;
      value: boolean;
    }) => ContentApprovalService.updateChecklistField(itemId, field, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content-approvals'] });
    },
    onError: (err: any) => toast.error(err.message || 'Falha ao atualizar checklist interno.'),
  });
}

export function useUpdateQueueChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      field,
      value,
    }: {
      postId: string;
      field: CalendarChecklistField;
      value: boolean;
    }) => ContentApprovalService.updateQueueChecklistField(postId, field, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content-approvals'] });
    },
    onError: (err: any) => toast.error(err.message || 'Falha ao atualizar checklist na central.'),
  });
}

// ─── Adicionar Item ────────────────────────────────────────────────────────────

/** Hook para incluir um novo post em um pacote de aprovação já existente */
export function useAddApprovalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, item }: { approvalId: string; item: CreateApprovalItemPayload }) =>
      ContentApprovalService.addItem(approvalId, item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content-approvals'] });
      toast.success('Nova publicação adicionada ao pacote!');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao adicionar publicação.'),
  });
}

// ─── Remover Item ─────────────────────────────────────────────────────────────

/** Hook para excluir um post de um pacote de aprovação */
export function useDeleteApprovalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => ContentApprovalService.deleteItem(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content-approvals'] });
      toast.success('Item removido com sucesso.');
    },
    onError: (err: any) => toast.error(err.message || 'Não foi possível remover o item.'),
  });
}

// ─── Cancelamento ─────────────────────────────────────────────────────────────

/** Hook para cancelar permanentemente um pacote de aprovação */
export function useCancelContentApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ContentApprovalService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content-approvals'] });
      toast.success('Solicitação de aprovação cancelada.');
    },
    onError: (err: any) => toast.error(err.message || 'Falha ao cancelar aprovação.'),
  });
}

// ─── Contador de Pendências ─────────────────────────────────────────────────────

/** Hook para obter o volume total de aprovações pendentes (uso em badges de menu) */
export function useContentApprovalPendingCount() {
  return useQuery({
    queryKey: ['content-approvals', 'pending-count'],
    queryFn: ContentApprovalService.getPendingCount,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
