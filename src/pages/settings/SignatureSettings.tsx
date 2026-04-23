import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Copy,
  ImageUp,
  Linkedin,
  Palette,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/utils/cn';
import {
  buildEmailSignatureHtml,
  buildEmailSignaturePlainText,
  getInitials,
  normalizeLinkedInUrl,
  resolveEmailSignatureTheme,
  type EmailSignatureBranding,
  type EmailSignatureProfile,
} from '@/lib/emailSignature';

export interface SignatureProfileForm extends EmailSignatureProfile {
  username: string;
  phone_display: string;
  bio_hook: string;
  signature_role: string;
  avatar_url: string;
  linkedin_url: string;
}

type SettingsSubTab = 'general' | 'notifications' | 'signature';
type TouchedField = 'full_name' | 'signature_role' | 'linkedin_url';

interface Props {
  profile: SignatureProfileForm;
  setProfile: React.Dispatch<React.SetStateAction<SignatureProfileForm>>;
  saving: boolean;
  onSave: () => void;
  onAvatarUpload: (file: File) => void;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  companyBranding: EmailSignatureBranding;
}

const subtabs: Array<{ id: SettingsSubTab; label: string; description: string }> = [
  { id: 'general', label: 'Geral', description: 'Dados-base da conta e apresentação pessoal.' },
  { id: 'notifications', label: 'Notificações', description: 'Resumo do fluxo de alertas e atividade.' },
  { id: 'signature', label: 'Assinatura de E-mail', description: 'Editor com visualização fiel ao HTML final.' },
];

const inputClassName = (hasError = false, extra = '') =>
  cn(
    'field-control h-12 rounded-[18px] border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:border-slate-300 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/70',
    hasError && 'border-rose-300 bg-rose-50/60 text-rose-900 focus:border-rose-300 focus:ring-rose-100',
    extra
  );

const textareaClassName = (hasError = false) =>
  cn(
    'field-control min-h-[132px] rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:border-slate-300 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/70',
    hasError && 'border-rose-300 bg-rose-50/60 text-rose-900 focus:border-rose-300 focus:ring-rose-100'
  );

const surfaceClassName =
  'rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6';

const PreviewBadge = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-[20px] border border-white/70 bg-white/88 px-4 py-4 backdrop-blur">
    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
    <div className="mt-2 text-sm font-semibold leading-6 text-slate-900">{value}</div>
  </div>
);

const FieldShell = ({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-2.5">
    <div className="flex items-center justify-between gap-3">
      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</label>
      {required ? (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          obrigatório
        </span>
      ) : null}
    </div>
    {children}
    {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
  </div>
);

const TabButton = ({
  active,
  label,
  description,
  onClick,
  accent,
  accentSoft,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
  accent: string;
  accentSoft: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group flex min-w-[220px] flex-1 items-start gap-3 rounded-[22px] border px-4 py-4 text-left transition-all duration-200',
      active ? 'border-transparent bg-white shadow-[0_18px_34px_rgba(15,23,42,0.08)]' : 'border-white/50 bg-white/60 hover:bg-white'
    )}
    style={active ? { boxShadow: `0 18px 34px rgba(15, 23, 42, 0.08), 0 0 0 1px ${accentSoft}` } : undefined}
  >
    <div
      className={cn(
        'mt-0.5 h-2.5 w-2.5 rounded-full transition-all',
        active ? 'scale-100' : 'scale-90 bg-slate-300 group-hover:bg-slate-400'
      )}
      style={active ? { backgroundColor: accent } : undefined}
    />
    <div className="min-w-0">
      <div className={cn('text-sm font-semibold', active ? 'text-slate-950' : 'text-slate-700')}>{label}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
    </div>
  </button>
);

const BrandMark = ({
  branding,
  compact = false,
}: {
  branding: EmailSignatureBranding;
  compact?: boolean;
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const theme = useMemo(() => resolveEmailSignatureTheme(branding), [branding]);
  const logoVisible = Boolean(theme.logoUrl) && !logoFailed;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white',
        compact ? 'px-3 py-2.5' : 'px-4 py-4'
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50',
          compact ? 'h-12 w-12' : 'h-16 w-16'
        )}
        style={{
          background: logoVisible ? '#FFFFFF' : `linear-gradient(135deg, ${theme.accentSoft}, rgba(255,255,255,0.95))`,
          borderColor: logoVisible ? '#E5E7EB' : theme.accentBorder,
        }}
      >
        {logoVisible ? (
          <img
            src={theme.logoUrl}
            alt={theme.companyName}
            onError={() => setLogoFailed(true)}
            className="max-h-[72%] max-w-[72%] object-contain"
          />
        ) : (
          <span className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: theme.accentStrong }}>
            {getInitials(theme.companyName)}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Marca conectada</div>
        <div className="mt-1 truncate text-sm font-semibold text-slate-900">{theme.companyName}</div>
        <div className="mt-1 text-xs text-slate-500">
          {logoVisible ? 'Logo oficial aplicada na visualização e no HTML.' : 'Versão textual usando a identidade do sistema.'}
        </div>
      </div>
    </div>
  );
};

