import { motion } from 'framer-motion';
import { VARIANTS } from '@/lib/motion';

interface Activity {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: Date;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'info';
}

interface ActivityFeedProps {
  activities: Activity[];
  maxItems?: number;
}

const colorClasses = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600',
  warning: 'bg-amber-500/10 text-amber-600',
  info: 'bg-blue-500/10 text-blue-600',
};

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

export function ActivityFeed({
  activities,
  maxItems = 5,
}: ActivityFeedProps) {
  const displayed = activities.slice(0, maxItems);

  return (
    <div className="space-y-3">
      {displayed.map((activity, i) => (
        <motion.div
          key={activity.id}
          variants={VARIANTS.slideInRight}
          custom={i}
          className="flex gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${colorClasses[activity.color]}`}
          >
            {activity.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary">
              <span className="font-semibold">{activity.actor}</span>{' '}
              {activity.action}
            </p>
            <p className="truncate text-xs text-text-secondary">
              {activity.target}
            </p>
          </div>
          <time className="flex-shrink-0 text-xs text-text-tertiary">
            {formatTime(activity.timestamp)}
          </time>
        </motion.div>
      ))}
    </div>
  );
}
