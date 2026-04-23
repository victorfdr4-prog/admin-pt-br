interface SectionBlockProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionBlock({
  title,
  description,
  children,
  className = '',
}: SectionBlockProps) {
  return (
    <div
      className={`space-y-4 rounded-lg border border-border bg-surface p-6 ${className}`}
    >
      <div>
        <h3 className="font-semibold text-text-primary">{title}</h3>
        {description && (
          <p className="text-sm text-text-secondary">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
