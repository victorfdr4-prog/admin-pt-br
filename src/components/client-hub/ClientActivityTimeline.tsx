import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { VARIANTS } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { TimelineEvent } from '@/services/timeline.service';
import ActivityFeedList from '@/components/activity/ActivityFeedList';
import { buildFeedItemFromTimelineEvent, groupFeedItems } from '@/lib/activity-feed';

interface ClientActivityTimelineProps {
  events: TimelineEvent[];
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const ClientActivityTimeline: React.FC<ClientActivityTimelineProps> = ({
  events,
  isEmpty = false,
  emptyMessage = 'Nenhuma atividade recente',
  className,
}) => {
  const groups = React.useMemo(() => groupFeedItems(events.map(buildFeedItemFromTimelineEvent)), [events]);

  return (
    <motion.div
      variants={VARIANTS.slideInUp}
      initial="hidden"
      animate="visible"
      className={cn('overflow-hidden rounded-2xl border border-border bg-white', className)}
    >
      <div className="border-b border-border px-6 py-4">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <Activity size={16} className="text-primary" />
          Atividade recente
        </h3>
      </div>

      {isEmpty || groups.length === 0 ? (
        <div className="flex h-40 items-center justify-center px-6 py-8">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="px-6 py-4">
          <ActivityFeedList groups={groups} />
        </div>
      )}
    </motion.div>
  );
};

export default ClientActivityTimeline;
