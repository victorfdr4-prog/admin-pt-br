import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type HealthStatus = 'healthy' | 'attention' | 'critical';

interface HealthBadgeProps {
  score: number; // 0-100
  status?: HealthStatus;
  showTrend?: boolean;
  trendChange?: number; // positive = up, negative = down
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
  className?: string;
}

const statusConfig = {
  healthy: {
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'Saudável',
  },
  attention: {
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'Atenção',
  },
  critical: {
    color: 'bg-red-50 text-red-700 border-red-200',
    label: 'Crítico',
  },
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

const getStatusFromScore = (score: number): HealthStatus => {
  if (score >= 75) return 'healthy';
  if (score >= 50) return 'attention';
  return 'critical';
};

export function HealthBadge({
  score,
  status,
  showTrend = false,
  trendChange,
  size = 'md',
  showScore = true,
  className = '',
}: HealthBadgeProps) {
  const finalStatus = status || getStatusFromScore(score);
  const config = statusConfig[finalStatus];

  let trendIcon = null;
  if (showTrend && trendChange !== undefined) {
    if (trendChange > 0) {
      trendIcon = <TrendingUp size={14} className="flex-shrink-0" />;
    } else if (trendChange < 0) {
      trendIcon = <TrendingDown size={14} className="flex-shrink-0" />;
    } else {
      trendIcon = <Minus size={14} className="flex-shrink-0" />;
    }
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border font-medium transition-colors ${config.color} ${sizeClasses[size]} ${className}`}
    >
      {trendIcon}
      {showScore && <span>{score}</span>}
      <span>{config.label}</span>
    </div>
  );
}
