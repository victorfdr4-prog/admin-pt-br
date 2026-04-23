import React, { useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { ClientService } from '@/services';
import { toast } from 'sonner';

interface BotaoAuditoriaDriveProps {
  folderIdDoCliente: string; // Este é o ID do banco que vem da DrivePage
  onAuditoriaCompleta?: () => void;
}

const BotaoAuditoriaDrive: React.FC<BotaoAuditoriaDriveProps> = ({ 
  folderIdDoCliente, 
  onAuditoriaCompleta 
}) => {
  const [loading, setLoading] = useState(false);

  const handleAuditoria = async () => {
    if (!folderIdDoCliente) {
      toast.error("ID do cliente não identificado.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Iniciando Auditoria Inteligente...");

    try {
      // 🚀 Chama o novo método que busca o ID do Drive e executa a função
      const result = await ClientService.runAudit(folderIdDoCliente);

      toast.success(result.message || "Auditoria concluída com sucesso!", {
        id: toastId,
      });

      if (onAuditoriaCompleta) {
        onAuditoriaCompleta();
      }
    } catch (error: any) {
      console.error("Erro na auditoria:", error);
      
      // Feedback amigável para o erro de permissão ou pasta não encontrada
      const errorMessage = error.message?.includes('404') 
        ? "Pasta do Drive não encontrada. Verifique se o ID está correto."
        : error.message || "Erro ao executar auditoria.";

      toast.error(errorMessage, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAuditoria}
      disabled={loading}
      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <ShieldCheck size={18} />
      )}
      
      <span>{loading ? 'Processando...' : 'Auditar Drive'}</span>
    </button>
  );
};

export default BotaoAuditoriaDrive;
