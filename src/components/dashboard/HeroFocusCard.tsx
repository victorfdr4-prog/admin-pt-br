import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { TRANSITIONS, VARIANTS } from '@/lib/motion';

interface HeroFocusCardProps {
  title: string;
  description: string;
  action: {
    label: string;
    href: string;
  };
  icon?: React.ReactNode;
  accent?: 'primary' | 'success' | 'warning' | 'error';
  className?: string;
}

const accentClasses = {
  primary: 'from-primary/10 to-primary/5',
  success: 'from-emerald-500/10 to-emerald-500/5',
  warning: 'from-amber-500/10 to-amber-500/5',
  error: 'from-red-500/10 to-red-500/5',
};

export function HeroFocusCard({
  title,
  description,
  action,
  icon,
  accent = 'primary',
  className = '',
}: HeroFocusCardProps) {
  return (
    <motion.a
      href={action.href}
      variants={VARIANTS.cardHover}
      whileHover="hover"
      className={`group relative block overflow-hidden rounded-xl border border-border bg-gradient-to-br ${accentClasses[accent]} p-6 transition-all hover:border-primary/50 ${className}`}
    >
      <div className="relative space-y-4">
        {icon && (
          <div className="text-4xl opacity-75 group-hover:scale-110 transition-transform">
            {icon}
          </div>
        )}

        <div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">
            {title}
          </h3>
          <p className="text-sm text-text-secondary">{description}</p>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
          <span>{action.label}</span>
          <ArrowRight size={16} />
        </div>
      </div>
    </motion.a>
  );
}
