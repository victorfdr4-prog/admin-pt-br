import React from 'react';
import { motion } from 'framer-motion';
import { VARIANTS } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { CalendarDayColumn } from './CalendarDayColumn';

interface DayPost {
  id: string;
  title: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter';
  time?: string;
  onClick?: () => void;
}

interface DayData {
  date: Date;
  posts: DayPost[];
}

interface CalendarMonthViewProps {
  month: Date;
  daysData: Map<number, DayData>;
  onAddPost?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
  className?: string;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  month,
  daysData,
  onAddPost,
  onDayClick,
  className,
}) => {
  // Get first day of month and total days
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const daysInPrevMonth = new Date(month.getFullYear(), month.getMonth(), 0).getDate();

  // Build calendar grid
  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean; dayNumber: number }> = [];

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const date = new Date(month.getFullYear(), month.getMonth() - 1, dayNum);
    calendarDays.push({ date, isCurrentMonth: false, dayNumber: dayNum });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(month.getFullYear(), month.getMonth(), i);
    calendarDays.push({ date, isCurrentMonth: true, dayNumber: i });
  }

  // Next month days
  const remainingDays = 42 - calendarDays.length; // 6 weeks × 7 days
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(month.getFullYear(), month.getMonth() + 1, i);
    calendarDays.push({ date, isCurrentMonth: false, dayNumber: i });
  }

  const today = new Date();
  const isCurrentMonth = 
    today.getFullYear() === month.getFullYear() && 
    today.getMonth() === month.getMonth();

  return (
    <motion.div
      variants={VARIANTS.slideInUp}
      initial="hidden"
      animate="visible"
      className={cn('rounded-2xl border border-border bg-white p-6 overflow-hidden', className)}
    >
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2 auto-rows-max">
        {calendarDays.map((day, index) => {
          const dayData = day.isCurrentMonth ? daysData.get(day.dayNumber) : undefined;
          const isToday = 
            isCurrentMonth && 
            day.isCurrentMonth && 
            day.dayNumber === today.getDate();

          return (
            <motion.div
              key={`${day.dayNumber}-${day.isCurrentMonth ? 'current' : 'other'}`}
              custom={index}
              variants={{
                hidden: { opacity: 0, scale: 0.8 },
                visible: {
                  opacity: 1,
                  scale: 1,
                  transition: { delay: (index % 7) * 0.02 + Math.floor(index / 7) * 0.05 },
                },
              }}
              initial="hidden"
              animate="visible"
              onClick={() => day.isCurrentMonth && onDayClick?.(day.date)}
              className={day.isCurrentMonth ? 'cursor-pointer' : ''}
            >
              <CalendarDayColumn
                date={day.date}
                dayNumber={day.dayNumber}
                isCurrentMonth={day.isCurrentMonth}
                isToday={isToday}
                posts={dayData?.posts || []}
                onAddPost={() => onAddPost?.(day.date)}
              />
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
