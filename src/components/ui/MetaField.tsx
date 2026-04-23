interface MetaFieldProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  copyable?: boolean;
  className?: string;
}

export function MetaField({
  label,
  value,
  icon,
  onClick,
  copyable = false,
  className = '',
}: MetaFieldProps) {
  const handleCopy = () => {
    if (typeof value === 'string' && copyable) {
      navigator.clipboard.writeText(value);
    }
  };

  return (
    <div
      className={`flex items-center justify-between rounded-md bg-card px-3 py-2.5 ${onClick ? 'cursor-pointer hover:bg-border' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {icon && <span className="flex-shrink-0 text-text-secondary">{icon}</span>}
        <div>
          <p className="text-xs text-text-tertiary">{label}</p>
          <p className="text-sm font-medium text-text-primary">{value}</p>
        </div>
      </div>
      {copyable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          className="text-xs text-text-secondary hover:text-text-primary"
        >
          Copiar
        </button>
      )}
    </div>
  );
}
