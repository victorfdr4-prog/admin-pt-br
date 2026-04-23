type StatusVariant =
  | 'pending'
  | 'active'
  | 'success'
  | 'warning'
  | 'error'
  | 'inactive'
  | 'info';

interface StatusChipProps {
  label: string;
  variant: StatusVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<StatusVariant, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-blue-50 text-blue-700 border-blue-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-orange-50 text-orange-700 border-orange-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  inactive: 'bg-gray-50 text-gray-600 border-gray-200',
  info: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export function StatusChip({
  label,
  variant,
  size = 'md',
  icon,
  className = '',
}: StatusChipProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
    </div>
  );
}
