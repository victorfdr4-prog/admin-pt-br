import { MoreVertical, FileText, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { VARIANTS } from '@/lib/motion';
import { PriorityDot } from '../ui/PriorityDot';
import { StatusChip } from '../ui/StatusChip';

interface TaskCardPremiumProps {
  id: string;
  title: string;
  clientName: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  fileCount?: number;
  assigneeCount?: number;
  onClick: () => void;
  onMenuClick?: (e: React.MouseEvent) => void;
}

export function TaskCardPremium({
  id,
  title,
  clientName,
  status,
  priority,
  dueDate,
  fileCount = 0,
  assigneeCount = 0,
  onClick,
  onMenuClick,
}: TaskCardPremiumProps) {
  return (
    <motion.div
      variants={VARIANTS.cardHover}
      whileHover="hover"
      className="group rounded-lg border border-border bg-card p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-text-primary line-clamp-2 flex-1">
            {title}
          </h4>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuClick?.(e);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
          >
            <MoreVertical size={16} className="text-text-secondary" />
          </button>
        </div>

        {/* Client & Status */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-text-secondary truncate">{clientName}</p>
          <StatusChip label={status} variant="active" size="sm" />
        </div>

        {/* Priority & Due */}
        <div className="flex items-center justify-between">
          <PriorityDot priority={priority} showLabel size="sm" />
          {dueDate && (
            <span className="text-xs text-text-tertiary">{dueDate}</span>
          )}
        </div>

        {/* Footer: Files & Assignees */}
        {(fileCount > 0 || assigneeCount > 0) && (
          <div className="flex gap-3 border-t border-border pt-2">
            {fileCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-text-secondary">
                <FileText size={14} />
                <span>{fileCount}</span>
              </div>
            )}
            {assigneeCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-text-secondary">
                <Users size={14} />
                <span>{assigneeCount}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
