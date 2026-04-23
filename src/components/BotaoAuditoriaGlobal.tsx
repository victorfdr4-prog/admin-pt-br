import React, { useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ClientService } from '@/services';

interface BotaoAuditoriaGlobalProps {
  clientes: Array<{ id: string; name: string }>;
  onAuditoriaCompleta?: () => void;
}

export default function BotaoAuditoriaGlobal({ clientes, onAuditoriaCompleta }: BotaoAuditoriaGlobalProps) {
  const [loading, setLoading] = useState(false);

  const executar = async () => {
    if (!clientes.length) return;
    if (!window.confirm(`Deseja organizar as pastas de ${clientes.length} clientes?`)) return;

    setLoading(true);
    const toastId = toast.loading("Processando auditoria global...");

    try {
      for (const cliente of clientes) {
        await ClientService.runAudit(cliente.id);
      }
      toast.success("Todos os drives foram organizados!", { id: toastId });
      if (onAuditoriaCompleta) onAuditoriaCompleta();
    } catch (error: any) {
      toast.error("Erro na auditoria: " + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={executar}
      disabled={loading || !clientes.length}
      className="btn-secondary h-10 w-full justify-center disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
      {loading ? 'Auditando...' : 'Auditoria global'}
    </button>
  );
}
