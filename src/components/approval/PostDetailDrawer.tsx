import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, History, Send, X } from 'lucide-react';
import { WorkflowTone } from '@/components/posting-calendar/PostingCalendarShared';
import { buildVersionDiffLabels } from '@/domain/postVersions';
import { cn } from '@/lib/utils';
import type { CalendarChecklistField, CentralApprovalQueueItem } from '@/services/content-approval.service';

interface ChecklistState {
  checklist_arte_ok: boolean;
  checklist_legenda_ok: boolean;
}

interface PostDetailDrawerProps {
  post: CentralApprovalQueueItem | null;
  open: boolean;
  comment: string;
  onCommentChange: (value: string) => void;
  checklist: ChecklistState;
  onToggleChecklist: (field: CalendarChecklistField, value: boolean) => void;
  onClose: () => void;
  onApproveInternal: () => void;
  onSendClient: () => void;
  onRequestAdjustment: () => void;
  actionLoading?: boolean;
}

const checklistItems: Array<{ field: CalendarChecklistField; label: string }> = [
  { field: 'checklist_arte_ok', label: 'Arte validada' },
  { field: 'checklist_legenda_ok', label: 'Legenda validada' },
];

export default function PostDetailDrawer({
  post,
  open,
  comment,
  onCommentChange,
  checklist,
  onToggleChecklist,
  onClose,
  onApproveInternal,
  onSendClient,
  onRequestAdjustment,
  actionLoading = false,
}: PostDetailDrawerProps) {
  const changes = post ? buildVersionDiffLabels(post.current_version || null, post.previous_version || null) : [];

  return (
    <AnimatePresence>
      {open && post ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[520px] flex-col border-l border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]"
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Detalhe do post</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{post.title || 'Sem título'}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <WorkflowTone value={post.workflow_status} />
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    Versão {post.current_version_number || post.version_number || 1}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                {post.image_url ? (
                      <img src={post.image_url} alt={post.title || 'Visualização'} className="h-full w-full object-cover" />
                ) : post.video_url ? (
                  <video src={post.video_url} controls className="h-full w-full" />
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-400">
                    Sem mídia vinculada.
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Legenda</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {post.description || 'Sem legenda disponível.'}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-slate-500" />
                  <p className="text-sm font-semibold text-slate-900">Checklist interno</p>
                </div>
                <div className="mt-4 space-y-3">
                  {checklistItems.map((item) => {
                    const checked = checklist[item.field];
                    return (
                      <button
                        key={item.field}
                        type="button"
                        onClick={() => onToggleChecklist(item.field, !checked)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-all',
                          checked
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                        )}
                      >
                        <span>{item.label}</span>
                        <span className="text-xs font-semibold">{checked ? 'OK' : 'Pendente'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-slate-500" />
                  <p className="text-sm font-semibold text-slate-900">Histórico de versões</p>
                </div>
                <div className="mt-4 max-h-[240px] space-y-3 overflow-y-auto pr-1">
                  {(post.versions || []).length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhuma versão registrada.</p>
                  ) : (
                    (post.versions || []).map((version) => (
                      <div key={version.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">v{version.version_number}</p>
                          {version.is_current ? (
                            <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                              Atual
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {buildVersionDiffLabels(
                            version,
                            (post.versions || []).find((entry) => entry.version_number === version.version_number - 1) || null
                          ).map((label) => (
                            <span key={`${version.id}-${label}`} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                              {label}
                            </span>
                          ))}
                        </div>
                        {version.change_reason ? (
                          <p className="mt-2 text-xs text-slate-600">
                            <strong>Motivo:</strong> {version.change_reason}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                O cliente só decide no portal. Esta tela serve para validar internamente e liberar o envio certo para o portal.
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Observação operacional</p>
                <textarea
                  value={comment}
                  onChange={(event) => onCommentChange(event.target.value)}
                  rows={4}
                  placeholder="Escreva aqui o contexto da decisão ou o ajuste solicitado."
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={actionLoading || post.workflow_status !== 'revisao_interna'}
                  onClick={onApproveInternal}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Aprovar interno
                </button>
                <button
                  type="button"
                  disabled={actionLoading || post.workflow_status !== 'aprovado_interno'}
                  onClick={onSendClient}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={15} />
                  Enviar cliente
                </button>
                <button
                  type="button"
                  disabled={actionLoading || post.workflow_status !== 'revisao_interna'}
                  onClick={onRequestAdjustment}
                  className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Voltar para criação
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
