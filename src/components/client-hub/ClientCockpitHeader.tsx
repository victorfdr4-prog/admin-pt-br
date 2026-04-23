import React from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, Globe, Calendar, MoreVertical } from 'lucide-react';
import { HealthBadge } from '@/components/ui/HealthBadge';
import { VARIANTS } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface ClientCockpitHeaderProps {
  clientId: string;
  clientName: string;
  clientStatus?: 'active' | 'inactive';
  healthScore: number;
  healthStatus?: 'healthy' | 'attention' | 'critical';
  email?: string;
  phone?: string;
  website?: string;
  joinDate?: string;
  portalUrl?: string;
  onEditClick?: () => void;
}

export const ClientCockpitHeader: React.FC<ClientCockpitHeaderProps> = ({
  clientId,
  clientName,
  clientStatus = 'active',
  healthScore,
  healthStatus,
  email,
  phone,
  website,
  joinDate,
  portalUrl,
  onEditClick,
}) => {
  const statusConfig = {
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Ativo' },
    inactive: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', label: 'Desativado' },
  };

  const cfg = statusConfig[clientStatus as keyof typeof statusConfig] || statusConfig.active;

  return (
    <motion.div
      variants={VARIANTS.slideInUp}
      initial="hidden"
      animate="visible"
      className="rounded-2xl border border-border bg-white shadow-sm"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{clientName}</h1>
            <span className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
              cfg.bg, cfg.text, cfg.border
            )}>
              {cfg.label}
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400">#{clientId}</p>
        </div>

        <div className="flex items-center gap-3">
          {portalUrl && (
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-95"
            >
              <Globe size={16} />
              Acessar Portal
            </a>
          )}
          
          <div className="h-10 w-px bg-border mx-1" />
          
          <HealthBadge score={healthScore} status={healthStatus} size="md" showScore />
          
          <div className="relative group">
            <button
              type="button"
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition-all"
            >
              <MoreVertical size={20} />
            </button>
            
            <div className="absolute right-0 top-full mt-2 w-48 scale-95 opacity-0 pointer-events-none group-focus-within:scale-100 group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-all duration-200 origin-top-right z-50">
              <div className="rounded-xl border border-border bg-white p-1.5 shadow-xl ring-1 ring-black/5">
                <button
                  onClick={onEditClick}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Editar Dados
                </button>
                <button
                  onClick={() => {
                    if (portalUrl) {
                      navigator.clipboard.writeText(portalUrl);
                      alert('Link do portal copiado!');
                    }
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Copiar Link Portal
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  Bloquear Acesso
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 bg-slate-50/50 rounded-b-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm">
            <Mail size={18} className="text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</p>
            <p className="text-sm font-semibold text-slate-700 truncate">{email || 'N/A'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm">
            <Phone size={18} className="text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WhatsApp</p>
            <p className="text-sm font-semibold text-slate-700 truncate">{phone || 'N/A'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm">
            <Calendar size={18} className="text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Membro Desde</p>
            <p className="text-sm font-semibold text-slate-700 truncate">
              {joinDate 
                ? new Date(joinDate).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                : 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm">
            <Globe size={18} className="text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Website</p>
            {website ? (
              <a href={website} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline truncate block">
                {website.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            ) : (
              <p className="text-sm font-semibold text-slate-700 truncate">N/A</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
