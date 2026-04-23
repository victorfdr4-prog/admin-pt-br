import { CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { VARIANTS } from '@/lib/motion';
import { EmptyState } from '../ui/EmptyState';

interface ApprovalItem {
  id: string;
  title: string;
  client: string;
  type: 'file' | 'post' | 'creative';
  submittedAt: Date;
}

interface ApprovalQueueProps {
  items: ApprovalItem[];
  onViewAll: () => void;
}

const typeConfig = {
  file: 'Arquivo',
  post: 'Post',
  creative: 'Criativo',
};

export function ApprovalQueue({
  items,
  onViewAll,
}: ApprovalQueueProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 size={40} />}
        title="Nenhuma aprovação pendente"
        description="Você está em dia com todas as aprovações!"
        size="sm"
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 3).map((item, i) => (
        <motion.div
          key={item.id}
          variants={VARIANTS.slideInUp}
          custom={i}
          className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:bg-border transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-text-primary">
              {item.title}
            </p>
            <p className="text-xs text-text-secondary">
              {item.client} • {typeConfig[item.type]}
            </p>
          </div>
          <Clock size={16} className="flex-shrink-0 text-amber-500" />
        </motion.div>
      ))}
      {items.length > 3 && (
        <button
          onClick={onViewAll}
          className="w-full rounded-lg border border-dashed border-border py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
        >
          Ver {items.length - 3} mais
        </button>
      )}
    </div>
  );
}
