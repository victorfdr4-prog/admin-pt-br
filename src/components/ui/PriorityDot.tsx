type Priority = 'low' | 'medium' | 'high' | 'urgent';

interface PriorityDotProps {
  priority: Priority;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const priorityConfig = {
  low: {
    color: 'bg-success',
    label: 'Baixa',
  },
  medium: {
    color: 'bg-amber-500',
    label: 'Média',
  },
  high: {
    color: 'bg-orange-500',
    label: 'Alta',
  },
  urgent: {
    color: 'bg-error',
    label: 'Urgente',
  },
};

const sizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
};

export function PriorityDot({
  priority,
  size = 'md',
  showLabel = false,
  className = '',
}: PriorityDotProps) {
  const config = priorityConfig[priority];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`${sizeClasses[size]} ${config.color} rounded-full`}
        aria-label={`Prioridade: ${config.label}`}
      />
      {showLabel && (
        <span className="text-xs font-medium text-text-secondary">
          {config.label}
        </span>
      )}
    </div>
  );
}
