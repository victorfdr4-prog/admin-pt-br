import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Edit, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIntakeTemplates, useSaveIntakeTemplate, useDeleteIntakeTemplate } from '@/hooks/useIntake';
import { toast } from 'sonner';
import type { IntakeTemplate, IntakeType } from '@/services/intake.service';

const INTAKE_TYPES: { value: IntakeType; label: string }[] = [
  { value: 'general', label: 'Geral' },
  { value: 'creative', label: 'Criativa' },
  { value: 'campaign', label: 'Campanha' },
  { value: 'support', label: 'Suporte' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'internal', label: 'Interna' },
];

interface CreateIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: IntakeTemplate | null;
  onSave: (template: Partial<IntakeTemplate> & { name: string; type: IntakeType }) => Promise<void>;
}

const CreateIntakeModal: React.FC<CreateIntakeModalProps> = ({
  isOpen,
  onClose,
  template,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<IntakeTemplate> & { name: string; type: IntakeType }>({
    name: template?.name || '',
    type: template?.type || 'general',
    fields: template?.fields || [],
    auto_create_task: template?.auto_create_task || false,
    default_priority: template?.default_priority || 'medium',
    sla_hours: template?.sla_hours || null,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome do template é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        id: template?.id,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl border border-border shadow-lg max-w-md w-full max-h-[90vh] overflow-auto">
              {/* Header */}
              <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 sticky top-0 bg-white">
                <h2 className="text-lg font-semibold text-foreground">
                  {template ? 'Editar template' : 'Novo template'}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 hover:bg-border rounded-lg transition-colors"
                >
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Nome *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Ex: Criativa de Produto"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Tipo *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as IntakeType })}
                    className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {INTAKE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Prioridade padrão</label>
                  <select
                    value={formData.default_priority || 'medium'}
                    onChange={(e) => setFormData({ ...formData, default_priority: e.target.value as any })}
                    className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">SLA (horas)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.sla_hours || ''}
                    onChange={(e) => setFormData({ ...formData, sla_hours: e.target.value ? parseInt(e.target.value) : null })}
                    className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Ex: 24"
                  />
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.auto_create_task || false}
                    onChange={(e) => setFormData({ ...formData, auto_create_task: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-foreground">Criar tarefa automaticamente</span>
                </label>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-border/30 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const IntakePanel: React.FC = () => {
  const { data: templates = [] } = useIntakeTemplates(false);
  const saveTemplateMutation = useSaveIntakeTemplate();
  const deleteTemplateMutation = useDeleteIntakeTemplate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<IntakeTemplate | null>(null);

  const handleOpenCreate = () => {
    setSelectedTemplate(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (template: IntakeTemplate) => {
    setSelectedTemplate(template);
    setIsModalOpen(true);
  };

  const handleSaveTemplate = async (data: Partial<IntakeTemplate> & { name: string; type: IntakeType }) => {
    try {
      await saveTemplateMutation.mutateAsync(data);
      toast.success(selectedTemplate ? 'Template atualizado' : 'Template criado');
    } catch (error) {
      toast.error('Erro ao salvar template');
      throw error;
    }
  };

  const handleDeleteTemplate = (template: IntakeTemplate) => {
    if (confirm(`Tem certeza que deseja deletar "${template.name}"?`)) {
      deleteTemplateMutation.mutate(template.id, {
        onSuccess: () => toast.success('Template deletado'),
        onError: () => toast.error('Erro ao deletar template'),
      });
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Templates de Solicitação</h3>
            <p className="text-sm text-muted-foreground mt-1">Gerenciar formulários de intake personalizados</p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            Novo template
          </button>
        </div>

        {/* Templates List */}
        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="rounded-2xl border border-border bg-muted/30 px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum template criado</p>
            </div>
          ) : (
            templates.map((template) => (
              <motion.div
                key={template.id}
                layout
                className="group rounded-2xl border border-border bg-white p-4 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground">{template.name}</h4>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                      <span>{INTAKE_TYPES.find((t) => t.value === template.type)?.label || template.type}</span>
                      {template.sla_hours && <span>SLA: {template.sla_hours}h</span>}
                      {template.auto_create_task && <span>✓ Auto-tarefa</span>}
                    </div>
                  </div>

                  {/* Active toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={template.is_active !== false}
                      onChange={async (e) => {
                        try {
                          await saveTemplateMutation.mutateAsync({
                            ...template,
                            is_active: e.target.checked,
                          });
                        } catch (error) {
                          toast.error('Erro ao atualizar template');
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {template.is_active !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </label>

                  {/* Actions */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(template)}
                      className="p-2 hover:bg-border rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit size={16} className="text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(template)}
                      className="p-2 hover:bg-border rounded-lg transition-colors"
                      title="Deletar"
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      <CreateIntakeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        template={selectedTemplate}
        onSave={handleSaveTemplate}
      />
    </>
  );
};
