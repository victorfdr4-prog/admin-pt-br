import React from 'react';
import { Save, Upload, Trash2 } from 'lucide-react';

export interface ProfileForm {
  full_name: string;
  username: string;
  email: string;
  avatar_url: string;
}

interface Props {
  profile: ProfileForm;
  setProfile: React.Dispatch<React.SetStateAction<ProfileForm>>;
  saving: boolean;
  onSave: () => void;
  onAvatarUpload: (file: File) => void;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
}

export const ProfilePanel: React.FC<Props> = ({
  profile,
  setProfile,
  saving,
  onSave,
  onAvatarUpload,
  avatarInputRef,
}) => (
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
    <div className="section-panel p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nome completo</label>
          <input
            value={profile.full_name}
            onChange={(e) => setProfile((c) => ({ ...c, full_name: e.target.value }))}
            className="field-control"
            placeholder="Nome do usuário"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Username</label>
          <input
            value={profile.username}
            onChange={(e) => setProfile((c) => ({ ...c, username: e.target.value }))}
            className="field-control"
            placeholder="username"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Email</label>
          <input value={profile.email} className="field-control cursor-not-allowed bg-muted/30" disabled />
        </div>
        <div className="space-y-2 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Avatar</label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => avatarInputRef.current?.click()} className="btn-secondary h-9">
                <Upload size={14} />
                Upload
              </button>
              <button
                type="button"
                onClick={() => setProfile((c) => ({ ...c, avatar_url: '' }))}
                className="btn-secondary h-9 text-destructive hover:border-destructive/30 hover:text-destructive"
              >
                <Trash2 size={14} />
                Remover
              </button>
            </div>
          </div>
          <input
            value={profile.avatar_url}
            onChange={(e) => setProfile((c) => ({ ...c, avatar_url: e.target.value }))}
            className="field-control"
            placeholder="https://..."
          />
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAvatarUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onSave} disabled={saving} className="btn-primary">
          <Save size={16} />
          {saving ? 'Salvando...' : 'Salvar perfil'}
        </button>
      </div>
    </div>

    <div className="self-start rounded-[16px] border border-border/70 bg-transparent p-4">
      <div className="flex items-center gap-3">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.full_name || 'Avatar'} className="h-12 w-12 rounded-2xl border border-border object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
            {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'C'}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{profile.full_name || 'Sem nome'}</p>
          <p className="truncate text-xs text-muted-foreground">@{profile.username || 'usuario'}</p>
          <p className="truncate text-[11px] text-muted-foreground">{profile.email || 'E-mail não carregado'}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Usado no topo do painel e no acesso da conta.</p>
    </div>
  </div>
);
