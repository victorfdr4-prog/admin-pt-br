import React from 'react';
import { Save, Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineSwitch } from './_shared';

type BoardViewMode = 'table' | 'kanban';

interface PipelineColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

interface BoardTableColumn {
  id: string;
  label: string;
  visible: boolean;
  client_visible: boolean;
  order: number;
}

interface Props {
  orderedPipelineColumns: PipelineColumn[];
  orderedBoardTableColumns: BoardTableColumn[];
  boardDefaultView: BoardViewMode;
  pipelineDraft: string;
  pipelineColor: string;
  setPipelineDraft: (v: string) => void;
  setPipelineColor: (v: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: (id: string) => void;
  onUpdateColumn: (id: string, update: Partial<PipelineColumn>) => void;
  onMoveColumn: (id: string, dir: -1 | 1) => void;
  setBoardDefaultView: (mode: BoardViewMode) => void;
  onUpdateBoardTableColumn: (id: string, update: Partial<BoardTableColumn>) => void;
  onMoveBoardTableColumn: (id: string, dir: -1 | 1) => void;
  savingPipeline: boolean;
  savingBoardLayout: boolean;
  onSavePipeline: () => void;
  onSaveBoardLayout: () => void;
}

export const PipelinePanel: React.FC<Props> = ({
  orderedPipelineColumns,
  orderedBoardTableColumns,
  boardDefaultView,
  pipelineDraft,
  pipelineColor,
  setPipelineDraft,
  setPipelineColor,
  onAddColumn,
  onRemoveColumn,
  onUpdateColumn,
  onMoveColumn,
  setBoardDefaultView,
  onUpdateBoardTableColumn,
  onMoveBoardTableColumn,
  savingPipeline,
  savingBoardLayout,
  onSavePipeline,
  onSaveBoardLayout,
}) => (
  <div className="space-y-4">
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      {/* Pipeline columns */}
      <div className="section-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Workflow size={17} className="text-primary" />
            Etapas do board
          </h3>
          <button type="button" onClick={onSavePipeline} disabled={savingPipeline} className="btn-primary h-10">
            <Save size={16} />
            {savingPipeline ? 'Salvando...' : 'Salvar pipeline'}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nova etapa</label>
            <input
              value={pipelineDraft}
              onChange={(e) => setPipelineDraft(e.target.value)}
              className="field-control"
              placeholder="Ex.: Em revisão"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onAddColumn(); }
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cor</label>
            <input
              type="color"
              value={pipelineColor}
              onChange={(e) => setPipelineColor(e.target.value)}
              className="h-10 w-14 rounded-2xl border border-border bg-white p-1"
            />
          </div>
          <button type="button" onClick={onAddColumn} className="btn-secondary h-10">
            <Plus size={16} />
            Adicionar
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {orderedPipelineColumns.map((col, i) => (
            <div key={col.id} className="flex flex-wrap items-center gap-3 rounded-[18px] border border-border/70 bg-white px-4 py-3">
              <span className="text-xs font-semibold text-muted-foreground">{i + 1}.</span>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: col.color }} />
              <input
                value={col.title}
                onChange={(e) => onUpdateColumn(col.id, { title: e.target.value })}
                className="field-control max-w-[260px] flex-1"
                placeholder="Nome do estágio"
              />
              <input
                type="color"
                value={col.color}
                onChange={(e) => onUpdateColumn(col.id, { color: e.target.value })}
                className="h-10 w-14 rounded-2xl border border-border bg-white p-1"
              />
              <button type="button" onClick={() => onMoveColumn(col.id, -1)} disabled={i === 0} className="btn-secondary h-8 w-8 px-0">
                <ChevronUp size={14} />
              </button>
              <button type="button" onClick={() => onMoveColumn(col.id, 1)} disabled={i === orderedPipelineColumns.length - 1} className="btn-secondary h-8 w-8 px-0">
                <ChevronDown size={14} />
              </button>
              <button type="button" onClick={() => onRemoveColumn(col.id)} className="btn-secondary h-8 w-8 px-0 text-destructive hover:border-destructive/30 hover:text-destructive">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!orderedPipelineColumns.length ? (
            <div className="rounded-[18px] border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              Nenhuma etapa configurada.
            </div>
          ) : null}
        </div>
      </div>

      {/* Board layout */}
      <div className="space-y-4">
        <div className="section-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Colunas visíveis</h3>
              <p className="mt-1 text-xs text-muted-foreground">Controle o que aparece no painel interno e no portal do cliente.</p>
            </div>
            <button type="button" onClick={onSaveBoardLayout} disabled={savingBoardLayout} className="btn-primary h-10">
              <Save size={16} />
              {savingBoardLayout ? 'Salvando...' : 'Salvar colunas'}
            </button>
          </div>
          <div className="mt-5 space-y-2">
            {orderedBoardTableColumns.map((col, i) => (
              <div key={col.id} className="flex flex-wrap items-center gap-3 rounded-[18px] border border-border/70 bg-white px-4 py-3">
                <span className="text-xs font-semibold text-muted-foreground">{i + 1}.</span>
                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-medium text-foreground">{col.label}</p>
                  <p className="text-xs text-muted-foreground">{col.visible ? 'Mostrando' : 'Oculta'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <InlineSwitch
                    checked={col.visible}
                    onToggle={() => onUpdateBoardTableColumn(col.id, { visible: !col.visible })}
                    label={col.visible ? 'Admin' : 'Oculta'}
                  />
                  <InlineSwitch
                    checked={col.client_visible}
                    onToggle={() => onUpdateBoardTableColumn(col.id, { client_visible: !col.client_visible })}
                    label={col.client_visible ? 'Cliente' : 'Portal off'}
                  />
                </div>
                <button type="button" onClick={() => onMoveBoardTableColumn(col.id, -1)} disabled={i === 0} className="btn-secondary h-8 w-8 px-0">
                  <ChevronUp size={14} />
                </button>
                <button type="button" onClick={() => onMoveBoardTableColumn(col.id, 1)} disabled={i === orderedBoardTableColumns.length - 1} className="btn-secondary h-8 w-8 px-0">
                  <ChevronDown size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="section-panel p-4">
          <div className="mt-3 flex items-center gap-2">
            {(['table', 'kanban'] as BoardViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setBoardDefaultView(mode)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                  boardDefaultView === mode
                    ? 'border-[#17233b] bg-[#17233b] text-white'
                    : 'border-border/70 bg-white text-muted-foreground hover:border-primary/20 hover:text-foreground'
                )}
              >
                {mode === 'table' ? 'Tabela' : 'Kanban'}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No board, selecione um cliente e use <strong className="text-foreground">Colunas</strong> para salvar um pipeline só dele.
          </p>
        </div>
      </div>
    </div>
  </div>
);
