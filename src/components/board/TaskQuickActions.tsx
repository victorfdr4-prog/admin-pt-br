import {
  CheckCircle2,
  Trash2,
  Share2,
  FileText,
  MoreHorizontal,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface TaskQuickActionsProps {
  taskId: string;
  onComplete?: () => void;
  onShare?: () => void;
  onAttachFile?: () => void;
  onDelete?: () => void;
  onMoreActions?: () => void;
}

export function TaskQuickActions({
  taskId,
  onComplete,
  onShare,
  onAttachFile,
  onDelete,
  onMoreActions,
}: TaskQuickActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {onComplete && (
        <button
          onClick={onComplete}
          className="p-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          title="Concluir"
        >
          <CheckCircle2 size={18} />
        </button>
      )}

      {onAttachFile && (
        <button
          onClick={onAttachFile}
          className="p-2 rounded-full bg-lime-500 text-white hover:bg-lime-600 transition-colors"
          title="Anexar arquivo"
        >
          <FileText size={18} />
        </button>
      )}

      {onShare && (
        <button
          onClick={onShare}
          className="p-2 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
          title="Compartilhar"
        >
          <Share2 size={18} />
        </button>
      )}

      {onMoreActions && (
        <button
          onClick={onMoreActions}
          className="p-2 rounded-full bg-gray-600 text-white hover:bg-gray-700 transition-colors"
          title="Mais ações"
        >
          <MoreHorizontal size={18} />
        </button>
      )}

      {onDelete && (
        <button
          onClick={onDelete}
          className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
          title="Deletar"
        >
          <Trash2 size={18} />
        </button>
      )}
    </motion.div>
  );
}
