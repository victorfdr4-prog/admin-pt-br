import React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApprovalCalendarSummary } from './types';

interface CalendarListProps {
  calendars: ApprovalCalendarSummary[];
  selectedCalendarId: string | null;
  onSelect: (calendarId: string) => void;
}

export default function CalendarList({
  calendars,
  selectedCalendarId,
  onSelect,
}: CalendarListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Calendários</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Competências e ciclos ativos</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {calendars.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Selecione um cliente para listar os calendários com posts em aprovação.
            </div>
          ) : (
            calendars.map((calendar) => {
              const active = selectedCalendarId === calendar.id;
              return (
                <motion.button
                  key={calendar.id}
                  type="button"
                  onClick={() => onSelect(calendar.id)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'w-full rounded-3xl border px-4 py-4 text-left transition-all',
                    active
                      ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                      : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-2xl',
                          active ? 'bg-white/12 text-white' : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        <CalendarDays size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{calendar.label}</p>
                        <p className={cn('mt-1 text-xs', active ? 'text-white/70' : 'text-slate-500')}>
                          {calendar.monthLabel}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className={active ? 'text-white/80' : 'text-slate-400'} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', active ? 'bg-white/12 text-white' : 'bg-slate-100 text-slate-700')}>
                      Total {calendar.totalPosts}
                    </span>
                    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', active ? 'bg-white/12 text-white' : 'bg-blue-50 text-blue-700')}>
                      Interno {calendar.approvedInternally}
                    </span>
                    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', active ? 'bg-white/12 text-white' : 'bg-orange-50 text-orange-700')}>
                      Revisão {calendar.reviewPosts}
                    </span>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
