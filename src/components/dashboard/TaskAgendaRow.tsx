import { Clock, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { VARIANTS } from '@/lib/motion';
import { PriorityDot } from '../ui/PriorityDot';

interface TaskAgendaRowProps {
  taskTitle: string;
  clientName: string;
  dueTime: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  onClick: () => void;
}

export function TaskAgendaRow({
  taskTitle,
  clientName,
  dueTime,
  priority,
  assignee,
  onClick,
}: TaskAgendaRowProps) {
  return (
    <motion.button
      variants={VARIANTS.slideInUp}
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3 hover:bg-border transition-colors text-left group"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <PriorityDot priority={priority} size="sm" />
          <p className="truncate font-medium text-text-primary text-sm">
            {taskTitle}
          </p>
        </div>
        <p className="text-xs text-text-secondary">
          {clientName} {assignee && `• ${assignee}`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <Clock size={14} />
          <span>{dueTime}</span>
        </div>
        <ChevronRight
          size={16}
          className="text-text-tertiary group-hover:translate-x-1 transition-transform"
        />
      </div>
    </motion.button>
  );
}
