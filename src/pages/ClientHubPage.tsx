import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Clock3,
  MessageSquare,
  FolderOpen,
  Rocket,
} from 'lucide-react';

import { VARIANTS } from '@/lib/motion';
import { ClientCockpitHeader } from '@/components/client-hub/ClientCockpitHeader';
import { ClientSummaryStrip } from '@/components/client-hub/ClientSummaryStrip';
import { ClientHealthPanel } from '@/components/client-hub/ClientHealthPanel';
import { HealthBadge } from '@/components/client-hub/HealthBadge';
import { buildPortalUrl } from '@/services/_shared';
import { ClientOpenTasksPanel } from '@/components/client-hub/ClientOpenTasksPanel';
import { ClientContentPipeline } from '@/components/client-hub/ClientContentPipeline';
import { ClientDocsPanel } from '@/components/client-hub/ClientDocsPanel';
import { ClientActivityTimeline } from '@/components/client-hub/ClientActivityTimeline';
import { ClientHubSkeleton } from '@/components/client-hub/ClientHubSkeleton';
import { TaskDetailDrawer } from '@/components/drawers/TaskDetailDrawer';
import { FilePreviewModal } from '@/components/modals/FilePreviewModal';
import { useClientHub } from '@/hooks/useClientHub';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { BoardService } from '@/services/task.service';

