import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BoardSelectOption {
  value: string;
  label: string;
  description?: string;
  tone?: string | null;
  icon?: React.ReactNode;
  avatarUrl?: string | null;
  initials?: string;
}

interface BoardSelectMenuProps {
  open: boolean;
  selectedValue?: string | null;
  options: BoardSelectOption[];
  placeholder: string;
  onToggle: () => void;
  onSelect: (value: string) => void;
  className?: string;
  menuClassName?: string;
}

const renderOptionVisual = (option?: BoardSelectOption | null, compact = false) => {
  if (!option) return null;

  if (option.avatarUrl) {
    return (
      <img
        src={option.avatarUrl}
        alt={option.label}
        className={cn(
          'shrink-0 rounded-full border border-white/70 object-cover shadow-sm',
          compact ? 'h-6 w-6' : 'h-8 w-8'
        )}
      />
    );
  }

  if (option.icon) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full',
          compact ? 'h-6 w-6' : 'h-8 w-8'
        )}
        style={{
          backgroundColor: option.tone ? `${option.tone}20` : '#eef7db',
          color: option.tone || '#6f8f2f',
        }}
      >
        {option.icon}
      </span>
    );
  }

  if (option.initials) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border font-semibold uppercase shadow-sm',
          compact ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-[11px]'
        )}
        style={{
          borderColor: option.tone ? `${option.tone}30` : '#d6e5b9',
          backgroundColor: option.tone ? `${option.tone}12` : '#f8fbef',
          color: option.tone || '#475569',
        }}
      >
        {option.initials}
      </span>
    );
  }

  if (option.tone) {
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.tone }} />;
  }

  return null;
};

export const BoardSelectMenu: React.FC<BoardSelectMenuProps> = ({
  open,
  selectedValue,
  options,
  placeholder,
  onToggle,
  onSelect,
  className,
  menuClassName,
}) => {
  const selectedOption = options.find((option) => option.value === (selectedValue ?? '')) || null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-[22px] border border-[#dbe5cc] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdf4_100%)] px-4 py-3.5 text-left shadow-[0_12px_30px_rgba(84,104,28,0.08)] transition-all hover:border-[#c7d8ac] hover:shadow-[0_16px_34px_rgba(84,104,28,0.12)]',
          className
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          {renderOptionVisual(selectedOption, false)}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[#0f172a]">
              {selectedOption?.label || placeholder}
            </span>
            {selectedOption?.description ? (
              <span className="mt-0.5 block truncate text-xs text-[#64748b]">{selectedOption.description}</span>
            ) : null}
          </span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-[#8da16a] transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className={cn(
              'absolute left-0 right-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-[26px] border border-[#dde8cf] bg-white p-2 shadow-[0_24px_60px_rgba(84,104,28,0.16)]',
              menuClassName
            )}
          >
            <div className="minimal-scrollbar max-h-64 overflow-y-auto">
              {options.map((option) => {
                const isActive = option.value === (selectedValue ?? '');

                return (
                  <button
                    key={`${option.value}-${option.label}`}
                    type="button"
                    onClick={() => onSelect(option.value)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-[20px] px-3 py-3 text-left transition-colors',
                      isActive ? 'bg-[#f4f9e8]' : 'hover:bg-[#f8fbf1]'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      {renderOptionVisual(option, true)}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#0f172a]">{option.label}</span>
                        {option.description ? (
                          <span className="mt-0.5 block truncate text-xs text-[#64748b]">{option.description}</span>
                        ) : null}
                      </span>
                    </span>
                    {isActive ? (
                      <span className="rounded-full bg-[#1b1c15] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                        Atual
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
