// src/components/hub/HubCalendar.tsx
import React, { useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import { HubPost } from '@/services/hub.service';
import { HubDayCell } from './HubDayCell';
import { HubPostCard } from './HubPostCard';
import { useMovePost } from '@/hooks/useHubData';
import type { HubFilter } from '@/hooks/useHubFilters';
import { getTodayLocal } from '@/utils/localDate';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells: Array<{ date: string; dayNumber: number; isCurrentMonth: boolean }> = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNumber: d, isCurrentMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNumber: d, isCurrentMonth: true });
  }

  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let d = 1; d <= 7 - remainder; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      cells.push({ date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNumber: d, isCurrentMonth: false });
    }
  }

  return cells;
}

interface Props {
  year: number;
  month: number;
  posts: HubPost[];
  activeFilter: HubFilter;
  onPostClick: (post: HubPost) => void;
  clientId: string;
}

export const HubCalendar: React.FC<Props> = ({ year, month, posts, activeFilter, onPostClick, clientId }) => {
  const movePost = useMovePost();
  const [draggingPost, setDraggingPost] = useState<HubPost | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const today = getTodayLocal();
  const cells = buildCalendarDays(year, month);

  const postsByDate = posts.reduce<Record<string, HubPost[]>>((acc, p) => {
    acc[p.post_date] = acc[p.post_date] ?? [];
    acc[p.post_date].push(p);
    return acc;
  }, {});

  const handleDragStart = (e: DragStartEvent) => {
    const post = posts.find((p) => p.id === e.active.id);
    setDraggingPost(post ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingPost(null);
    const { active, over } = e;
    if (!over) return;

    let targetDate: string | null = null;
    if (String(over.id).startsWith('day-')) {
      targetDate = String(over.id).replace('day-', '');
    } else {
      const targetPost = posts.find((p) => p.id === over.id);
      if (targetPost) targetDate = targetPost.post_date;
    }

    if (!targetDate) return;
    const sourcePost = posts.find((p) => p.id === active.id);
    if (!sourcePost || sourcePost.post_date === targetDate) return;

    movePost.mutate({ postId: String(active.id), newDate: targetDate, clientId, year, month });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 group">
        {cells.map((cell) => (
          <HubDayCell
            key={cell.date}
            date={cell.date}
            dayNumber={cell.dayNumber}
            isToday={cell.date === today}
            isCurrentMonth={cell.isCurrentMonth}
            posts={postsByDate[cell.date] ?? []}
            onPostClick={onPostClick}
            activeFilter={activeFilter}
          />
        ))}
      </div>
      <DragOverlay>
        {draggingPost && <HubPostCard post={draggingPost} onClick={() => {}} />}
      </DragOverlay>
    </DndContext>
  );
};
