import { cn } from '@/utils/cn';
import type { ClientHealth } from '@/services/health.service';

interface HealthBadgeProps {
  status: ClientHealth['status'];
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_CONFIG = {
  healthy:   { label: 'Saudável',  dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200' },
  attention: { label: 'Atenção',   dot: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  critical:  { label: 'Crítico',   dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200' },
};

export function HealthBadge({ status, score, showScore = false, size = 'sm', className }: HealthBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.attention;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        config.badge,
        className
      )}
    >
      <span className={cn('rounded-full shrink-0', size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2', config.dot)} />
      {config.label}
      {showScore && score !== undefined && (
        <span className="opacity-60">({score})</span>
      )}
    </span>
  );
}

// Só o ponto colorido, sem texto
export function HealthDot({ status, className }: { status: ClientHealth['status']; className?: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.attention;
  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full shrink-0', config.dot, className)}
      title={config.label}
    />
  );
}