export const ClientHubPage: React.FC = () => {
  const params = useParams();
  const actualId = (params.clientId || params.id)?.trim();

  const navigate = useNavigate();
  const hub = useClientHub(actualId || null);

  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);

  useRealtimeSync(['tasks', 'timeline_events', 'drive_files', 'file_comments', 'approvals']);

  const stats = useMemo(() => {
    const safeTasks = hub.tasks?.data || [];
    const safeDocs = hub.documents?.data || [];

    const openTasks = safeTasks.filter((t) => t.status !== 'completed');

    const overdueTasks = openTasks.filter((t) => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return !Number.isNaN(dueDate.getTime()) && dueDate < new Date();
    });

    const completedThisMonth = safeTasks.filter((t) => {
      if (!t.due_date || t.status !== 'completed') return false;
      const dueDate = new Date(t.due_date);
      const now = new Date();
      return (
        !Number.isNaN(dueDate.getTime()) &&
        dueDate.getMonth() === now.getMonth() &&
        dueDate.getFullYear() === now.getFullYear()
      );
    });

    return [
      {
        icon: <BarChart3 size={18} />,
        label: 'Tarefas ativas',
        value: openTasks.length.toString(),
        variant: 'info' as const,
      },
      {
        icon: <Check size={18} />,
        label: 'Concluídas este mês',
        value: completedThisMonth.length.toString(),
        variant: 'success' as const,
      },
      {
        icon: <Clock3 size={18} />,
        label: 'Atrasadas',
        value: overdueTasks.length.toString(),
        variant: 'warning' as const,
      },
      {
        icon: <MessageSquare size={18} />,
        label: 'Aprovações pendentes',
        value: '0',
        variant: 'error' as const,
      },
      {
        icon: <FolderOpen size={18} />,
        label: 'Documentos',
        value: safeDocs.length.toString(),
        variant: 'default' as const,
      },
      {
        icon: <Rocket size={18} />,
        label: 'Posts agendados',
        value: '0',
        variant: 'success' as const,
      },
    ];
  }, [hub.tasks?.data, hub.documents?.data]);

  const handleTaskClick = (task: any) => {
    setSelectedTask({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date,
      assignee: task.assignee_name,
      attachments: [],
    });
    setIsTaskDrawerOpen(true);
  };

  const handleTaskUpdate = async (updatedTask: any) => {
    try {
      await BoardService.updateTask(updatedTask.id, {
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        priority: updatedTask.priority,
        due_date: updatedTask.dueDate,
      });
      setIsTaskDrawerOpen(false);
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
    }
  };

  const handleFileClick = (file: any) => {
    setSelectedFile({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: file.created_at,
      url: file.url,
    });
    setIsFileModalOpen(true);
  };

  const handleFileDownload = async (fileId: string) => {
    console.log('Download solicitado:', fileId);
  };

  if (hub.isLoading) {
    return <ClientHubSkeleton />;
  }

  if (hub.isError || !hub.client?.data) {
    const errorDetail = hub.error as any;
    console.error('--- ERRO DE CARREGAMENTO NO HUB ---');
    console.group('Diagnóstico');
    console.log('ID buscado:', actualId);
    console.log('Mensagem:', errorDetail?.message || 'Erro desconhecido');
    console.log('Código:', errorDetail?.code);
    console.log('Detalhes:', errorDetail?.details);
    console.log('Dica:', errorDetail?.hint);
    console.groupEnd();

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center bg-slate-50">
        <div className="max-w-md w-full p-8 bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-500/5">
          <div className="h-16 w-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Rocket size={32} className="rotate-180" />
          </div>
          <p className="mb-2 text-xl font-bold text-slate-900 px-4">Ops! Cliente não encontrado</p>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            O cliente com o identificador <code className="bg-slate-100 px-1.5 py-0.5 rounded text-rose-600 font-mono text-xs">{actualId || 'Não Informado'}</code> pode ter sido removido ou não existe neste ambiente.
          </p>
          
          <div className="p-4 bg-slate-50 rounded-2xl text-left mb-8 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Causa provável</p>
            <p className="text-xs text-slate-600 font-medium">
              {errorDetail?.message || 'O registro não foi retornado pelo banco de dados ou houve falha na conexão.'}
            </p>
          </div>

          <button
            onClick={() => navigate('/clients')}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={18} />
            Voltar para Listagem
          </button>
        </div>
      </div>
    );
  }

  const clientData = hub.client.data;

  const healthData = {
    score: hub.health?.data?.score ?? 0,
    status: hub.health?.data?.status ?? 'critical',
    factors: hub.health?.data?.factors ?? [],
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/clients')}
          className="rounded-lg p-2 transition-colors hover:bg-border"
        >
          <ArrowLeft size={20} className="text-muted-foreground" />
        </button>
        <p className="text-sm text-muted-foreground">Clientes</p>
      </div>

      <ClientCockpitHeader
        clientId={clientData.id}
        clientName={clientData.name}
        clientStatus={clientData.status as 'active' | 'inactive'}
        healthScore={healthData.score}
        healthStatus={healthData.status as 'healthy' | 'attention' | 'critical'}
        email={clientData.email}
        phone={clientData.phone}
        website={clientData.site_url || clientData.website}
        joinDate={clientData.created_at}
        portalUrl={clientData.portal_active ? buildPortalUrl(clientData.portal_token || clientData.name, clientData.name) : undefined}
        onEditClick={() => navigate(`/clients?edit=${clientData.id}`)}
      />

      <motion.div variants={VARIANTS.slideInUp} initial="hidden" animate="visible">
        <ClientSummaryStrip stats={stats} />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ClientHealthPanel
            score={healthData.score}
            status={healthData.status as 'healthy' | 'at_risk' | 'critical'}
            factors={healthData.factors}
            trendChange={0}
          />

          <ClientOpenTasksPanel
            tasks={(hub.tasks?.data?.slice(0, 5) || []).map((task) => ({
              id: task.id,
              title: task.title,
              status: task.status as 'pending' | 'in_progress' | 'overdue',
              priority: task.priority,
              dueDate: task.due_date,
              assignee: task.assignee_name,
              onClick: () => handleTaskClick(task),
            }))}
            onViewAll={() => navigate(`/boards?client=${actualId}`)}
            isEmpty={(hub.tasks?.data?.length || 0) === 0}
          />
        </div>

        <div className="space-y-6">
          <ClientContentPipeline
            items={[]}
            onViewCalendar={() => navigate(`/posting-calendar?client=${actualId}`)}
            isEmpty={true}
          />

          <ClientDocsPanel
            documents={(hub.documents?.data || []).map((doc) => ({
              id: doc.id,
              name: doc.name,
              type: doc.type as 'pdf' | 'doc' | 'image' | 'spreadsheet' | 'other',
              size: doc.size,
              uploadedAt: doc.created_at,
              isShared: doc.is_shared,
              onClick: () => handleFileClick(doc),
              onDownload: () => handleFileDownload(doc.id),
            }))}
            onViewAll={() => navigate('/drive')}
            isEmpty={(hub.documents?.data?.length || 0) === 0}
          />
        </div>
      </div>

      <ClientActivityTimeline
        events={hub.timeline?.data || []}
        isEmpty={(hub.timeline?.data?.length || 0) === 0}
      />

      <TaskDetailDrawer
        isOpen={isTaskDrawerOpen}
        onClose={() => setIsTaskDrawerOpen(false)}
        task={selectedTask}
        onUpdate={handleTaskUpdate}
      />

      <FilePreviewModal
        isOpen={isFileModalOpen}
        onClose={() => setIsFileModalOpen(false)}
        file={selectedFile}
      />
    </motion.div>
  );
};

export default ClientHubPage;
