import React from 'react';
import { Save, Upload, Trash2 } from 'lucide-react';

export interface BrandingForm {
  agency_name: string;
  primary_color: string;
  logo_url: string;
}

const DEFAULT_PRIMARY_COLOR = '#4F7DF3';
const DEFAULT_AGENCY_NAME = 'Cromia';

interface Props {
  branding: BrandingForm;
  setBranding: React.Dispatch<React.SetStateAction<BrandingForm>>;
  saving: boolean;
  onSave: () => void;
  onLogoUpload: (file: File) => void;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
}

export const BrandingPanel: React.FC<Props> = ({
  branding,
  setBranding,
  saving,
  onSave,
  onLogoUpload,
  logoInputRef,
}) => (
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
    <div className="section-panel p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nome da agência</label>
          <input
            value={branding.agency_name}
            onChange={(e) => setBranding((c) => ({ ...c, agency_name: e.target.value }))}
            className="field-control"
            placeholder="CromiaOS"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cor principal</label>
          <input
            value={branding.primary_color}
            onChange={(e) => setBranding((c) => ({ ...c, primary_color: e.target.value }))}
            className="field-control"
            placeholder="#4F7DF3"
          />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Logo</label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => logoInputRef.current?.click()} className="btn-secondary h-9">
                <Upload size={14} />
                Upload
              </button>
              <button
                type="button"
                onClick={() => setBranding((c) => ({ ...c, logo_url: '' }))}
                className="btn-secondary h-9 text-destructive hover:border-destructive/30 hover:text-destructive"
              >
                <Trash2 size={14} />
                Remover
              </button>
            </div>
          </div>
          <input
            value={branding.logo_url}
            onChange={(e) => setBranding((c) => ({ ...c, logo_url: e.target.value }))}
            className="field-control"
            placeholder="https://..."
          />
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onLogoUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onSave} disabled={saving} className="btn-primary">
          <Save size={16} />
          {saving ? 'Salvando...' : 'Salvar identidade'}
        </button>
      </div>
    </div>

    <div className="self-start rounded-[16px] border border-border/70 bg-transparent p-4">
      <div className="flex items-center gap-3">
        {branding.logo_url ? (
          <img src={branding.logo_url} alt={branding.agency_name} className="h-12 w-12 rounded-2xl border border-border object-cover" />
        ) : (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white"
            style={{ backgroundColor: branding.primary_color || DEFAULT_PRIMARY_COLOR }}
          >
            {(branding.agency_name || DEFAULT_AGENCY_NAME).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{branding.agency_name || DEFAULT_AGENCY_NAME}</p>
          <p className="truncate text-xs text-muted-foreground">{branding.primary_color || DEFAULT_PRIMARY_COLOR}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Usado na lateral, topo e telas principais.</p>
    </div>
  </div>
);
