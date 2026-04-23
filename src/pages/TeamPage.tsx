import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Edit3, KeyRound, Plus, RefreshCw, Save, Search, User, X } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/utils/cn';
import { AdminService, UserService } from '@/services';
import { subscribeRealtimeChange } from '@/lib/realtime';
import {
  ACCESS_SCOPE_LABELS,
  FUNCTIONAL_PROFILE_LABELS,
  SYSTEM_ROLE_LABELS,
  buildAccessContext,
  toLegacyProfileRole,
  type AccessScope,
  type FunctionalProfile,
  type SystemRole,
} from '@/domain/accessControl';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  username: string;
  role: SystemRole;
  roleLabel: string;
  accessScope: AccessScope;
  functionalProfile: FunctionalProfile;
  active: boolean;
  avatar: string | null;
  fullAccess: boolean;
}

interface TeamDraft {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: SystemRole;
  access_scope: AccessScope;
  functional_profile: FunctionalProfile;
  avatar_url: string;
  active: boolean;
  saving: boolean;
  isNew?: boolean;
}

interface GeneratedCredentials {
  name: string;
  password: string;
}

// Gera senha aleatória forte (12 chars: letras + números + símbolo)
const generatePassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$!%';
  const all = upper + lower + digits + symbols;
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  // garantir ao menos 1 de cada tipo
  const pick = (charset: string, rnd: number) => charset[rnd % charset.length];
  const result = [
    pick(upper, arr[0]),
    pick(lower, arr[1]),
    pick(digits, arr[2]),
    pick(symbols, arr[3]),
    ...Array.from(arr.slice(4)).map((b) => all[b % all.length]),
  ];
  // embaralhar
  for (let i = result.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result.join('');
};

const ROLE_CLASSES: Record<SystemRole, string> = {
  admin_estrategico: 'pill-info',
  admin_operacional: 'pill-info',
  gestor: 'pill-warning',
  social_media: 'pill-success',
  equipe: 'pill-muted',
  cliente: 'pill-muted',
  sistema: 'pill-info',
  blocked: 'pill-danger',
};

const ACCESS_SCOPE_CLASSES: Record<AccessScope, string> = {
  full: 'pill-info',
  limited: 'pill-warning',
  client_only: 'pill-muted',
};

const FUNCTIONAL_PROFILE_CLASSES: Record<FunctionalProfile, string> = {
  direcao: 'pill-info',
  operacao: 'pill-muted',
  gestao: 'pill-warning',
  criacao: 'pill-success',
  cliente: 'pill-muted',
};

const TEAM_ROLE_OPTIONS: SystemRole[] = [
  'admin_estrategico',
  'admin_operacional',
  'gestor',
  'social_media',
  'equipe',
  'cliente',
  'blocked',
];

const normalizeMember = (member: any): TeamMember => ({
  ...(() => {
    const access = buildAccessContext({
      role: member.role,
      full_name: member.full_name || member.name || null,
      username: member.username || null,
      email: member.email || null,
      access_scope: member.access_scope || null,
      functional_profile: member.functional_profile || null,
    });

    return {
      id: String(member.id),
      name: String(member.full_name || member.name || 'Sem nome'),
      email: String(member.email || ''),
      username: String(member.username || ''),
      role: access.role,
      roleLabel: access.roleLabel,
      accessScope: access.accessScope,
      functionalProfile: access.functionalProfile,
      active:
        typeof member.active === 'boolean'
          ? member.active
          : typeof member.is_active === 'boolean'
          ? member.is_active
          : true,
      avatar: member.avatar_url ? String(member.avatar_url) : member.avatar ? String(member.avatar) : null,
      fullAccess: access.fullAccess,
    };
  })(),
});

const buildDraft = (member: TeamMember): TeamDraft => ({
  id: member.id,
  full_name: member.name,
  username: member.username,
  email: member.email,
  role: member.role,
  access_scope: member.accessScope,
  functional_profile: member.functionalProfile,
  avatar_url: member.avatar || '',
  active: member.active,
  saving: false,
});

const InlineToggle = ({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className={cn(
      'section-panel flex items-center justify-between gap-4 px-4 py-3 text-left md:col-span-2',
      checked ? 'border-status-success/20 bg-status-success/5' : 'border-border/70 bg-white'
    )}
  >
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{description}</p>
    </div>

    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 rounded-full border transition',
        checked ? 'border-status-success bg-status-success/90' : 'border-border bg-muted'
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white transition-transform',
          checked ? 'left-6' : 'left-1'
        )}
      />
    </span>
  </button>
);

