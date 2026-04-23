import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ClientList from '@/components/approval/ClientList';
import CalendarList from '@/components/approval/CalendarList';
import PostList from '@/components/approval/PostList';
import PostDetailDrawer from '@/components/approval/PostDetailDrawer';
import type { ApprovalCalendarSummary, ApprovalClientSummary } from '@/components/approval/types';
import { useCentralApprovalQueue, useTransitionCentralQueueItem, useUpdateQueueChecklist } from '@/hooks/useContentApprovals';
import type { CalendarChecklistField, CentralApprovalQueueItem } from '@/services/content-approval.service';
import { ClientService } from '@/services/client.service';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/components/ui/sonner';
import { systemError, systemLog } from '@/services/system-log.service';

const buildCalendarLabel = (post: CentralApprovalQueueItem) => {
  if (!post.post_date) return 'Calendário sem data';
  const parsed = new Date(post.post_date);
  if (Number.isNaN(parsed.getTime())) return 'Calendário sem data';
  const monthLabel = parsed.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
};

export default function ApprovalCenterPage() {
  const navigate = useNavigate();
  const currentRole = useAuthStore((state) => state.user?.role ?? null);
  const [allClients, setAllClients] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [optimisticChecklist, setOptimisticChecklist] = useState<
    Record<string, { checklist_arte_ok: boolean; checklist_legenda_ok: boolean }>
  >({});

  const { data: queue = [], isLoading, refetch } = useCentralApprovalQueue({
    limit: 500,
  });
  const transitionMutation = useTransitionCentralQueueItem();
  const checklistMutation = useUpdateQueueChecklist();

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const rows = await ClientService.getAll();
        if (!mounted) return;
        setAllClients((rows || []).map((row: any) => ({ id: String(row.id), name: String(row.name || 'Cliente') })));
      } catch (error) {
        console.error('❌ Erro:', error);
        void systemError({
          scope: 'approval_center',
          action: 'load_clients_failed',
          tableName: 'clients',
          message: 'Falha ao carregar clientes da central de aprovação.',
          error,
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const clientSummaries = useMemo<ApprovalClientSummary[]>(() => {
    const counts = new Map<string, ApprovalClientSummary>();

    queue.forEach((item) => {
      if (!item.client_id) return;
      const current = counts.get(item.client_id) || {
        id: item.client_id,
        name: item.client_name || allClients.find((client) => client.id === item.client_id)?.name || 'Cliente',
        totalPosts: 0,
        pendingPosts: 0,
        reviewPosts: 0,
      };

      current.totalPosts += 1;
      if (item.workflow_status === 'revisao_interna' || item.workflow_status === 'aprovado_interno') {
        current.pendingPosts += 1;
      }
      if (item.workflow_status === 'revisao_cliente') {
        current.reviewPosts += 1;
      }
      counts.set(item.client_id, current);
    });

    return Array.from(counts.values()).sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  }, [allClients, queue]);

  const selectedClient = useMemo(
    () => clientSummaries.find((client) => client.id === selectedClientId) || null,
    [clientSummaries, selectedClientId]
  );

  const calendars = useMemo<ApprovalCalendarSummary[]>(() => {
    if (!selectedClientId) return [];

    const grouped = new Map<string, ApprovalCalendarSummary>();
    queue
      .filter((item) => item.client_id === selectedClientId)
      .forEach((item) => {
        const current = grouped.get(item.calendar_id) || {
          id: item.calendar_id,
          clientId: selectedClientId,
          label: `Calendário ${buildCalendarLabel(item)}`,
          monthLabel: buildCalendarLabel(item),
          totalPosts: 0,
          pendingPosts: 0,
          approvedInternally: 0,
          reviewPosts: 0,
        };

        current.totalPosts += 1;
        if (item.workflow_status === 'revisao_interna') current.pendingPosts += 1;
        if (item.workflow_status === 'aprovado_interno') current.approvedInternally += 1;
        if (item.workflow_status === 'revisao_cliente') current.reviewPosts += 1;
        grouped.set(item.calendar_id, current);
      });

    return Array.from(grouped.values()).sort((left, right) => left.monthLabel.localeCompare(right.monthLabel, 'pt-BR'));
  }, [queue, selectedClientId]);

  const calendarPosts = useMemo(() => {
    if (!selectedCalendarId) return [];
    const posts = queue.filter((item) => item.calendar_id === selectedCalendarId);
    console.log('📦 Posts carregados:', posts);
    if (posts.length === 0) {
      console.warn('⚠️ Nenhum post encontrado');
    }
    return posts;
  }, [queue, selectedCalendarId]);

  const selectedCalendar = useMemo(
    () => calendars.find((calendar) => calendar.id === selectedCalendarId) || null,
    [calendars, selectedCalendarId]
  );

  const selectedPost = useMemo(
    () => calendarPosts.find((post) => post.id === selectedPostId) || null,
    [calendarPosts, selectedPostId]
  );

  useEffect(() => {
    console.log('👤 Cliente:', selectedClient);
    console.log('📅 Calendário:', selectedCalendar);
    console.log('📝 Post:', selectedPost);
  }, [selectedCalendar, selectedClient, selectedPost]);

  const checklistState = useMemo(() => {
    if (!selectedPost) {
      return {
        checklist_arte_ok: false,
        checklist_legenda_ok: false,
      };
    }

    return (
      optimisticChecklist[selectedPost.id] || {
        checklist_arte_ok: Boolean(selectedPost.checklist_arte_ok),
        checklist_legenda_ok: Boolean(selectedPost.checklist_legenda_ok),
      }
    );
  }, [optimisticChecklist, selectedPost]);

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedCalendarId(null);
    setSelectedPostId(null);
  };

  const handleSelectCalendar = (calendarId: string) => {
    setSelectedCalendarId(calendarId);
    setSelectedPostId(null);
  };

  const handleSelectPost = (postId: string) => {
    setSelectedPostId(postId);
  };

  const handleChecklistToggle = (field: CalendarChecklistField, value: boolean) => {
    if (!selectedPost) return;

    const previousState = checklistState;
    setOptimisticChecklist((current) => ({
      ...current,
      [selectedPost.id]: {
        ...previousState,
        [field]: value,
      },
    }));

    checklistMutation.mutate(
      { postId: selectedPost.id, field, value },
      {
        onSuccess: (data) => {
          setOptimisticChecklist((current) => ({
            ...current,
            [selectedPost.id]: data,
          }));
        },
        onError: (error) => {
          setOptimisticChecklist((current) => ({
            ...current,
            [selectedPost.id]: previousState,
          }));
          console.error('❌ Erro:', error);
        },
      }
    );
  };

  const runTransition = (
    action: 'approve_internal' | 'send_client' | 'request_adjustment',
    requireComment = false
  ) => {
    if (!selectedPost) return;
    const comment = String(commentDrafts[selectedPost.id] || '').trim();

    if (requireComment && !comment) {
      toast.error('Descreva o ajuste solicitado antes de continuar.');
      return;
    }

    transitionMutation.mutate(
      {
        postId: selectedPost.id,
        action,
        actorRole: currentRole,
        comment: comment || undefined,
      },
      {
        onSuccess: async () => {
          await systemLog({
            scope: 'approval_center',
            action: `ui_${action}`,
            clientId: selectedPost.client_id,
            tableName: 'posting_calendar_items',
            message: 'Ação executada pela interface da central.',
            data: {
              postId: selectedPost.id,
              calendarId: selectedPost.calendar_id,
            },
          });
          setCommentDrafts((current) => ({ ...current, [selectedPost.id]: '' }));
          await refetch();
        },
        onError: async (error) => {
          console.error('❌ Erro:', error);
          await systemError({
            scope: 'approval_center',
            action: `ui_${action}_failed`,
            clientId: selectedPost.client_id,
            tableName: 'posting_calendar_items',
            message: 'Falha ao executar ação pela central.',
            error,
            data: { postId: selectedPost.id },
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-slate-900">
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Central Interna de Aprovação
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                Revisão interna → envio ao cliente → retorno para criação
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Esta tela ficou focada só no checkpoint interno. A aprovação do cliente e o agendamento seguem na Central Operacional.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/hub')}
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                Ir para o HUB
              </button>
              <button
                type="button"
                onClick={() => void refetch()}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                <RefreshCw size={15} />
                Atualizar
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="w-full border-r border-gray-200 bg-[#f8f9fb] md:w-1/4">
            <ClientList clients={clientSummaries} selectedClientId={selectedClientId} onSelect={handleSelectClient} />
          </div>

          <div className="hidden border-r border-gray-200 bg-[#f8f9fb] md:block md:w-1/4">
            <AnimatePresence mode="wait">
              {selectedClient ? (
                <motion.div
                  key={selectedClient.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <CalendarList
                    calendars={calendars}
                    selectedCalendarId={selectedCalendarId}
                    onSelect={handleSelectCalendar}
                  />
                </motion.div>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
                  Selecione um cliente para listar os calendários em revisão interna.
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden min-w-0 flex-1 bg-[#f8f9fb] lg:block">
            <AnimatePresence mode="wait">
              {selectedCalendar ? (
                <motion.div
                  key={selectedCalendar.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <PostList posts={calendarPosts} selectedPostId={selectedPostId} onSelect={handleSelectPost} />
                </motion.div>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
                  {isLoading ? 'Carregando a fila...' : 'Selecione um calendário para ver os posts deste ciclo interno.'}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <PostDetailDrawer
        post={selectedPost}
        open={Boolean(selectedPost)}
        comment={selectedPost ? commentDrafts[selectedPost.id] || '' : ''}
        onCommentChange={(value) => {
          if (!selectedPost) return;
          setCommentDrafts((current) => ({
            ...current,
            [selectedPost.id]: value,
          }));
        }}
        checklist={checklistState}
        onToggleChecklist={handleChecklistToggle}
        onClose={() => setSelectedPostId(null)}
        onApproveInternal={() => runTransition('approve_internal')}
        onSendClient={() => runTransition('send_client')}
        onRequestAdjustment={() => runTransition('request_adjustment', true)}
        actionLoading={transitionMutation.isPending || checklistMutation.isPending}
      />
    </div>
  );
}
