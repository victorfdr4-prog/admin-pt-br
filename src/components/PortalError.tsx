import React from 'react';
import { AlertTriangle, MessageCircle, RefreshCw } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';

interface PortalErrorProps {
  clientName?: string | null;
  message?: string;
}

const SUPPORT_PHONE = String(import.meta.env.VITE_SUPPORT_WHATSAPP_PHONE || '').trim();

export default function PortalError({
  clientName,
  message = 'Nao foi possivel carregar seu ambiente no momento.',
}: PortalErrorProps) {
  const safeClient = clientName?.trim() || 'Cliente';
  const locationHref = typeof window !== 'undefined' ? window.location.href : '';

  const whatsappMessage = [
    `ATENCAO: Portal do cliente ${safeClient} nao carregou corretamente.`,
    'Preciso de suporte urgente.',
    `Link: ${locationHref}`,
  ].join('\n');

  const whatsappUrl = buildWhatsAppLink({
    message: whatsappMessage,
    phone: SUPPORT_PHONE || null,
  });

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f5f6f8] px-4">
      <div className="w-full max-w-xl rounded-2xl border border-rose-200/70 bg-white p-8 text-center shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle size={30} />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Falha ao carregar seu portal</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>

        <div className="mt-7 flex flex-col gap-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <MessageCircle size={16} />
            AVISAR EQUIPE NO WHATSAPP
          </a>

          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Recarregar pagina
          </button>
        </div>

        <p className="mt-5 text-xs text-slate-400">Cromia Comunicacao 360o</p>
      </div>
    </div>
  );
}