const CredentialsModal = ({
  credentials,
  onClose,
}: {
  credentials: GeneratedCredentials | null;
  onClose: () => void;
}) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!credentials) return;
    void navigator.clipboard.writeText(credentials.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AnimatePresence>
      {credentials ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="modal-surface relative z-10 w-full max-w-sm overflow-hidden"
          >
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-status-success">
                <KeyRound size={16} />
                <span className="text-sm font-semibold">Credenciais geradas</span>
              </div>
              <button type="button" onClick={onClose} className="btn-secondary h-8 w-8 px-0">
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Anote ou copie a senha abaixo. <strong>Ela não será exibida novamente.</strong>
              </p>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Membro</p>
                <p className="text-sm font-medium text-foreground">{credentials.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Senha de acesso</p>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
                  <code className="flex-1 font-mono text-base font-bold tracking-widest text-foreground">
                    {credentials.password}
                  </code>
                  <button
                    type="button"
                    onClick={copy}
                    className="btn-secondary h-8 w-8 px-0 shrink-0"
                    title="Copiar senha"
                  >
                    {copied ? <Check size={14} className="text-status-success" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <button type="button" onClick={onClose} className="btn-primary w-full">
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
};

const TeamModal = ({
  draft,
  onClose,
  onChange,
  onSave,
}: {
  draft: TeamDraft | null;
  onClose: () => void;
  onChange: (update: Partial<TeamDraft>) => void;
  onSave: () => Promise<void>;
}) => (
  <AnimatePresence>
    {draft ? (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          className="modal-surface relative z-10 w-full max-w-2xl overflow-hidden"
        >
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {draft.isNew ? 'Novo membro' : 'Ajuste do membro'}
                </p>
                <h2 className="mt-2 text-lg font-bold tracking-tight text-foreground">
                  {draft.isNew ? 'Criar membro' : draft.full_name || 'Editar membro'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Perfil, acesso e status.</p>
              </div>

              <button type="button" onClick={onClose} className="btn-secondary h-10 w-10 px-0">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="minimal-scrollbar max-h-[82vh] overflow-y-auto p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nome</label>
                <input
                  value={draft.full_name}
                  onChange={(event) => onChange({ full_name: event.target.value })}
                  className="field-control"
                  placeholder="Nome completo"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Username</label>
                <input
                  value={draft.username}
                  onChange={(event) => onChange({ username: event.target.value })}
                  className="field-control"
                  placeholder="usuario.operacao"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Email</label>
                <input
                  value={draft.email}
                  onChange={(event) => onChange({ email: event.target.value })}
                  className="field-control"
                  placeholder="email@empresa.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Papel</label>
                <select
                  value={draft.role}
                  onChange={(event) => onChange({ role: event.target.value as SystemRole })}
                  className="select-control"
                >
                  {TEAM_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {SYSTEM_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Escopo</label>
                <select
                  value={draft.access_scope}
                  onChange={(event) => onChange({ access_scope: event.target.value as AccessScope })}
                  className="select-control"
                >
                  {(Object.keys(ACCESS_SCOPE_LABELS) as AccessScope[]).map((scope) => (
                    <option key={scope} value={scope}>
                      {ACCESS_SCOPE_LABELS[scope]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Foco funcional</label>
                <select
                  value={draft.functional_profile}
                  onChange={(event) => onChange({ functional_profile: event.target.value as FunctionalProfile })}
                  className="select-control"
                >
                  {(Object.keys(FUNCTIONAL_PROFILE_LABELS) as FunctionalProfile[]).map((profile) => (
                    <option key={profile} value={profile}>
                      {FUNCTIONAL_PROFILE_LABELS[profile]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Avatar URL</label>
                <input
                  value={draft.avatar_url}
                  onChange={(event) => onChange({ avatar_url: event.target.value })}
                  className="field-control"
                  placeholder="https://..."
                />
              </div>

              {draft.isNew && (
                <div className="md:col-span-2 rounded-xl border border-border bg-muted/40 px-4 py-3 flex items-center gap-3">
                  <KeyRound size={16} className="text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Uma senha segura será <strong className="text-foreground">gerada automaticamente</strong> ao salvar. Você poderá copiá-la antes de fechar.
                  </p>
                </div>
              )}

              <InlineToggle
                label="Status"
                description={draft.active ? 'Membro com acesso ativo.' : 'Membro sem acesso ao painel.'}
                checked={draft.active}
                onToggle={() => onChange({ active: !draft.active })}
              />
            </div>

            <div className="mt-5 flex justify-end gap-3 border-t border-border pt-4">
              <button type="button" onClick={onClose} disabled={draft.saving} className="btn-secondary">
                Cancelar
              </button>
              <button type="button" onClick={() => void onSave()} disabled={draft.saving} className="btn-primary">
                <Save size={16} />
                {draft.saving ? 'Salvando...' : 'Salvar membro'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    ) : null}
  </AnimatePresence>
);

export const TeamPage: React.FC = () => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<TeamDraft | null>(null);
  const [credentials, setCredentials] = useState<GeneratedCredentials | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const loadTeam = async () => {
    setLoading(true);
    try {
      const data = await UserService.getAll();
      setTeam((data || []).map(normalizeMember));
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar a equipe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTeam();
  }, []);

  useEffect(() => {
    return subscribeRealtimeChange((detail) => {
      if (detail.schema !== 'public' || detail.table !== 'profiles') return;

      const row = detail.eventType === 'DELETE' ? detail.oldRow : detail.newRow;
      if (!row) return;

      const normalized = normalizeMember(row);
      setTeam((current) => {
        if (detail.eventType === 'DELETE') {
          return current.filter((member) => member.id !== normalized.id);
        }

        const exists = current.some((member) => member.id === normalized.id);
        return exists
          ? current.map((member) => (member.id === normalized.id ? normalized : member))
          : [normalized, ...current];
      });
    });
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = !q
      ? team
      : team.filter((member) => {
          return (
            member.name.toLowerCase().includes(q) ||
            member.email.toLowerCase().includes(q) ||
            member.username.toLowerCase().includes(q) ||
            member.role.toLowerCase().includes(q) ||
            member.roleLabel.toLowerCase().includes(q)
          );
        });

    return base.slice().sort((left, right) => {
      if (left.fullAccess !== right.fullAccess) return left.fullAccess ? -1 : 1;
      return left.name.localeCompare(right.name, 'pt-BR');
    });
  }, [team, searchTerm]);

  const openEdit = (member: TeamMember) => {
    setDraft(buildDraft(member));
  };

  const openNew = () => {
    setDraft({
      id: '',
      full_name: '',
      username: '',
      email: '',
      role: 'social_media',
      access_scope: 'limited',
      functional_profile: 'criacao',
      avatar_url: '',
      active: true,
      saving: false,
      isNew: true,
    });
  };

  const handleResetPassword = async (member: TeamMember) => {
    setResettingId(member.id);
    try {
      const password = generatePassword();
      await AdminService.changePassword(member.id, password);
      setCredentials({ name: member.name, password });
      toast.success('Senha redefinida. Anote antes de fechar!');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível redefinir a senha.');
    } finally {
      setResettingId(null);
    }
  };

  const closeModal = () => {
    setDraft((current) => (current?.saving ? current : null));
  };

  const updateDraft = (update: Partial<TeamDraft>) => {
    setDraft((current) => (current ? { ...current, ...update } : current));
  };

  const handleSave = async () => {
    if (!draft) return;

    const payload = {
      full_name: draft.full_name.trim(),
      username: draft.username.trim(),
      email: draft.email.trim(),
      role: draft.role,
      legacy_role: toLegacyProfileRole(draft.role),
      access_scope: draft.access_scope,
      functional_profile: draft.functional_profile,
      avatar_url: draft.avatar_url.trim() || null,
      active: draft.active,
    };

    if (!payload.full_name) {
      toast.error('Informe o nome do membro.');
      return;
    }
    if (!payload.email) {
      toast.error('Informe o email do membro.');
      return;
    }
    if (!payload.username) {
      toast.error('Informe o username do membro.');
      return;
    }

    // ── CREATE ──────────────────────────────────────────────────────────
    if (draft.isNew) {
      const autoPassword = generatePassword();
      setDraft((current) => (current ? { ...current, saving: true } : current));
      try {
        const result = await AdminService.createTeamMember({ ...payload, password: autoPassword });
        const source = (result as any)?.user || (result as any)?.profile || result;
        if (source) {
          const normalized = normalizeMember({ ...payload, ...source });
          setTeam((current) => [normalized, ...current]);
        } else {
          await loadTeam();
        }
        setDraft(null);
        setCredentials({ name: payload.full_name, password: autoPassword });
      } catch (error) {
        console.error(error);
        setDraft((current) => (current ? { ...current, saving: false } : current));
        toast.error('Não foi possível criar o membro.');
      }
      return;
    }

    // ── UPDATE ──────────────────────────────────────────────────────────
    const snapshot = team;
    const optimistic = normalizeMember({ id: draft.id, ...payload });
    setTeam((current) => current.map((member) => (member.id === draft.id ? optimistic : member)));
    setDraft((current) => (current ? { ...current, saving: true } : current));

    try {
      let updated: unknown;
      try {
        updated = await AdminService.updateTeamMember(draft.id, payload);
      } catch (adminError) {
        console.warn('Fallback para atualização direta do perfil da equipe.', adminError);
        updated = await UserService.updateProfile(draft.id, payload);
      }
      const source = (updated as any)?.user || (updated as any)?.profile || updated;
      const normalized = normalizeMember({ ...(source || {}), ...payload, id: draft.id });
      setTeam((current) => current.map((member) => (member.id === draft.id ? normalized : member)));
      toast.success('Membro atualizado.');
      setDraft(null);
    } catch (error) {
      console.error(error);
      setTeam(snapshot);
      setDraft((current) => (current ? { ...current, saving: false } : current));
      toast.error('Não foi possível atualizar o membro.');
    }
  };

  if (loading) {
    return (
<div className="mx-auto flex min-h-full w-full max-w-[1560px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6 xl:px-8">
<div className="premium-card flex min-h-[180px] items-center justify-center p-5">
          <div className="flex items-center gap-3 text-muted-foreground">
            <RefreshCw size={18} className="animate-spin text-primary" />
            <span className="text-sm font-medium">Carregando equipe...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
<div className="mx-auto flex min-h-full w-full max-w-[1560px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6 xl:px-8">
      <section className="premium-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Equipe</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acessos, papéis e foco funcional da operação Cromia.</p>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar membro, email ou usuário"
                className="field-control pl-11"
              />
            </div>

            <button type="button" onClick={() => void loadTeam()} className="btn-secondary">
              <RefreshCw size={16} />
              Atualizar
            </button>

            <button type="button" onClick={openNew} className="btn-primary">
              <Plus size={16} />
              Novo membro
            </button>
          </div>
        </div>
      </section>

      <section className="table-shell overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead className="bg-transparent">
              <tr className="border-b border-border/80 text-left text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Membro</th>
                <th className="w-[220px] px-4 py-3 font-semibold">Papel</th>
                <th className="w-[140px] px-4 py-3 font-semibold">Escopo</th>
                <th className="w-[140px] px-4 py-3 font-semibold">Foco</th>
                <th className="w-[300px] px-4 py-3 font-semibold">Email</th>
                <th className="w-[120px] px-4 py-3 font-semibold">Status</th>
                <th className="w-[120px] px-4 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => {
                const avatarLetter = member.name.charAt(0).toUpperCase();
                return (
                  <tr key={member.id} onClick={() => openEdit(member)} className="interactive-list-item cursor-pointer border-b border-border/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} className="h-9 w-9 rounded-full border border-border object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {avatarLetter}
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.username ? `@${member.username}` : 'Sem usuário'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className={cn('pill text-[10px]', ROLE_CLASSES[member.role])}>{member.roleLabel}</span>
                        <p className="text-xs text-muted-foreground">{member.username ? `@${member.username}` : 'Sem usuário'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('pill text-[10px]', ACCESS_SCOPE_CLASSES[member.accessScope])}>
                        {ACCESS_SCOPE_LABELS[member.accessScope]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('pill text-[10px]', FUNCTIONAL_PROFILE_CLASSES[member.functionalProfile])}>
                        {FUNCTIONAL_PROFILE_LABELS[member.functionalProfile]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{member.email || 'Sem email'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('status-badge', member.active ? 'status-badge-done' : 'status-badge-todo')}>
                        {member.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => void handleResetPassword(member)}
                          disabled={resettingId === member.id}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-muted-foreground transition hover:border-amber-400/30 hover:bg-amber-50 hover:text-amber-600"
                          title="Resetar senha"
                        >
                          {resettingId === member.id ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            <KeyRound size={13} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(member)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-muted-foreground transition hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
                          aria-label={`Editar ${member.name}`}
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filtered.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-muted-foreground">
                    Nenhum membro encontrado para este filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <TeamModal draft={draft} onClose={closeModal} onChange={updateDraft} onSave={handleSave} />
      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
};

export default TeamPage;
