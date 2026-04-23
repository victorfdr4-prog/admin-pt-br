import React from 'react';
import { Save } from 'lucide-react';
import { InlineSwitch } from './_shared';

interface GoogleDriveForm {
  folder_pattern: string;
  uppercase: boolean;
  ramo_fallback: string;
  fallback_folder: string;
  subfolders: string[];
  extension_rules: Record<string, string>;
}

interface Props {
  googleDrive: GoogleDriveForm;
  setGoogleDrive: React.Dispatch<React.SetStateAction<GoogleDriveForm>>;
  foldersText: string;
  setFoldersText: (v: string) => void;
  rulesText: string;
  setRulesText: (v: string) => void;
  googleDriveSubfolders: string[];
  folderPreview: string;
  saving: boolean;
  onSave: () => void;
  onSortFolders: () => void;
  onSortRules: () => void;
}

export const IntegrationsPanel: React.FC<Props> = ({
  googleDrive,
  setGoogleDrive,
  foldersText,
  setFoldersText,
  rulesText,
  setRulesText,
  googleDriveSubfolders,
  folderPreview,
  saving,
  onSave,
  onSortFolders,
  onSortRules,
}) => (
  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
    <div className="rounded-[22px] border border-[#f1f1f1] bg-transparent p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Estrutura automática de pastas</h3>
          <p className="text-sm text-muted-foreground">Nome, ordem e roteamento organizados em ordem alfabética.</p>
        </div>
        <button type="button" onClick={onSave} disabled={saving} className="btn-primary h-10">
          <Save size={16} />
          {saving ? 'Salvando...' : 'Salvar padrão'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nome da pasta principal</label>
          <input
            value={googleDrive.folder_pattern}
            onChange={(e) => setGoogleDrive((c) => ({ ...c, folder_pattern: e.target.value }))}
            className="field-control"
            placeholder="[CROMIA]_{cliente}_{ramo}"
          />
          <p className="text-xs text-muted-foreground">Tokens: {'{cliente}'} e {'{ramo}'}.</p>
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ramo padrão</label>
          <input
            value={googleDrive.ramo_fallback}
            onChange={(e) => setGoogleDrive((c) => ({ ...c, ramo_fallback: e.target.value }))}
            className="field-control"
            placeholder="GERAL"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[#f1f1f1] bg-transparent p-3">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Escrita</label>
          <div className="mt-3">
            <InlineSwitch
              checked={googleDrive.uppercase}
              onToggle={() => setGoogleDrive((c) => ({ ...c, uppercase: !c.uppercase }))}
              label={googleDrive.uppercase ? 'Maiúsculas' : 'Original'}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pasta de contingência</label>
          <input
            value={googleDrive.fallback_folder}
            onChange={(e) => setGoogleDrive((c) => ({ ...c, fallback_folder: e.target.value }))}
            className="field-control"
            placeholder="00_OUTROS"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#f1f1f1] bg-transparent p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Subpastas do cliente</label>
              <p className="mt-1 text-xs text-muted-foreground">Uma linha por pasta, sem duplicar nomes.</p>
            </div>
            <button type="button" onClick={onSortFolders} className="text-xs font-semibold text-primary transition hover:opacity-80">
              Ordenar A-Z
            </button>
          </div>
          <textarea
            value={foldersText}
            onChange={(e) => setFoldersText(e.target.value)}
            rows={9}
            className="field-control mt-3 min-h-[220px] resize-none font-mono text-sm leading-6"
            placeholder={'01_LOGO\n02_FOTOS\n03_EDITAVEIS'}
          />
          <p className="mt-2 text-xs text-muted-foreground">A lista salva a ordem alfabética automaticamente.</p>
        </div>

        <div className="rounded-2xl border border-[#f1f1f1] bg-transparent p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Regras por extensão</label>
              <p className="mt-1 text-xs text-muted-foreground">Formato `extensão=pasta` com prioridade alfabética.</p>
            </div>
            <button type="button" onClick={onSortRules} className="text-xs font-semibold text-primary transition hover:opacity-80">
              Ordenar A-Z
            </button>
          </div>
          <textarea
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
            rows={9}
            className="field-control mt-3 min-h-[220px] resize-none font-mono text-sm leading-6"
            placeholder={'png=02_FOTOS\npsd=03_EDITAVEIS\nmp3=06_AUDIO'}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Exemplo: <span className="font-medium text-foreground">png=02_FOTOS</span>
          </p>
        </div>
      </div>
    </div>

    <div className="space-y-4">
      <div className="rounded-[22px] border border-[#f1f1f1] bg-transparent p-4">
        <div className="mt-3 rounded-2xl border border-[#f1f1f1] bg-transparent p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pasta principal</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{folderPreview}</p>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#f1f1f1] px-3 py-2 text-sm">
          <span className="text-muted-foreground">Contingência</span>
          <strong className="text-foreground">{googleDrive.fallback_folder || 'Não definido'}</strong>
        </div>
      </div>

      <div className="rounded-[22px] border border-[#f1f1f1] bg-transparent p-4">
        <p className="text-sm text-muted-foreground">A automação cria as pastas nessa ordem.</p>
        <div className="mt-3 space-y-2">
          {googleDriveSubfolders.map((folder, i) => (
            <div key={`${folder}-${i}`} className="flex items-center justify-between rounded-2xl border border-[#f1f1f1] px-3 py-2 text-sm">
              <span className="truncate text-foreground">{folder}</span>
              <span className="text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
