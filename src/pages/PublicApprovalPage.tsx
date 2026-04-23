import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  MessageSquare,
  Send,
  XCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useContentApprovalBySlug } from '@/hooks/useContentApprovals';
import { ContentApprovalService } from '@/services/content-approval.service';
import type { ApprovalItem, ApprovalItemStatus, ApprovalPlatform } from '@/services/content-approval.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<ApprovalPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'Twitter / X',
  other: 'Outro',
};

const PLATFORM_COLORS: Record<ApprovalPlatform, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  linkedin: 'bg-sky-100 text-sky-700',
  tiktok: 'bg-gray-100 text-gray-700',
  youtube: 'bg-red-100 text-red-700',
  twitter: 'bg-slate-100 text-slate-700',
  other: 'bg-gray-100 text-gray-600',
};

const ITEM_STATUS_CONFIG: Record<
  ApprovalItemStatus,
  { label: string; emoji: string; color: string }
> = {
  pending: { label: 'Aguardando', emoji: '⏳', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  approved: { label: 'Aprovado', emoji: '✅', color: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rejeitado', emoji: '❌', color: 'bg-red-50 text-red-700 border-red-200' },
  revision_requested: { label: 'Revisão', emoji: '🟡', color: 'bg-orange-50 text-orange-700 border-orange-200' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

// ─── Per-item card ────────────────────────────────────────────────────────────

interface PublicItemCardProps {
  item: ApprovalItem;
  reviewerName: string;
  onDecide: (
    itemId: string,
    decision: ApprovalItemStatus,
    feedback: string,
    reviewerName: string
  ) => Promise<void>;
  disabled: boolean;
  disableRevisionRequest?: boolean;
}

const PublicItemCard: React.FC<PublicItemCardProps> = ({
  item,
  reviewerName,
  onDecide,
  disabled,
  disableRevisionRequest = false,
}) => {
  const [open, setOpen] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [deciding, setDeciding] = useState(false);
  const cfg = ITEM_STATUS_CONFIG[item.status];

  const handle = async (decision: ApprovalItemStatus) => {
    setDeciding(true);
    try {
      await onDecide(item.id, decision, feedback, reviewerName);
      setFeedback('');
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-start gap-3 p-5 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Thumbnail */}
        <div className="shrink-0 w-14 h-14 rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center overflow-hidden">
          {item.media_url ? (
            <img src={item.media_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={22} className="text-gray-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold text-[#111111] leading-snug truncate">
              {item.title}
            </p>
            <span
              className={cn(
                'text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0',
                PLATFORM_COLORS[item.platform]
              )}
            >
              {PLATFORM_LABELS[item.platform]}
            </span>
          </div>
          {item.scheduled_date && (
            <p className="text-[13px] text-[#6b7280] mt-0.5">
              Publicação: {formatDate(item.scheduled_date)}
            </p>
          )}
          <span
            className={cn(
              'inline-flex items-center gap-1 mt-1.5 text-[12px] px-2.5 py-0.5 rounded-full border font-medium',
              cfg.color
            )}
          >
            {cfg.emoji} {cfg.label}
          </span>
        </div>

        <span className="shrink-0 text-gray-400 mt-1">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4 bg-gray-50/50">
          {item.content && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af] mb-1.5">
                Texto do post
              </p>
              <p className="text-[14px] text-[#374151] whitespace-pre-wrap leading-relaxed">
                {item.content}
              </p>
            </div>
          )}

          {item.media_url && (
            <a
              href={item.media_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-[#374151] hover:bg-gray-50 transition-colors"
            >
              <ExternalLink size={13} />
              Ver mídia
            </a>
          )}

          {((item as any).previous_media_url || (item as any).previous_content) && (
            <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280]">
                Comparação de versões
              </p>
              {(item as any).previous_media_url && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                    <p className="text-[11px] font-semibold text-red-700 mb-1">Versão anterior (recusada)</p>
                    <img src={(item as any).previous_media_url} alt="Versão anterior" className="w-full rounded-md object-cover" />
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2">
                    <p className="text-[11px] font-semibold text-green-700 mb-1">Versão atual</p>
                    {item.media_url ? (
                      <img src={item.media_url} alt="Versão atual" className="w-full rounded-md object-cover" />
                    ) : (
                      <p className="text-[12px] text-green-700">Sem mídia nova.</p>
                    )}
                  </div>
                </div>
              )}
              {(item as any).public_version_note && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                  <p className="text-[11px] font-semibold text-blue-700 mb-1">Nota da atualização</p>
                  <p className="text-[13px] text-blue-900">{String((item as any).public_version_note)}</p>
                </div>
              )}
            </div>
          )}

          {/* Previous feedback */}
          {item.feedback && item.status !== 'pending' && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-orange-500 mb-1">
                Comentário registrado
              </p>
              <p className="text-[13px] text-orange-800">{item.feedback}</p>
            </div>
          )}

          {/* Decision area (only if pending) */}
          {item.status === 'pending' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af] block mb-1.5">
                  Comentário
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={2}
                  placeholder="Deixe um comentário para este post (opcional)"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-[#111111]/20"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={deciding || disabled}
                  onClick={() => void handle('approved')}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-[14px] font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle2 size={16} />
                  Aprovar ✅
                </button>
                <button
                  type="button"
                  disabled={deciding || disabled || disableRevisionRequest}
                  onClick={() => void handle('revision_requested')}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-orange-300 px-4 py-3 text-[14px] font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50 transition-colors"
                >
                  <MessageSquare size={16} />
                  Solicitar alteração 🟡
                </button>
                <button
                  type="button"
                  disabled={deciding || disabled}
                  onClick={() => void handle('rejected')}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-300 px-4 py-3 text-[14px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <XCircle size={16} />
                  Rejeitar ❌
                </button>
              </div>
            </div>
          )}

          {/* Already decided */}
          {item.status !== 'pending' && item.reviewer_name && (
            <p className="text-[12px] text-[#9ca3af]">
              Revisado por <strong>{item.reviewer_name}</strong>
              {item.decided_at ? ` em ${formatDate(item.decided_at)}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PublicApprovalPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: approval, isLoading, error, refetch } = useContentApprovalBySlug(slug);

  const [reviewerName, setReviewerName] = useState('');
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const revisionsUsed = approval?.revision_count || 0;
  const canRequestRevision = revisionsUsed < 2;

  const handleDecideItem = async (
    itemId: string,
    decision: ApprovalItemStatus,
    feedback: string,
    name: string
  ) => {
    await ContentApprovalService.decideItem({
      itemId,
      decision,
      feedback: feedback || null,
      reviewerName: name || null,
      actorRole: 'cliente',
    });
    await refetch();

    // Check if all decided
    const refreshed = await ContentApprovalService.getBySlug(slug);
    if (refreshed.pending_count === 0) setAllDone(true);
  };

  const handleApproveAll = async () => {
    if (!approval) return;
    await ContentApprovalService.decideAll(
      approval.id,
      'approved',
      null,
      reviewerName || null,
      'cliente'
    );
    await refetch();
    setAllDone(true);
  };

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[14px] text-[#6b7280]">
          <Clock size={18} className="animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  if (error || !approval) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <XCircle size={40} className="text-red-400 mx-auto" />
          <p className="text-[16px] font-semibold text-[#111111]">Link inválido</p>
          <p className="text-[13px] text-[#6b7280]">
            {error instanceof Error ? error.message : 'Este link de aprovação não existe ou expirou.'}
          </p>
        </div>
      </div>
    );
  }

  const meta = approval.metadata as Record<string, unknown>;
  const hasPending = approval.pending_count > 0;

  // ── Name gate ────────────────────────────────────────────────────────────

  if (!nameConfirmed) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#111111] flex items-center justify-center mx-auto">
              <CheckCircle2 size={26} className="text-white" />
            </div>
            <h1 className="text-[20px] font-bold text-[#111111]">Central de Aprovação</h1>
            <p className="text-[13px] text-[#6b7280]">
              {approval.client_name && `Para: ${approval.client_name} · `}
              {String(meta.month_label ?? '')} {String(meta.year ?? '')}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4 shadow-sm">
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold uppercase tracking-widest text-[#6b7280] block">
                Seu nome *
              </label>
              <input
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#111111]/20"
                placeholder="Ex.: Maria Silva"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && reviewerName.trim()) setNameConfirmed(true);
                }}
              />
            </div>
            <button
              type="button"
              disabled={!reviewerName.trim()}
              onClick={() => setNameConfirmed(true)}
              className="w-full rounded-xl bg-[#111111] py-3 text-[14px] font-semibold text-white hover:bg-[#222] disabled:opacity-40 transition-colors"
            >
              Continuar →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── All decided ───────────────────────────────────────────────────────────

  if (allDone || approval.pending_count === 0) {
    const allApproved = approval.approved_count === approval.items_count;
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="text-5xl">{allApproved ? '🎉' : '✅'}</div>
          <h2 className="text-[20px] font-bold text-[#111111]">
            {allApproved ? 'Tudo aprovado!' : 'Revisões registradas!'}
          </h2>
          <p className="text-[13px] text-[#6b7280]">
            {allApproved
              ? 'Todos os posts foram aprovados. Obrigado!'
              : `${approval.approved_count} aprovado(s), ${approval.revision_count} revisão, ${approval.rejected_count} rejeitado(s). Nossa equipe entrará em contato.`}
          </p>
          {!allDone && (
            <button
              type="button"
              onClick={() => setAllDone(false)}
              className="text-sm text-[#6b7280] hover:underline"
            >
              Ver posts
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-5 sticky top-0 z-10">
        <div className="mx-auto max-w-2xl">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[#9ca3af]">
            Central de Aprovação de Conteúdo
          </p>
          <h1 className="mt-1 text-[18px] font-bold text-[#111111] leading-snug">
            {approval.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#6b7280]">
            {approval.client_name && <span>Cliente: <strong>{approval.client_name}</strong></span>}
            {meta.month_label && (
              <span>
                Período: <strong>{String(meta.month_label)} {String(meta.year ?? '')}</strong>
              </span>
            )}
            <span>
              Revisando como: <strong>{reviewerName}</strong>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-[12px] font-bold uppercase tracking-widest text-blue-700 mb-2">Checklist de aprovação</p>
          <ul className="space-y-1 text-[13px] text-blue-900">
            <li>1. Conferir arte/mídia.</li>
            <li>2. Conferir legenda e informações do post.</li>
            <li>3. Aprovar apenas quando estiver de acordo.</li>
          </ul>
        </div>

        {/* Progress summary */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-3 text-[13px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              <span className="text-yellow-700 font-medium">{approval.pending_count} pendente(s)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-green-700 font-medium">{approval.approved_count} aprovado(s)</span>
            </span>
            {approval.revision_count > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-orange-400" />
                <span className="text-orange-700 font-medium">{approval.revision_count} revisão</span>
              </span>
            )}
            {approval.rejected_count > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-red-700 font-medium">{approval.rejected_count} rejeitado(s)</span>
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{
                width: `${approval.items_count > 0 ? Math.round((approval.approved_count / approval.items_count) * 100) : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Approve all banner */}
        {hasPending && approval.pending_count > 1 && (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <p className="flex-1 text-[14px] text-green-800">
              Aprovar todos os <strong>{approval.pending_count}</strong> posts de uma vez?
            </p>
            <button
              type="button"
              onClick={() => void handleApproveAll()}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-green-700 transition-colors whitespace-nowrap"
            >
              <CheckCircle2 size={15} />
              Aprovar todos ✅
            </button>
          </div>
        )}

        {/* Post cards */}
        {approval.items.map((item) => (
          <PublicItemCard
            key={item.id}
            item={item}
            reviewerName={reviewerName}
            onDecide={handleDecideItem}
            disabled={false}
            disableRevisionRequest={!canRequestRevision}
          />
        ))}

        {!canRequestRevision ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            Limite de 2 ajustes atingido. Para novas alterações, fale direto com a equipe.
          </div>
        ) : null}

        {/* Footer */}
        <p className="text-center text-[12px] text-[#9ca3af] py-4">
          Powered by Cromia Agency OS
        </p>
      </main>
    </div>
  );
}
