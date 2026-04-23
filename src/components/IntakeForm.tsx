import React, { useState } from 'react';
import { cn } from '@/utils/cn';
import type { IntakeTemplate, IntakeTemplateField, CreateIntakeRequestPayload } from '@/services/intake.service';

interface IntakeFormProps {
  template: IntakeTemplate;
  clientId?: string | null;
  onSubmit: (payload: CreateIntakeRequestPayload) => void;
  isPending?: boolean;
  className?: string;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: IntakeTemplateField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const base =
    'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

  if (field.type === 'textarea') {
    return (
      <textarea
        className={cn(base, 'resize-none')}
        placeholder={field.placeholder}
        rows={3}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        className={base}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      >
        <option value="">{field.placeholder ?? 'Selecione...'}</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border text-primary"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-sm text-foreground">{field.placeholder ?? field.label}</span>
      </label>
    );
  }

  if (field.type === 'date') {
    return (
      <input
        type="date"
        className={base}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    );
  }

  // text (default)
  return (
    <input
      type="text"
      className={base}
      placeholder={field.placeholder}
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
    />
  );
}

export const IntakeForm: React.FC<IntakeFormProps> = ({
  template,
  clientId,
  onSubmit,
  isPending,
  className,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const setField = (id: string, value: unknown) =>
    setFormData((prev) => ({ ...prev, [id]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      type: template.type,
      priority: template.default_priority,
      template_id: template.id,
      client_id: clientId ?? null,
      form_data: formData,
      source: 'admin',
    });
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Título <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Descreva brevemente a solicitação"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Descrição</label>
        <textarea
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          placeholder="Detalhes adicionais (opcional)"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Dynamic fields from template */}
      {template.fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          {field.type !== 'checkbox' && (
            <label className="text-xs font-medium text-foreground">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
          )}
          <FieldInput
            field={field}
            value={formData[field.id]}
            onChange={(v) => setField(field.id, v)}
          />
        </div>
      ))}

      <button
        type="submit"
        disabled={isPending || !title.trim()}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Enviando...' : 'Enviar solicitação'}
      </button>
    </form>
  );
};
