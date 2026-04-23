import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backHref) {
      navigate(backHref);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-5">
      <div className="flex items-center gap-4">
        {backHref && (
          <button
            onClick={handleBack}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-card"
            aria-label="Voltar"
          >
            <ChevronLeft size={20} className="text-text-secondary" />
          </button>
        )}
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
          {subtitle && (
            <p className="text-sm text-text-secondary">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
