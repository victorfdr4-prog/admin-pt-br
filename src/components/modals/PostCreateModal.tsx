import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
  clientId?: string | null;
  clients?: Array<{ id: string; name: string }>;
  onCreatePost?: (data: PostCreateData) => Promise<void>;
}

export interface PostCreateData {
  clientId?: string | null;
  title: string;
  content: string;
  platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter';
  scheduledDate: Date;
  scheduledTime: string;
}

export const PostCreateModal: React.FC<PostCreateModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  clientId,
  clients = [],
  onCreatePost,
}) => {
  const [formData, setFormData] = useState<Partial<PostCreateData>>({
    platform: 'instagram',
    scheduledDate: selectedDate,
    scheduledTime: '10:00',
    clientId: clientId || clients[0]?.id || null,
  });
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setFormData({
      platform: 'instagram',
      scheduledDate: selectedDate,
      scheduledTime: '10:00',
      clientId: clientId || clients[0]?.id || null,
    });
    setIsLoading(false);
  }, [isOpen, selectedDate, clientId, clients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content || !formData.scheduledDate) return;

    setIsLoading(true);
    try {
      await onCreatePost?.({
        ...(formData as PostCreateData),
        clientId: formData.clientId || clientId || null,
      });
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl border border-border shadow-lg max-w-lg w-full max-h-[90vh] overflow-auto">
              {/* Header */}
              <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 sticky top-0 bg-white">
                <h2 className="text-lg font-semibold text-foreground">Novo post</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 hover:bg-border rounded-lg transition-colors"
                >
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Título
                  </label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: Promoção de primavera"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Conteúdo
                  </label>
                  <textarea
                    value={formData.content || ''}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px] resize-none"
                    placeholder="Escreva seu conteúdo aqui..."
                  />
                </div>

                {/* Platform */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Plataforma
                  </label>
                  <select
                    value={formData.platform || 'instagram'}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="twitter">Twitter</option>
                  </select>
                </div>

                {/* Client */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Cliente
                  </label>
                  <select
                    value={formData.clientId || ''}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Selecione um cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Schedule Date and Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Data
                    </label>
                    <input
                      type="date"
                      value={formData.scheduledDate ? formData.scheduledDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => setFormData({ ...formData, scheduledDate: new Date(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Hora
                    </label>
                    <input
                      type="time"
                      value={formData.scheduledTime || '10:00'}
                      onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-border/30 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !formData.title || !formData.content || !formData.clientId}
                    className={cn(
                      'flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                      isLoading || !formData.title || !formData.content || !formData.clientId
                        ? 'bg-primary/50 text-primary-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    )}
                  >
                    {isLoading ? 'Criando...' : 'Criar post'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
