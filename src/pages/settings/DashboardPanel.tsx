import React from 'react';
import { Save, ChevronUp, ChevronDown } from 'lucide-react';
import { InlineSwitch } from './_shared';

interface DashboardBlock {
  id: string;
  title: string;
  visible: boolean;
  order: number;
  [key: string]: unknown;
}

interface OperationalRule {
  key: string;
  label: string;
  description?: string;
  threshold?: number;
  enabled: boolean;
  order?: number;
  [key: string]: unknown;
}

interface Props {
  orderedDashboardBlocks: DashboardBlock[];
  orderedOperationalRules: OperationalRule[];
  onUpdateBlock: (id: string, update: Partial<DashboardBlock>) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onUpdateRule: (key: string, update: Partial<OperationalRule>) => void;
  saving: boolean;
  onSave: () => void;
}

export const DashboardPanel: React.FC<Props> = ({
  orderedDashboardBlocks,
  orderedOperationalRules,
  onUpdateBlock,
  onMoveBlock,
  onUpdateRule,
  saving,
  onSave,
}) => (
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
    <div className="section-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Blocos do painel operacional</h3>
          <p className="text-sm text-muted-foreground">Reordene, renomeie e oculte blocos sem depender de código.</p>
        </div>
        <button type="button" onClick={onSave} disabled={saving} className="btn-primary h-10">
          <Save size={16} />
          {saving ? 'Salvando...' : 'Salvar painel'}
        </button>
      </div>
      <div className="mt-5 space-y-2">
        {orderedDashboardBlocks.map((block, index) => (
          <div key={block.id} className="flex flex-wrap items-center gap-3 rounded-[18px] border border-border/70 bg-white px-4 py-3">
            <span className="text-xs font-semibold text-muted-foreground">{index + 1}.</span>
            <input
              value={block.title}
              onChange={(e) => onUpdateBlock(block.id, { title: e.target.value })}
              className="field-control max-w-[260px] flex-1"
              placeholder="Título do bloco"
            />
            <InlineSwitch
              checked={block.visible}
              onToggle={() => onUpdateBlock(block.id, { visible: !block.visible })}
              label={block.visible ? 'Visível' : 'Oculto'}
            />
            <button type="button" onClick={() => onMoveBlock(block.id, -1)} disabled={index === 0} className="btn-secondary h-8 w-8 px-0">
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => onMoveBlock(block.id, 1)}
              disabled={index === orderedDashboardBlocks.length - 1}
              className="btn-secondary h-8 w-8 px-0"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>

    <div className="space-y-4">
      <div className="section-panel p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Regras operacionais</h3>
          <p className="text-sm text-muted-foreground">Ajuste os gatilhos usados para foco, saúde e atividade.</p>
        </div>
        <div className="mt-4 space-y-3">
          {orderedOperationalRules.map((rule) => (
            <div key={rule.key} className="rounded-[18px] border border-border/70 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rótulo</label>
                  <input
                    value={rule.label}
                    onChange={(e) => onUpdateRule(rule.key, { label: e.target.value })}
                    className="field-control"
                    placeholder="Nome da regra"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Limite</label>
                  <input
                    type="number"
                    value={typeof rule.threshold === 'number' ? rule.threshold : ''}
                    onChange={(e) =>
                      onUpdateRule(rule.key, { threshold: e.target.value === '' ? undefined : Number(e.target.value) })
                    }
                    className="field-control"
                    placeholder="0"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Descrição</label>
                  <input
                    value={rule.description || ''}
                    onChange={(e) => onUpdateRule(rule.key, { description: e.target.value })}
                    className="field-control"
                    placeholder="Explique quando essa regra entra em ação."
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <InlineSwitch
                  checked={rule.enabled}
                  onToggle={() => onUpdateRule(rule.key, { enabled: !rule.enabled })}
                  label={rule.enabled ? 'Habilitada' : 'Desabilitada'}
                />
                <span className="text-[11px] text-muted-foreground">{rule.key}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[18px] border border-[#f1f1f1] bg-transparent p-4 text-sm text-muted-foreground">
        Estas regras alimentam o painel operacional, o pulso do sistema e as sugestões de ação.
      </div>
    </div>
  </div>
);
