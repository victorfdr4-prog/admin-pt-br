import React from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarDayPost {
  id: string;
  title: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter';
  time?: string;
  onClick?: () => void;
}

interface CalendarDayColumnProps {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  posts: CalendarDayPost[];
  onAddPost?: () => void;
  className?: string;
}

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'scheduled':
      return <Clock size={12} className="text-blue-500" />;
    case 'published':
      return <CheckCircle2 size={12} className="text-emerald-500" />;
    case 'failed':
      return <AlertCircle size={12} className="text-rose-500" />;
    default:
      return null;
  }
};

const PlatformColor: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  linkedin: 'bg-sky-100 text-sky-700',
  twitter: 'bg-cyan-100 text-cyan-700',
};

export const CalendarDayColumn: React.FC<CalendarDayColumnProps> = ({
  date,
  dayNumber,
  isCurrentMonth,
  isToday,
  posts,
  onAddPost,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'rounded-lg border bg-white overflow-hidden transition-colors',
        isToday ? 'border-primary bg-primary/5' : 'border-border',
        !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
        className
      )}
    >
      {/* Day header */}
      <div className={cn(
        'flex items-center justify-between p-2 border-b border-border',
        isToday && 'bg-primary/10'
      )}>
        <span className={cn(
          'text-sm font-semibold',
          isToday && 'text-primary',
          !isCurrentMonth && 'text-muted-foreground'
        )}>
          {dayNumber}
        </span>
        {onAddPost && (
          <motion.button
            type="button"
            onClick={onAddPost}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-xs font-medium text-primary hover:bg-primary/10 rounded px-1.5 py-0.5 transition-colors"
          >
            +
          </motion.button>
        )}
      </div>

      {/* Posts list */}
      <div className="divide-y divide-border max-h-32 overflow-y-auto">
        {posts.length === 0 ? (
          <div className="p-2 text-center text-xs text-muted-foreground">
            {isCurrentMonth ? 'Sem posts' : ''}
          </div>
        ) : (
          posts.map((post, index) => (
            <motion.button
              key={post.id}
              type="button"
              onClick={post.onClick}
              custom={index}
              variants={{
                hidden: { opacity: 0, y: -5 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { delay: index * 0.03 },
                },
              }}
              initial="hidden"
              animate="visible"
              whileHover={{ x: 2 }}
              className="w-full text-left p-2 hover:bg-border/30 transition-colors"
            >
              <div className="flex items-start gap-1.5 min-w-0">
                <StatusIcon status={post.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">
                    {post.title}
                  </p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className={cn(
                      'inline-flex items-center rounded px-1 py-0 text-xs font-medium',
                      PlatformColor[post.platform]
                    )}>
                      {post.platform.charAt(0).toUpperCase() + post.platform.slice(1)}
                    </span>
                    {post.time && (
                      <span className="text-xs text-muted-foreground">
                        {post.time}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>
    </motion.div>
  );
};
