import { useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

interface TaskCreateDialogV2Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (task: {
    title: string;
    description: string;
    clientId: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    dueDate?: string;
  }) => Promise<void>;
  clients: Array<{ id: string; name: string }>;
}

export function TaskCreateDialogV2({
  isOpen,
  onClose,
  onCreate,
  clients,
}: TaskCreateDialogV2Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [priority, setPriority] = useState<
    'low' | 'medium' | 'high' | 'urgent'
  >('medium');
  const [dueDate, setDueDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !clientId) return;

    setIsLoading(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        clientId,
        priority,
        dueDate: dueDate || undefined,
      });
      setTitle('');
      setDescription('');
      setClientId(clients[0]?.id || '');
      setPriority('medium');
      setDueDate('');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50"
      />

      {/* Dialog */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Nova Tarefa</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-card transition-colors"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="space-y-4 p-6"
        >
          <div>
            <label className="text-sm font-medium text-text-primary">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome da tarefa"
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary">
              Cliente
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
              required
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes da tarefa"
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(
                    e.target.value as 'low' | 'medium' | 'high' | 'urgent'
                  )
                }
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-text-primary">
                Vencimento (opcional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </form>

        {/* Actions */}
        <div className="flex gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 font-medium text-text-primary hover:bg-card transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={isLoading || !title.trim() || !clientId}
            className="flex-1 rounded-md bg-primary py-2 font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Criando...' : 'Criar'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
