import { InboxIcon } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

interface BoardEmptyStateProps {
  onCreateTask: () => void;
}

export function BoardEmptyState({ onCreateTask }: BoardEmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <EmptyState
        icon={<InboxIcon size={48} />}
        title="Nenhuma tarefa no quadro"
        description="Crie sua primeira tarefa ou adicione uma existente para começar a gerenciar o trabalho."
        action={{
          label: 'Criar Tarefa',
          onClick: onCreateTask,
        }}
        size="lg"
      />
    </div>
  );
}
