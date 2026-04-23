import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApprovalService, type ApprovalEntityType, type ApprovalStatus } from '@/services/approval.service';
import { toast } from 'sonner';

export function useApprovals(opts?: {
  status?: ApprovalStatus;
  clientId?: string;
  entityType?: ApprovalEntityType;
}) {
  return useQuery({
    queryKey: ['approvals', opts?.status ?? 'all', opts?.clientId ?? 'all', opts?.entityType ?? 'all'],
    queryFn: () => ApprovalService.getAll(opts),
    staleTime: 30_000,
  });
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => ApprovalService.getPending(),
    staleTime: 30_000,
  });
}

export function usePendingApprovalCount() {
  return useQuery({
    queryKey: ['approvals', 'pending-count'],
    queryFn: () => ApprovalService.getPendingCount(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useEntityApprovals(entityType: ApprovalEntityType, entityId: string | null) {
  return useQuery({
    queryKey: ['approvals', 'entity', entityType, entityId],
    queryFn: () => ApprovalService.getByEntity(entityType, entityId!),
    enabled: !!entityId,
    staleTime: 30_000,
  });
}

export function useCreateApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ApprovalService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success('Aprovação solicitada!');
    },
    onError: () => toast.error('Erro ao solicitar aprovação.'),
  });
}

export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      notes,
    }: {
      id: string;
      decision: 'approved' | 'rejected' | 'revision_requested';
      notes?: string;
    }) => ApprovalService.decide(id, decision, notes),
    onSuccess: (_, { decision }) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      const msg =
        decision === 'approved'
          ? 'Aprovado!'
          : decision === 'rejected'
          ? 'Rejeitado.'
          : 'Revisão solicitada.';
      toast.success(msg);
    },
    onError: () => toast.error('Erro ao processar decisão.'),
  });
}