const CopyHtmlButton = ({
  html,
  plainText,
  accent,
  accentStrong,
  accentSoft,
  disabled,
}: {
  html: string;
  plainText: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  disabled?: boolean;
}) => {
  const [copying, setCopying] = useState(false);

  const handleCopy = async () => {
    if (disabled) return;

    setCopying(true);
    try {
      const ClipboardItemCtor = window.ClipboardItem;

      if (navigator.clipboard?.write && ClipboardItemCtor) {
        await navigator.clipboard.write([
          new ClipboardItemCtor({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plainText], { type: 'text/plain' }),
          }),
        ]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plainText);
      } else {
        throw new Error('Clipboard indisponível');
      }

      toast.success('Assinatura copiada em HTML.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível copiar a assinatura.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      disabled={copying || disabled}
      className="flex h-[54px] w-full items-center justify-center gap-3 rounded-[20px] px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      style={{
        background: `linear-gradient(135deg, ${accentStrong} 0%, ${accent} 100%)`,
        boxShadow: `0 18px 36px ${accentSoft}`,
      }}
    >
      <Copy size={17} />
      {copying ? 'Copiando assinatura...' : 'Copiar assinatura'}
    </button>
  );
};

export const SignatureSettings: React.FC<Props> = ({
  profile,
  setProfile,
  saving,
  onSave,
  onAvatarUpload,
  avatarInputRef,
  companyBranding,
}) => {
  const [activeSubtab, setActiveSubtab] = useState<SettingsSubTab>('signature');
  const [touched, setTouched] = useState<Partial<Record<TouchedField, boolean>>>({});

  const theme = useMemo(() => resolveEmailSignatureTheme(companyBranding), [companyBranding]);

  const normalizedProfile = useMemo(
    () => ({
      ...profile,
      linkedin_url: normalizeLinkedInUrl(profile.linkedin_url),
    }),
    [profile]
  );

  const validation = useMemo(
    () => ({
      full_name: profile.full_name.trim() ? '' : 'Informe o nome completo do colaborador.',
      signature_role: profile.signature_role.trim() ? '' : 'Informe o cargo que aparece na assinatura.',
      linkedin_url:
        profile.linkedin_url.trim() && !/linkedin\.com/i.test(profile.linkedin_url)
          ? 'Use o link público do LinkedIn.'
          : '',
    }),
    [profile.full_name, profile.signature_role, profile.linkedin_url]
  );

  const signatureHtml = useMemo(
    () => buildEmailSignatureHtml(normalizedProfile, companyBranding),
    [companyBranding, normalizedProfile]
  );

  const signaturePlainText = useMemo(
    () => buildEmailSignaturePlainText(normalizedProfile, companyBranding),
    [companyBranding, normalizedProfile]
  );

  const copyBlocked = Boolean(validation.full_name || validation.signature_role);
  const summaryItems = [
    { icon: Palette, label: 'Marca oficial', value: theme.logoUrl ? 'Logo oficial conectada' : 'Versão textual ativa' },
    { icon: ShieldCheck, label: 'Compatibilidade', value: 'HTML inline + texto puro' },
    { icon: Sparkles, label: 'Visualização', value: 'Canvas fiel ao resultado final' },
  ];

  const markTouched = (field: TouchedField) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  return (
    <div className="space-y-6">
      <div
        className="overflow-hidden rounded-[32px] border border-slate-200/80 p-6 shadow-[0_26px_60px_rgba(15,23,42,0.08)] sm:p-7"
        style={{
          background: `linear-gradient(135deg, ${theme.accentSurface} 0%, rgba(255,255,255,0.96) 38%, rgba(248,250,252,0.96) 100%)`,
        }}
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(320px,0.72fr)]">
          <div className="rounded-[30px] border border-white/75 bg-white/84 p-6 backdrop-blur sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              <Sparkles size={14} style={{ color: theme.accentStrong }} />
              Assinatura corporativa
            </div>
            <h3 className="mt-5 max-w-3xl text-[28px] font-bold tracking-[-0.05em] text-slate-950 sm:text-[34px]">
              Minha Conta com editor de assinatura, visualização ao vivo e identidade corporativa consistente.
            </h3>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
              Ajuste o perfil do colaborador, mantenha a marca oficial aplicada automaticamente e copie uma assinatura
              pronta para uso em Gmail, Outlook e no fluxo interno da agência.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {summaryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-[22px] border border-slate-200/70 bg-slate-50/90 px-4 py-4">
                    <Icon size={16} style={{ color: theme.accentStrong }} />
                    <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <PreviewBadge label="Resultado" value="Visualização ao vivo com HTML inline e versão textual de apoio." />
            <PreviewBadge label="Marca" value={theme.logoUrl ? 'Logo oficial conectada ao layout final.' : 'Versão textual corporativa pronta para uso.'} />
            <PreviewBadge label="Aplicação" value="Copiar, colar e usar sem retrabalho no time." />
          </div>

          <div className="xl:col-span-2">
            <div className="flex flex-col gap-3 xl:flex-row">
            {subtabs.map((tab) => (
              <TabButton
                key={tab.id}
                active={tab.id === activeSubtab}
                label={tab.label}
                description={tab.description}
                onClick={() => setActiveSubtab(tab.id)}
                accent={theme.accent}
                accentSoft={theme.accentSoft}
              />
            ))}
            </div>
          </div>
        </div>
      </div>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onAvatarUpload(file);
          event.target.value = '';
        }}
      />

      {activeSubtab === 'general' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className={surfaceClassName}>
            <div className="mb-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Dados básicos</div>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">Apresentação da conta</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ajuste os dados principais usados no painel e na assinatura corporativa.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <FieldShell label="Nome completo" error={touched.full_name ? validation.full_name : ''} required>
                <input
                  value={profile.full_name}
                  onBlur={() => markTouched('full_name')}
                  onChange={(event) => setProfile((current) => ({ ...current, full_name: event.target.value }))}
                  className={inputClassName(Boolean(touched.full_name && validation.full_name))}
                  placeholder="Nome do colaborador"
                />
              </FieldShell>

              <FieldShell label="Username" hint="Usado no acesso interno e na identificação do perfil.">
                <input
                  value={profile.username}
                  onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))}
                  className={inputClassName()}
                  placeholder="usuario"
                />
              </FieldShell>

              <FieldShell label="E-mail">
                <input value={profile.email} className={inputClassName(false, 'cursor-not-allowed bg-slate-50')} disabled />
              </FieldShell>

              <FieldShell label="Cargo exibido" error={touched.signature_role ? validation.signature_role : ''} required>
                <input
                  value={profile.signature_role}
                  onBlur={() => markTouched('signature_role')}
                  onChange={(event) => setProfile((current) => ({ ...current, signature_role: event.target.value }))}
                  className={inputClassName(Boolean(touched.signature_role && validation.signature_role))}
                  placeholder="Ex.: Diretor de Performance"
                />
              </FieldShell>
            </div>

            <div className="mt-7 flex justify-end">
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="flex h-[50px] items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? 'Salvando perfil...' : 'Salvar perfil'}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className={surfaceClassName}>
              <BrandMark branding={companyBranding} />
            </div>

            <div className={surfaceClassName}>
              <div className="flex items-center gap-4">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || 'Avatar'}
                    className="h-16 w-16 rounded-[24px] border border-slate-200 object-cover shadow-sm"
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-[24px] border text-lg font-black uppercase"
                    style={{ borderColor: theme.accentBorder, background: theme.accentSurface, color: theme.accentStrong }}
                  >
                    {getInitials(profile.full_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Resumo visual</div>
                  <div className="mt-2 truncate text-lg font-semibold text-slate-950">{profile.full_name || 'Sem nome'}</div>
                  <div className="mt-1 truncate text-sm text-slate-600">{profile.signature_role || 'Defina o cargo exibido'}</div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Este resumo usa a mesma base da assinatura para manter consistência entre identidade pessoal e comunicação externa.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeSubtab === 'notifications' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className={surfaceClassName}>
            <BellRing size={18} style={{ color: theme.accentStrong }} />
            <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">Central de atividade</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              O sino do topo continua sendo o centro oficial do feed em tempo real da operação, com alertas do time e ações recentes.
            </p>
          </div>

          <div className={surfaceClassName}>
            <CheckCircle2 size={18} style={{ color: theme.accentStrong }} />
            <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">Pronto para colar</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A assinatura fica pronta para Gmail, Outlook e outros clientes que aceitam HTML inline, com versão textual segura para contingência.
            </p>
          </div>

          <div className={surfaceClassName}>
            <Palette size={18} style={{ color: theme.accentStrong }} />
            <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">Identidade consistente</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A logo e o nome da empresa vêm da identidade já configurada no sistema, evitando assinatura divergente ou mockada.
            </p>
          </div>
        </div>
      )}

      {activeSubtab === 'signature' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
          <div className="grid gap-6">
            <section className={cn(surfaceClassName, 'grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_240px]')}>
              <div>
                <div className="mb-6">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Editor</div>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">Dados da assinatura</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Estruture nome, cargo, frase e contatos com hierarquia clara. A visualização ao lado responde em tempo real.
                  </p>
                </div>

                <div className="grid gap-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FieldShell label="Nome" error={touched.full_name ? validation.full_name : ''} required>
                      <input
                        value={profile.full_name}
                        onBlur={() => markTouched('full_name')}
                        onChange={(event) => setProfile((current) => ({ ...current, full_name: event.target.value }))}
                        className={inputClassName(Boolean(touched.full_name && validation.full_name))}
                        placeholder="Nome completo"
                      />
                    </FieldShell>

                    <FieldShell label="Cargo" error={touched.signature_role ? validation.signature_role : ''} required>
                      <input
                        value={profile.signature_role}
                        onBlur={() => markTouched('signature_role')}
                        onChange={(event) => setProfile((current) => ({ ...current, signature_role: event.target.value }))}
                        className={inputClassName(Boolean(touched.signature_role && validation.signature_role))}
                        placeholder="Cargo visível na assinatura"
                      />
                    </FieldShell>
                  </div>

                  <FieldShell
                    label="Frase de impacto"
                    hint="Use uma linha curta, confiável e confortável de ler logo abaixo do cargo."
                  >
                    <textarea
                      value={profile.bio_hook}
                      onChange={(event) => setProfile((current) => ({ ...current, bio_hook: event.target.value }))}
                      className={textareaClassName()}
                      placeholder="Ex.: Estratégia orientada por dados para marcas que querem crescer com clareza."
                    />
                  </FieldShell>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FieldShell label="WhatsApp" hint="Formato livre. O link é normalizado automaticamente.">
                      <input
                        type="tel"
                        value={profile.phone_display}
                        onChange={(event) => setProfile((current) => ({ ...current, phone_display: event.target.value }))}
                        className={inputClassName()}
                        placeholder="(11) 99999-9999"
                      />
                    </FieldShell>

                    <FieldShell
                      label="LinkedIn"
                      error={touched.linkedin_url ? validation.linkedin_url : ''}
                      hint="Você pode colar só o domínio público, que o sistema completa o protocolo."
                    >
                      <div className="relative">
                        <Linkedin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="url"
                          value={profile.linkedin_url}
                          onBlur={() => markTouched('linkedin_url')}
                          onChange={(event) => setProfile((current) => ({ ...current, linkedin_url: event.target.value }))}
                          className={inputClassName(Boolean(touched.linkedin_url && validation.linkedin_url), 'pl-11')}
                          placeholder="linkedin.com/in/seu-perfil"
                        />
                      </div>
                    </FieldShell>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 content-start">
                <div
                  className="rounded-[26px] border p-5"
                  style={{
                    borderColor: theme.accentBorder,
                    background: `linear-gradient(135deg, ${theme.accentSurface}, rgba(255,255,255,0.94))`,
                  }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Resumo executivo</div>
                  <div className="mt-4 text-lg font-semibold text-slate-950">{profile.full_name || 'Sem nome definido'}</div>
                  <div className="mt-1 text-sm text-slate-600">{profile.signature_role || 'Defina o cargo exibido'}</div>
                  <div className="mt-5 space-y-3 text-sm text-slate-600">
                    <div className="rounded-[18px] bg-white/80 px-4 py-3">Marca: {theme.companyName}</div>
                    <div className="rounded-[18px] bg-white/80 px-4 py-3">Formato: HTML inline + texto puro</div>
                    <div className="rounded-[18px] bg-white/80 px-4 py-3">Aplicação: copiar e usar no e-mail</div>
                  </div>
                </div>

                <BrandMark branding={companyBranding} compact />
              </div>
            </section>

            <section className={cn(surfaceClassName, 'grid gap-6 lg:grid-cols-[140px_minmax(0,1fr)]')}>
              <div
                className="flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-[34px] border"
                style={{ borderColor: theme.accentBorder, background: `linear-gradient(135deg, ${theme.accentSoft}, rgba(255,255,255,0.92))` }}
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name || 'Avatar'} className="h-full w-full object-cover" />
                ) : (
                  <div className="text-center">
                    <div className="text-2xl font-black uppercase" style={{ color: theme.accentStrong }}>
                      {getInitials(profile.full_name)}
                    </div>
                    <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">sem foto</div>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Foto do colaborador</div>
                    <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Apresentação visual</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Use uma foto limpa e profissional. A visualização mantém a composição discreta para não competir com a marca.
                    </p>
                  </div>
                  <div
                    className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ backgroundColor: theme.accentSoft, color: theme.accentStrong }}
                  >
                    opcional
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="flex h-11 items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                  >
                    <ImageUp size={16} />
                    Alterar foto
                  </button>

                  <button
                    type="button"
                    onClick={() => setProfile((current) => ({ ...current, avatar_url: '' }))}
                    className="flex h-11 items-center justify-center gap-2 rounded-[18px] border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                  >
                    <Trash2 size={16} />
                    Remover
                  </button>
                </div>

                <FieldShell label="URL da foto" hint="Você também pode usar uma URL pública ou manter o avatar enviado por upload.">
                  <input
                    value={profile.avatar_url}
                    onChange={(event) => setProfile((current) => ({ ...current, avatar_url: event.target.value }))}
                    className={inputClassName()}
                    placeholder="https://..."
                  />
                </FieldShell>
              </div>
            </section>
          </div>

          <div className="space-y-6 xl:sticky xl:top-5 xl:self-start">
            <section
              className="overflow-hidden rounded-[32px] border border-slate-200/80 shadow-[0_24px_54px_rgba(15,23,42,0.08)]"
              style={{
                background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)`,
              }}
            >
              <div className="border-b border-slate-200/80 px-6 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Visualização</div>
                    <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-slate-950">Assinatura ao vivo</h3>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    resultado final
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#EEF2F7]">
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#F97066]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FEC84B]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#32D583]" />
                    <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">visualização de e-mail</span>
                  </div>

                  <div className="overflow-x-auto p-4 sm:p-5">
                    <div className="min-w-[320px] rounded-[28px] bg-white p-4 shadow-[0_24px_44px_rgba(15,23,42,0.08)] sm:p-5">
                      <div dangerouslySetInnerHTML={{ __html: signatureHtml }} />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <PreviewBadge label="Identidade" value={theme.logoUrl ? 'Logo oficial aplicada no layout final.' : 'Versão textual sem imagem fixa.'} />
                  <PreviewBadge label="Estrutura" value="Tabela HTML, estilos inline e versão textual para clientes mais limitados." />
                </div>
              </div>
            </section>

            <section className={surfaceClassName}>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ações</div>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">Copiar e aplicar</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      O HTML copiado já sai otimizado para assinatura corporativa com versão textual de apoio.
                    </p>
                  </div>

                  <div
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ borderColor: theme.accentBorder, backgroundColor: theme.accentSoft, color: theme.accentStrong }}
                  >
                    <ShieldCheck size={14} />
                    compatível
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <CopyHtmlButton
                    html={signatureHtml}
                    plainText={signaturePlainText}
                    accent={theme.accent}
                    accentStrong={theme.accentStrong}
                    accentSoft={theme.accentSoft}
                    disabled={copyBlocked}
                  />

                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className="flex h-[54px] w-full items-center justify-center gap-3 rounded-[20px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save size={17} />
                    {saving ? 'Salvando assinatura...' : 'Salvar dados da assinatura'}
                  </button>
                </div>

                {copyBlocked ? (
                  <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Preencha pelo menos <strong>nome</strong> e <strong>cargo</strong> para habilitar a cópia do HTML.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
