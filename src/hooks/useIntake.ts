/**
 * =========================================================
 * INTAKE HOOKS (PRODUCTION VERSION)
 * =========================================================
 *
 * ✔ Conectado ao banco
 * ✔ Fluxo intake → task → kanban
 * ✔ Sem mock
 * ✔ Cache otimizado
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { intakeService } from '@/services';

// =========================
// QUERY KEYS
// =========================
const intakeKeys = {
  all: ['intake'] as const,
  list: (filters?: any) => [...intakeKeys.all, 'list', filters] as const,
  count: () => [...intakeKeys.all, 'count'] as const,
  templates: () => [...intakeKeys.all, 'templates'] as const,
};

// =========================
// LISTA DE REQUESTS
// =========================
export const useIntakeRequests = (filters?: { status?: string }) => {
  return useQuery({
    queryKey: intakeKeys.list(filters),
    queryFn: async () => {
      const data = await intakeService.getAll();

      if (!filters?.status) return data;
      return data.filter((item: any) => item.status === filters.status);
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useIntake = useIntakeRequests;

// =========================
// COUNT
// =========================
export const usePendingCount = () => {
  return useQuery({
    queryKey: intakeKeys.count(),
    queryFn: intakeService.getPendingCount,
    staleTime: 1000 * 60 * 2,
  });
};

export const useIntakePendingCount = usePendingCount;

// =========================
// CREATE REQUEST
// =========================
export const useCreateIntakeRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: intakeService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: intakeKeys.all });
    },
  });
};

// =========================
// UPDATE STATUS
// =========================
export const useUpdateIntakeStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      intakeService.update(id, { status }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: intakeKeys.all });
    },
  });
};

// =========================
// 🔥 CREATE TASK REAL
// =========================
export const useCreateTaskFromIntake = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: intakeService.createTaskFromIntake,

    onSuccess: () => {
      // atualiza tudo
      queryClient.invalidateQueries({ queryKey: intakeKeys.all });
    },
  });
};

// =========================
// 🔥 TEMPLATES REAIS (DB)
// =========================
export const useIntakeTemplates = () => {
  return useQuery({
    queryKey: intakeKeys.templates(),
    queryFn: intakeService.getTemplates,
    staleTime: 1000 * 60 * 10,
  });
};

/**
 * =========================================================
 * 📌 BOAS PRÁTICAS
 * =========================================================
 *
 * ✔ Nunca usar mock em produção
 * ✔ Sempre usar service como fonte única
 * ✔ Sempre invalidar cache após mutation
 *
 * Esse arquivo é a camada de integração do frontend
 */