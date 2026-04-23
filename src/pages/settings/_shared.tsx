import { cn } from '@/lib/utils';

export const InlineSwitch = ({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className={cn(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition',
      checked
        ? 'border-primary/20 bg-primary/10 text-primary'
        : 'border-border/70 bg-white text-muted-foreground hover:border-primary/20 hover:text-foreground'
    )}
  >
    <span
      className={cn(
        'relative inline-flex h-5 w-9 rounded-full border transition',
        checked ? 'border-primary bg-primary' : 'border-border bg-muted'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
          checked ? 'left-4' : 'left-0.5'
        )}
      />
    </span>
    {label}
  </button>
);
