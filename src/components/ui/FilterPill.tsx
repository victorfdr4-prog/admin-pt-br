import { X } from 'lucide-react';

interface FilterPillProps {
  label: string;
  onRemove?: () => void;
  variant?: 'default' | 'primary' | 'secondary';
  className?: string;
}

const variantClasses = {
  default: 'bg-card border-border text-text-primary hover:bg-border',
  primary: 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20',
  secondary: 'bg-secondary/10 border-secondary/30 text-secondary hover:bg-secondary/20',
};

export function FilterPill({
  label,
  onRemove,
  variant = 'default',
  className = '',
}: FilterPillProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${variantClasses[variant]} ${className}`}
    >
      <span>{label}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="inline-flex items-center justify-center transition-colors hover:opacity-70"
          aria-label={`Remover ${label}`}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
