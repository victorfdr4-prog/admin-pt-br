import React from 'react';
import { Save, Trash2, Plus } from 'lucide-react';

interface Props {
  plans: string[];
  planDraft: string;
  setPlanDraft: (v: string) => void;
  onAdd: () => void;
  onRemove: (plan: string) => void;
  saving: boolean;
  onSave: () => void;
}

export const PlansPanel: React.FC<Props> = ({
  plans,
  planDraft,
  setPlanDraft,
  onAdd,
  onRemove,
  saving,
  onSave,
}) => (
  <div className="space-y-4">
    <div className="section-panel p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Novo serviço</label>
          <input
            value={planDraft}
            onChange={(e) => setPlanDraft(e.target.value)}
            className="field-control"
            placeholder="Ex.: Gestão de Conteúdo Mensal"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAdd();
              }
            }}
          />
        </div>
        <button type="button" onClick={onAdd} className="btn-secondary">
          <Plus size={16} />
          Adicionar
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan} className="section-panel flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{plan}</p>
              <p className="text-xs text-muted-foreground">Serviço disponível no cadastro de clientes</p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(plan)}
              className="rounded-full border border-border px-2 py-1 text-muted-foreground transition hover:border-destructive/30 hover:text-destructive"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!plans.length ? (
          <div className="rounded-3xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground md:col-span-2">
            Nenhum serviço configurado ainda.
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Catálogo usado no cadastro e na edição operacional de clientes.</p>
        <button type="button" onClick={onSave} disabled={saving} className="btn-primary">
          <Save size={16} />
          {saving ? 'Salvando...' : 'Salvar serviços'}
        </button>
      </div>
    </div>
  </div>
);
