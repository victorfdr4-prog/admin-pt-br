import { Checkbox } from '@radix-ui/react-checkbox';
import { ChevronRight } from 'lucide-react';
import { PriorityDot } from '../ui/PriorityDot';
import { StatusChip } from '../ui/StatusChip';

interface TaskRowSelectableProps {
  id: string;
  title: string;
  clientName: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assignee?: string;
  isSelected: boolean;
  onSelectionChange: (selected: boolean) => void;
  onClick: () => void;
}

export function TaskRowSelectable({
  id,
  title,
  clientName,
  status,
  priority,
  dueDate,
  assignee,
  isSelected,
  onSelectionChange,
  onClick,
}: TaskRowSelectableProps) {
  return (
    <tr className="border-b border-border hover:bg-card transition-colors cursor-pointer">
      <td className="w-12 px-4 py-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelectionChange}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-border"
        />
      </td>
      <td className="flex-1 px-4 py-3" onClick={onClick}>
        <p className="font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-secondary">{clientName}</p>
      </td>
      <td className="px-4 py-3" onClick={onClick}>
        <StatusChip label={status} variant="active" size="sm" />
      </td>
      <td className="px-4 py-3" onClick={onClick}>
        <PriorityDot priority={priority} showLabel size="sm" />
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary" onClick={onClick}>
        {assignee || '-'}
      </td>
      <td className="px-4 py-3 text-sm text-text-tertiary" onClick={onClick}>
        {dueDate || '-'}
      </td>
      <td className="px-4 py-3 text-right">
        <ChevronRight size={16} className="text-text-tertiary" />
      </td>
    </tr>
  );
}
