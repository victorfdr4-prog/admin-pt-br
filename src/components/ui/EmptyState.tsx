interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'py-8',
  md: 'py-12',
  lg: 'py-16',
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card ${sizeClasses[size]} ${className}`}
    >
      {icon && (
        <div className="mb-4 text-text-tertiary" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="mb-2 font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="mb-4 max-w-xs text-center text-sm text-text-secondary">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
