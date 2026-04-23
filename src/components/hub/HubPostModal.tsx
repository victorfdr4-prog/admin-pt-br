// src/components/hub/HubPostModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HubPost, WorkflowStatus } from '@/services/hub.service';
import { STATUS_META } from './HubPostCard';
import { useUpdateWorkflowStatus, useSchedulePost } from '@/hooks/useHubData';
import { cn } from '@/utils/cn';
import { X, Calendar, CheckCircle2, Edit3, Send, Clock, Video, Hash } from 'lucide-react';
import { formatPostDate } from '@/utils/localDate';

const WORKFLOW_ACTIONS: Array<{
  from: WorkflowStatus[];
  to: WorkflowStatus;
  label: string;
  icon: React.ElementType;
  style: string;
}> = [
  { from: ['rascunho'], to: 'revisao_interna', label: 'Enviar p/ revisão interna', icon: Send, style: 'btn-primary' },
  { from: ['revisao_interna'], to: 'aprovado_interno', label: 'Aprovar internamente', icon: CheckCircle2, style: 'btn-primary' },
  { from: ['aprovado_interno'], to: 'em_aprovacao_cliente', label: 'Enviar p/ cliente', icon: Send, style: 'btn-primary' },
  { from: ['revisao_cliente'], to: 'revisao_interna', label: 'Retomar revisão interna', icon: Edit3, style: 'flex items-center gap-2 px-4 py-2 rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-bold hover:bg-amber-100 transition-all' },
  { from: ['aprovado_cliente'], to: 'aguardando_agendamento', label: 'Mover p/ agendamento', icon: Clock, style: 'btn-primary' },
  { from: ['agendado'], to: 'publicado', label: 'Marcar publicado', icon: CheckCircle2, style: 'btn-primary' },
];

interface Props {
  post: HubPost | null;
  clientId: string;
  year: number;
  month: number;
  onClose: () => void;
}

export const HubPostModal: React.FC<Props> = ({ post, clientId, year, month, onClose }) => {
  const updateStatus = useUpdateWorkflowStatus();
  const schedulePost = useSchedulePost();
  const [scheduledAt, setScheduledAt] = useState('');
  const titleId = 'hub-post-modal-title';
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!post) return;
    setScheduledAt('');
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    return () => { document.removeEventListener('keydown', handleKey); clearTimeout(t); };
  }, [post, onClose]);

  if (!post) return null;

  const meta = STATUS_META[post.workflow_status];
  const availableActions = WORKFLOW_ACTIONS.filter((a) => a.from.includes(post.workflow_status));

  return (
    <AnimatePresence>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-[130] flex items-start justify-center p-4 pt-16 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
          aria-hidden="true"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-2xl rounded-[32px] bg-white shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-8 py-5 bg-slate-50/50 dark:bg-slate-900/80">
            <div className="flex items-center gap-3">
              <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} aria-hidden="true" />
              <div>
                <p id={titleId} className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                  {post.title ?? 'Post sem título'}
                </p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {formatPostDate(post.post_date)}
                  {post.channel && ` · ${post.channel}`}
                </p>
              </div>
            </div>
            <button ref={closeRef} onClick={onClose} aria-label="Fechar modal" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* BLOCO 1 — VISUAL */}
            {(post.image_url || post.video_url) && (
              <section aria-labelledby="modal-b1">
                <p id="modal-b1" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Visual</p>
                {post.image_url
                  ? <img src={post.image_url} alt={post.title ?? 'Imagem do post'} className="w-full rounded-2xl object-cover max-h-64" />
                  : <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Video size={16} aria-hidden="true" />
                      <a href={post.video_url!} target="_blank" rel="noopener noreferrer" className="underline text-primary">Ver vídeo</a>
                    </div>
                }
              </section>
            )}

            {/* BLOCO 2 — CONTEÚDO */}
            <section aria-labelledby="modal-b2">
              <p id="modal-b2" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Conteúdo</p>
              {post.description
                ? <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{post.description}</p>
                : <p className="text-sm text-slate-400 italic">Sem descrição cadastrada.</p>
              }
            </section>

            {/* BLOCO 3 — STATUS */}
            <section aria-labelledby="modal-b3">
              <p id="modal-b3" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Status</p>
              <div className="flex flex-wrap gap-2">
                <span aria-label={`Status atual: ${meta.label}`} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border', meta.color)}>
                  <span className={cn('h-2 w-2 rounded-full', meta.dot)} aria-hidden="true" />
                  {meta.label}
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  v{post.version_number}
                  {post.revision_count > 0 && ` · ${post.revision_count} revisão${post.revision_count > 1 ? 'ões' : ''}`}
                </span>
                {post.post_type && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <Hash size={10} aria-hidden="true" />
                    {post.post_type}
                  </span>
                )}
              </div>
            </section>

            {/* BLOCO 4 — AGENDAMENTO */}
            {(post.workflow_status === 'aguardando_agendamento' || post.workflow_status === 'agendado') && (
              <section aria-labelledby="modal-b4">
                <p id="modal-b4" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Agendamento</p>
                {post.scheduled_date
                  ? <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      <Calendar size={14} className="inline mr-1.5" aria-hidden="true" />
                      {new Date(post.scheduled_date).toLocaleString('pt-BR')}
                    </p>
                  : <div className="flex gap-2">
                      <div className="flex-1">
                        <label htmlFor="hub-sched" className="sr-only">Data e hora de agendamento</label>
                        <input id="hub-sched" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="field-control h-10 text-sm" />
                      </div>
                      <button
                        onClick={() => { if (!scheduledAt) return; schedulePost.mutate({ postId: post.id, scheduledDate: new Date(scheduledAt).toISOString(), clientId, year, month }); onClose(); }}
                        disabled={!scheduledAt || schedulePost.isPending}
                        className="btn-primary h-10 px-5 rounded-2xl text-sm flex items-center gap-2"
                        aria-label="Confirmar agendamento"
                      >
                        <Calendar size={14} aria-hidden="true" />
                        Agendar
                      </button>
                    </div>
                }
              </section>
            )}

            {/* BLOCO 5 — AÇÕES */}
            {availableActions.length > 0 && (
              <section aria-labelledby="modal-b5">
                <p id="modal-b5" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Ações</p>
                <div className="flex flex-wrap gap-2">
                  {availableActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.to}
                        onClick={() => { updateStatus.mutate({ postId: post.id, status: action.to, clientId, year, month }); onClose(); }}
                        disabled={updateStatus.isPending}
                        aria-label={action.label}
                        className={cn(action.style, 'flex items-center gap-2 text-sm')}
                      >
                        <Icon size={14} aria-hidden="true" />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
