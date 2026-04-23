import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { DocService, type CreateDocPayload, type DocDocument } from '@/services/doc.service';

export const docKeys = {
  templates: ['doc_templates'] as const,
  template: (id: string) => ['doc_templates', id] as const,
  documents: (opts?: object) => ['doc_documents', opts] as const,
  document: (id: string) => ['doc_documents', id] as const,
};

// ── Templates ─────────────────────────────────────────────────────────────────

export function useDocTemplates() {
  return useQuery({
    queryKey: docKeys.templates,
    queryFn: () => DocService.getTemplates(),
    staleTime: 5 * 60_000,
  });
}

export function useDocTemplate(id: string | null) {
  return useQuery({
    queryKey: id ? docKeys.template(id) : docKeys.templates,
    queryFn: () => DocService.getTemplate(id!),
    enabled: !!id,
  });
}

// ── Documents ─────────────────────────────────────────────────────────────────

export function useDocuments(opts?: { clientId?: string; status?: string }) {
  return useQuery({
    queryKey: docKeys.documents(opts),
    queryFn: () => DocService.getDocuments(opts),
  });
}

export function useDocument(id: string | null) {
  return useQuery({
    queryKey: id ? docKeys.document(id) : docKeys.documents(),
    queryFn: () => DocService.getDocument(id!),
    enabled: !!id,
    // Prevent focus-refetch from overwriting in-memory editor state
    staleTime: 60 * 1000,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDocPayload) => DocService.createDocument(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc_documents'] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<DocDocument> }) =>
      DocService.updateDocument(id, patch),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: docKeys.document(id) });
      qc.invalidateQueries({ queryKey: ['doc_documents'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => DocService.deleteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc_documents'] });
      toast.success('Documento excluído');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
