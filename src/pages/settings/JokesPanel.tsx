import React from 'react';
import { Save } from 'lucide-react';

interface Props {
  jokesBulkText: string;
  setJokesBulkText: (v: string) => void;
  jokesScrollTop: number;
  setJokesScrollTop: (v: number) => void;
  jokeLineCount: number;
  jokeValidCount: number;
  saving: boolean;
  onSave: () => void;
  onClearEmpty: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const JokesPanel: React.FC<Props> = ({
  jokesBulkText,
  setJokesBulkText,
  jokesScrollTop,
  setJokesScrollTop,
  jokeLineCount,
  jokeValidCount,
  saving,
  onSave,
  onClearEmpty,
  textareaRef,
}) => (
  <div className="section-panel p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="mt-1 text-lg font-semibold text-foreground">Mensagens de login e painel</h3>
      </div>
      <button type="button" onClick={onSave} disabled={saving} className="btn-primary h-10">
        <Save size={16} />
        {saving ? 'Salvando...' : 'Salvar mensagens'}
      </button>
    </div>

    <div className="mt-5 rounded-[18px] border border-border/70 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Editor</label>
        <button type="button" onClick={onClearEmpty} className="btn-secondary h-9 px-3.5">
          Limpar linhas vazias
        </button>
      </div>
      <div className="mt-3 overflow-hidden rounded-[18px] border border-border/70 bg-[#fbfdf4]">
        <div className="grid grid-cols-[56px_minmax(0,1fr)]">
          <div className="overflow-hidden border-r border-border/70 bg-[#f1f7e4]">
            <div
              className="px-3 py-3 text-right font-mono text-xs leading-7 text-muted-foreground"
              style={{ transform: `translateY(-${jokesScrollTop}px)` }}
            >
              {Array.from({ length: jokeLineCount }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={jokesBulkText}
            onChange={(e) => setJokesBulkText(e.target.value)}
            onScroll={(e) => setJokesScrollTop(e.currentTarget.scrollTop)}
            rows={18}
            className="min-h-[420px] w-full resize-y border-0 bg-transparent px-4 py-3 text-sm leading-7 text-foreground outline-none"
            placeholder={'Uma piada por linha\nEx.: Se o lead não converteu, pelo menos ele passeou bonito 😎'}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{jokeValidCount} linhas válidas</span>
        <span>Todas as linhas salvas ficam ativas no login e no painel operacional.</span>
      </div>
    </div>
  </div>
);
