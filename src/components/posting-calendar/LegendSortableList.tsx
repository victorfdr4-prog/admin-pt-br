import React from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import type { PostingCalendarLegendItem } from '@/domain/agencyPlatform';

const getContrastTextColor = (hex: string | null | undefined, fallback = '#27354d') => {
  const normalized = String(hex || '').trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) return fallback;
  const full =
    normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;
  const red = parseInt(full.slice(1, 3), 16);
  const green = parseInt(full.slice(3, 5), 16);
  const blue = parseInt(full.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.68 ? '#27354d' : '#ffffff';
};

type LegendSortableListProps = {
  items: PostingCalendarLegendItem[];
  onChange: (index: number, patch: Partial<PostingCalendarLegendItem>) => void;
  onRemove: (index: number) => void;
  onReorder: (items: PostingCalendarLegendItem[]) => void;
};

type LegendItemRowProps = {
  item: PostingCalendarLegendItem;
  index: number;
  onChange: (index: number, patch: Partial<PostingCalendarLegendItem>) => void;
  onRemove: (index: number) => void;
};

const LegendItemRow: React.FC<LegendItemRowProps> = ({ item, index, onChange, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.75 : 1,
        zIndex: isDragging ? 10 : 1,
        position: 'relative'
      }}
      className="group flex w-full items-center gap-2"
    >
      {/* Botão de Arrastar (Grip) */}
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-grab active:cursor-grabbing transition-colors"
        title="Mover categoria"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      {/* A Pílula Premium */}
      <div className="flex min-w-0 flex-1 items-center gap-2 bg-slate-50 border border-slate-200 pl-3 pr-1.5 py-1.5 rounded-full shadow-sm hover:border-slate-300 hover:bg-white transition-all">
        
        {/* Seletor de Cor (Bolinha) */}
        <div className="relative flex-shrink-0 w-4 h-4 rounded-full overflow-hidden shadow-inner border border-black/5" style={{ backgroundColor: item.color }}>
          <input
            type="color"
            value={item.color}
            onChange={(event) =>
              onChange(index, {
                color: event.target.value,
                textColor: getContrastTextColor(event.target.value, item.textColor || '#27354d'),
              })
            }
            className="absolute -top-2 -left-2 w-8 h-8 cursor-pointer border-0 opacity-0"
            title="Mudar cor"
          />
        </div>

        {/* Input de Texto Transparente */}
        <input
          value={item.label}
          onChange={(event) =>
            onChange(index, {
              label: event.target.value,
            })
          }
          className="min-w-0 flex-1 bg-transparent border-none text-[13px] font-semibold text-slate-700 outline-none focus:ring-0 px-1"
          placeholder="Nome da Legenda"
        />

        {/* Botão Excluir (X) */}
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Remover legenda"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

const LegendSortableList: React.FC<LegendSortableListProps> = ({
  items,
  onChange,
  onRemove,
  onReorder,
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  if (!items || items.length === 0) {
    return <p className="text-sm text-slate-500 italic py-2">Nenhuma legenda adicionada.</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2.5">
          {items.map((item, index) => (
            <LegendItemRow
              key={item.id}
              item={item}
              index={index}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default LegendSortableList;
