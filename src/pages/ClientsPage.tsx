import React, { useDeferredValue, useCallback, useEffect, useMemo, useState } from 'react';
import { QuickCreateModal } from '@/components/ui/QuickCreateModal';
import {
  Edit3,
  Filter,
  ExternalLink,
  Mail,
  Phone,
  KanbanSquare,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  CreditCard,
  Building2,
  Lock,
  MessageSquare,
  Layout,
  Globe,
  Settings,
  ChevronRight,
  User as UserIcon
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { cn, formatDate } from '@/utils/cn';
import { ClientService } from '@/services';
import { subscribeRealtimeChange } from '@/lib/realtime';
import { useSystemStore } from '@/store/useSystemStore';
import { useAuthStore } from '@/store/useAuthStore';
import { isFullAdmin } from '@/domain/accessControl';

type ClientStatus = 'active' | 'inactive' | string;

interface ClientRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: ClientStatus;
  plan: string;
  industry: string | null;
  created_at: string | null;
  notes?: string | null;
  site_url?: string | null;
  site_description?: string | null;
  logo_url?: string | null;
  portal_token?: string | null;
  is_free_or_trade?: boolean | null;
  one_time_payment?: boolean | null;
  portal_active?: boolean | null;
  onboarding_status?: string | null;
  billing_type?: 'free' | 'trade' | 'paid';
  testimonial_content?: string | null;
  testimonial_author_name?: string | null;
  testimonial_author_role?: string | null;
  testimonial_author_avatar?: string | null;
  testimonial_rating?: number | null;
  is_visible_site?: boolean | null;
  is_featured_site?: boolean | null;
  is_testimonial_visible?: boolean | null;
}

interface ClientDraft {
  mode: 'create' | 'edit';
  id?: string;
  name: string;
  email: string;
  phone: string;
  plan: string;
  industry: string;
  status: ClientStatus;
  notes: string;
  site_url: string;
  site_description: string;
  logo_url: string;
  is_free_or_trade: boolean;
  one_time_payment: boolean;
  testimonial_content: string;
  testimonial_author_name: string;
  testimonial_author_role: string;
  testimonial_author_avatar: string;
  testimonial_rating: number;
  is_visible_site: boolean;
  is_featured_site: boolean;
  is_testimonial_visible: boolean;
  saving: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'status-badge-done' },
  inactive: { label: 'Inativo', className: 'status-badge-todo' },
};

const getClientStatusTone = (status: string) => {
  const token = String(status || '').toLowerCase();
  if (token === 'active' || token === 'ativo') return 'done';
  return 'todo';
};

const slugify = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const STATUS_FILTERS: Array<{ id: 'all' | ClientStatus; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'inactive', label: 'Inativos' },
];

const normalizeClient = (client: any): ClientRecord => ({
  id: String(client.id),
  name: String(client.name || 'Sem nome'),
  email: String(client.email || ''),
  phone: client.phone ? String(client.phone) : null,
  status: ['active', 'ativo'].includes(String(client.status).toLowerCase()) ? 'active' : 'inactive',
  plan: String(client.plan || 'Social Media Mensal'),
  industry: client.industry ? String(client.industry) : null,
  created_at: client.created_at ? String(client.created_at) : null,
  notes: client.notes ? String(client.notes) : null,
  site_url: client.site_url ? String(client.site_url) : null,
  site_description: client.site_description ? String(client.site_description) : null,
  logo_url: client.logo_url ? String(client.logo_url) : null,
  portal_token: client.portal_token ? String(client.portal_token) : null,
  is_free_or_trade: Boolean(client.is_free_or_trade),
  one_time_payment: Boolean(client.one_time_payment),
  portal_active: client.portal_active ?? null,
  onboarding_status: client.onboarding_status ? String(client.onboarding_status).toLowerCase() : null,
  billing_type: client.is_free_or_trade ? 'free' : client.one_time_payment ? 'trade' : 'paid',
  testimonial_content: client.testimonial_content ? String(client.testimonial_content) : null,
  testimonial_author_name: client.testimonial_author_name ? String(client.testimonial_author_name) : null,
  testimonial_author_role: client.testimonial_author_role ? String(client.testimonial_author_role) : null,
  testimonial_author_avatar: client.testimonial_author_avatar ? String(client.testimonial_author_avatar) : null,
  testimonial_rating: client.testimonial_rating ? Number(client.testimonial_rating) : null,
  is_visible_site: client.is_visible_site ?? null,
  is_featured_site: client.is_featured_site ?? null,
  is_testimonial_visible: client.is_testimonial_visible ?? null,
});

const buildDraft = (mode: ClientDraft['mode'], client?: ClientRecord): ClientDraft => ({
  mode,
  id: client?.id,
  name: client?.name || '',
  email: client?.email || '',
  phone: client?.phone || '',
  plan: client?.plan || 'Social Media Mensal',
  industry: client?.industry || '',
  status: client?.status || 'active',
  notes: client?.notes || '',
  site_url: client?.site_url || '',
  site_description: client?.site_description || '',
  logo_url: client?.logo_url || '',
  is_free_or_trade: client?.is_free_or_trade || false,
  one_time_payment: client?.one_time_payment || false,
  testimonial_content: client?.testimonial_content || '',
  testimonial_author_name: client?.testimonial_author_name || '',
  testimonial_author_role: client?.testimonial_author_role || '',
  testimonial_author_avatar: client?.testimonial_author_avatar || '',
  testimonial_rating: Number(client?.testimonial_rating || 5),
  is_visible_site: client?.is_visible_site ?? true,
  is_featured_site: client?.is_featured_site ?? false,
  is_testimonial_visible: client?.is_testimonial_visible ?? false,
  saving: false,
});

const TabButton = ({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: any; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all border-b-2",
      active 
        ? "border-primary text-primary bg-primary/5" 
        : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
    )}
  >
    <Icon size={16} />
    {label}
  </button>
);

const ToggleField = ({
  label,
  description,
  checked,
  onToggle,
  tone = 'default',
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  tone?: 'default' | 'success' | 'warning' | 'error';
}) => {
  const colors = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-rose-500'
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 leading-none">{label}</p>
        <p className="mt-1.5 text-xs text-slate-500 leading-normal">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none",
          checked ? colors[tone] : "bg-slate-200"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-1",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
};

const ClientModal = ({
  draft,
  plans,
  onChange,
  onClose,
  onSave,
  onDelete,
  onUploadLogo,
  onRemoveLogo,
}: {
  draft: ClientDraft | null;
  plans: string[];
  onChange: (update: Partial<ClientDraft>) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete: (() => Promise<void>) | null;
  onUploadLogo: ((file: File) => Promise<void>) | null;
  onRemoveLogo: (() => Promise<void>) | null;
}) => {
  const [activeTab, setActiveTab] = useState<'geral' | 'identidade' | 'depoimento' | 'avancado'>('geral');
  const logoUploadRef = React.useRef<HTMLInputElement | null>(null);

  if (!draft) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-[32px] bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {draft.mode === 'create' ? <Plus size={24} /> : <Edit3 size={24} />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {draft.mode === 'create' ? 'Novo Cliente' : 'Editar Cliente'}
                </h2>
                <p className="text-sm font-medium text-slate-500">
                  {draft.mode === 'create' ? 'Cadastre um novo cliente no sistema' : draft.name}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex border-b border-slate-100 px-4 dark:border-slate-800 overflow-x-auto no-scrollbar">
            <TabButton active={activeTab === 'geral'} label="Geral" icon={Building2} onClick={() => setActiveTab('geral')} />
            <TabButton active={activeTab === 'identidade'} label="Identidade" icon={Layout} onClick={() => setActiveTab('identidade')} />
            <TabButton active={activeTab === 'depoimento'} label="Depoimento" icon={MessageSquare} onClick={() => setActiveTab('depoimento')} />
            <TabButton active={activeTab === 'avancado'} label="Avançado" icon={Settings} onClick={() => setActiveTab('avancado')} />
          </div>

          {/* Content */}
          <div className="minimal-scrollbar max-h-[60vh] overflow-y-auto p-8">
            {activeTab === 'geral' && (
              <div className="grid gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nome da Empresa</label>
                  <input
                    value={draft.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    className="field-control h-12"
                    placeholder="Nome completo da empresa"
                  />
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Email de Contato</label>
                    <input
                      value={draft.email}
                      onChange={(e) => onChange({ email: e.target.value })}
                      className="field-control h-12"
                      placeholder="email@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Telefone / WhatsApp</label>
                    <input
                      value={draft.phone}
                      onChange={(e) => onChange({ phone: e.target.value })}
                      className="field-control h-12"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Serviço em execução</label>
                    <select
                      value={draft.plan}
                      onChange={(e) => onChange({ plan: e.target.value })}
                      className="select-control h-12"
                    >
                      {plans.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</label>
                    <select
                      value={draft.status}
                      onChange={(e) => onChange({ status: e.target.value })}
                      className="select-control h-12 font-bold"
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Desativado</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'identidade' && (
              <div className="space-y-8">
                <div className="flex flex-col items-center justify-center p-8 rounded-[32px] border-2 border-dashed border-slate-100 bg-slate-50/30">
                  {draft.logo_url ? (
                    <div className="relative group">
                      <img src={draft.logo_url} alt="Logo" className="h-32 w-32 rounded-3xl object-cover shadow-xl border-4 border-white" />
                      <button 
                        onClick={() => onRemoveLogo?.()}
                        className="absolute -top-2 -right-2 bg-rose-500 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex h-24 w-24 items-center justify-center rounded-[32px] bg-slate-100 text-slate-400">
                        <Upload size={32} />
                      </div>
                      <p className="text-sm font-bold text-slate-500">Nenhuma logo enviada</p>
                    </div>
                  )}
                  <div className="mt-8 flex gap-3">
                    <button 
                      onClick={() => logoUploadRef.current?.click()}
                      className="btn-primary"
                    >
                      <Upload size={16} />
                      Enviar Logo
                    </button>
                    <input
                      ref={logoUploadRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onUploadLogo) onUploadLogo(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Website</label>
                    <div className="relative">
                      < Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={draft.site_url}
                        onChange={(e) => onChange({ site_url: e.target.value })}
                        className="field-control h-12 pl-11"
                        placeholder="https://suaempresa.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Descrição Curta</label>
                    <textarea
                      value={draft.site_description}
                      onChange={(e) => onChange({ site_description: e.target.value })}
                      rows={3}
                      className="field-control resize-none py-3"
                      placeholder="Uma breve biografia da empresa para o portfólio"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'depoimento' && (
              <div className="space-y-6">
                 <ToggleField
                  label="Habilitar Depoimento"
                  description="Ative para exibir este depoimento no portfólio do seu site."
                  checked={draft.is_testimonial_visible}
                  onToggle={() => onChange({ is_testimonial_visible: !draft.is_testimonial_visible })}
                  tone="success"
                />

                <div className={cn("space-y-6 transition-all duration-300", !draft.is_testimonial_visible && "opacity-50 pointer-events-none grayscale")}>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">O que o cliente diz?</label>
                    <textarea
                      value={draft.testimonial_content}
                      onChange={(e) => onChange({ testimonial_content: e.target.value })}
                      rows={4}
                      className="field-control resize-none py-3"
                      placeholder="O depoimento incrível que seu cliente deu sobre seu trabalho..."
                    />
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nome do Autor</label>
                      <input
                        value={draft.testimonial_author_name}
                        onChange={(e) => onChange({ testimonial_author_name: e.target.value })}
                        className="field-control h-12"
                        placeholder="Ex: João Silva"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Cargo / Empresa</label>
                      <input
                        value={draft.testimonial_author_role}
                        onChange={(e) => onChange({ testimonial_author_role: e.target.value })}
                        className="field-control h-12"
                        placeholder="Ex: CEO da Empresa X"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Avaliação (1 a 5 estrelas)</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => onChange({ testimonial_rating: star })}
                          className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                            draft.testimonial_rating >= star ? "bg-amber-100 text-amber-500 scale-110" : "bg-slate-100 text-slate-400"
                          )}
                        >
                          <Sparkles size={18} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'avancado' && (
              <div className="space-y-4">
                <ToggleField
                  label="Exibição Pública"
                  description="Controla se o cliente aparece no portfólio público do seu site."
                  checked={draft.is_visible_site}
                  onToggle={() => onChange({ is_visible_site: !draft.is_visible_site })}
                  tone="success"
                />
                <ToggleField
                  label="Destaque Estratégico"
                  description="Prioriza este cliente na vitrine principal e exibe badges de destaque."
                  checked={draft.is_featured_site}
                  onToggle={() => onChange({ is_featured_site: !draft.is_featured_site })}
                />
                <ToggleField
                  label="Restrição Operacional"
                  description="Habilite para restringir este cliente apenas aos administradores estratégicos."
                  checked={draft.is_free_or_trade}
                  onToggle={() => onChange({ is_free_or_trade: !draft.is_free_or_trade })}
                  tone="error"
                />
                 <ToggleField
                  label="Pagamento Único"
                  description="Define que o cliente está sob um modelo de serviço pontual (sem recorrência)."
                  checked={draft.one_time_payment}
                  onToggle={() => onChange({ one_time_payment: !draft.one_time_payment })}
                  tone="warning"
                />
                 <div className="pt-4 border-t border-slate-100 mt-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Notas Internas</label>
                    <textarea
                      value={draft.notes}
                      onChange={(e) => onChange({ notes: e.target.value })}
                      rows={3}
                      className="field-control mt-2 resize-none py-3"
                      placeholder="Observações sensíveis que apenas sua equipe deve ver..."
                    />
                 </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-8 py-6 dark:border-slate-800 dark:bg-slate-900/50">
            <div>
              {draft.mode === 'edit' && onDelete && (
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  className="flex items-center gap-2 text-sm font-bold text-rose-500 hover:text-rose-600 transition-colors"
                >
                  <Trash2 size={16} />
                  Excluir Cliente
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={onClose} 
                disabled={draft.saving} 
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={draft.saving}
                className="btn-primary min-w-[140px] h-12 rounded-2xl shadow-lg shadow-primary/20"
              >
                {draft.saving ? <Sparkles className="animate-spin" size={18} /> : <Sparkles size={18} />}
                {draft.mode === 'create' ? 'Cadastrar' : 'Salvar'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export const ClientsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const plansFromStore = useSystemStore((state) => state.plans);
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClientStatus>('all');
  const [viewMode, setViewMode] = useState<'public' | 'restricted'>('public');
  const [draft, setDraft] = useState<ClientDraft | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);

  const isAdmin = isFullAdmin(user?.role);
  const deferredSearch = useDeferredValue(searchTerm);

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await ClientService.getAll({ include_free_or_trade: true });
      setClients((data || []).map(normalizeClient));
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    return subscribeRealtimeChange((detail) => {
      if (detail.table !== 'clients') return;
      void loadClients(); // Refresh on data change for simplicity with normalization
    });
  }, []);

  useEffect(() => {
    const deepLinkedClientId = searchParams.get('client');
    if (!deepLinkedClientId || loading) return;

    const targetClient = clients.find((client) => client.id === deepLinkedClientId);
    if (!targetClient) {
      if (clients.length > 0) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('client');
        setSearchParams(nextParams, { replace: true });
        toast.error('Cliente do atalho não foi encontrado.');
      }
      return;
    }

    if (draft?.mode === 'edit' && draft.id === targetClient.id) return;
    setDraft(buildDraft('edit', targetClient));
  }, [clients, draft?.id, draft?.mode, loading, searchParams, setSearchParams]);

  const clientPlans = useMemo(() => {
    const merged = [...plansFromStore, ...(draft?.plan ? [draft.plan] : [])];
    const unique = new Set(merged.map(p => String(p || '').trim()).filter(Boolean));
    return Array.from(unique).sort();
  }, [draft?.plan, plansFromStore]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();

    return clients.filter((client) => {
      // Logic for Restricted Area
      const isRestrictedArea = viewMode === 'restricted';
      if (isRestrictedArea !== !!client.is_free_or_trade) return false;
      
      const matchesSearch =
        !q ||
        client.name.toLowerCase().includes(q) ||
        client.email.toLowerCase().includes(q) ||
        (client.industry || '').toLowerCase().includes(q) ||
        (client.phone || '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || client.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [clients, deferredSearch, statusFilter, viewMode, isAdmin]);

  const handleQuickCreate = useCallback(async (values: Record<string, any>) => {
    setQuickCreateLoading(true);
    try {
      const created = await ClientService.create({
        ...values,
        status: 'active'
      });
      const normalized = normalizeClient(created);
      setClients((prev) => [normalized, ...prev]);
      setQuickCreateOpen(false);
      setSearchParams({ client: normalized.id }, { replace: true });
      setTimeout(() => setDraft(buildDraft('edit', normalized)), 100);
      toast.success('Cliente criado! Complete os detalhes.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar cliente.');
    } finally {
      setQuickCreateLoading(false);
    }
  }, [setSearchParams]);

  const handleSave = async () => {
    if (!draft) return;
    setDraft(d => d ? {...d, saving: true} : d);

    try {
      if (draft.mode === 'create') {
        const created = await ClientService.create(draft);
        setClients(prev => [normalizeClient(created), ...prev]);
        toast.success('Cliente cadastrado.');
      } else if (draft.id) {
        const updated = await ClientService.update(draft.id, draft);
        setClients(prev => prev.map(c => c.id === draft.id ? normalizeClient(updated) : c));
        toast.success('Alterações salvas.');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      setDraft(d => d ? {...d, saving: false} : d);
      toast.error('Erro ao salvar cliente.');
    }
  };

  const handleUploadLogo = async (file: File) => {
    if (!draft?.id) return;
    try {
      const updated = await ClientService.uploadLogo(draft.id, file);
      setClients(prev => prev.map(c => c.id === draft.id ? normalizeClient(updated) : c));
      updateDraft({ logo_url: updated.logo_url });
      toast.success('Logo atualizada.');
    } catch (error) {
      toast.error('Erro no upload.');
    }
  };

  const handleRemoveLogo = async () => {
    if (!draft?.id) return;
    try {
      await ClientService.removeLogo(draft.id);
      setClients(prev => prev.map(c => c.id === draft.id ? { ...c, logo_url: null } : c));
      updateDraft({ logo_url: '' });
      toast.success('Logo removida.');
    } catch (error) {
      toast.error('Erro ao remover logo.');
    }
  };

  const handleDelete = async () => {
    if (!draft?.id || !window.confirm('Excluir este cliente permanentemente?')) return;
    try {
      await ClientService.delete(draft.id);
      setClients(prev => prev.filter(c => c.id !== draft.id));
      closeModal();
      toast.success('Cliente removido.');
    } catch (error) {
      toast.error('Erro ao excluir.');
    }
  };

  const updateDraft = (update: Partial<ClientDraft>) => setDraft(d => d ? {...d, ...update} : d);
  const openEdit = (client: ClientRecord) => {
    setSearchParams({ client: client.id }, { replace: true });
    setDraft(buildDraft('edit', client));
  };
  const closeModal = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('client');
    setSearchParams(nextParams, { replace: true });
    setDraft(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-bold text-slate-500 animate-pulse uppercase tracking-[0.2em]">Carregando Ecossistema...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <QuickCreateModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onConfirm={handleQuickCreate}
        loading={quickCreateLoading}
        title="Novo Cliente"
        subtitle="Cadastre um cliente real da operação da agência."
        fields={[
          { key: 'name', label: 'Nome da Empresa', placeholder: 'Ex: Eve Festas', required: true, autoFocus: true },
          { key: 'email', label: 'E-mail de Contato', placeholder: 'contato@evefestas.com.br', type: 'email' },
          { key: 'phone', label: 'Telefone comercial', placeholder: 'Somente números' },
          { key: 'generate_drive_folder', label: 'Pastas no Drive', placeholder: 'Gerar estrutura automaticamente', type: 'checkbox' },
          { key: 'provision_onboarding', label: 'Estrutura inicial', placeholder: 'Criar tarefas iniciais do cliente', type: 'checkbox' },
        ]}
      />

      <div className="mx-auto flex min-h-full w-full max-w-[1560px] flex-col gap-6 p-4 md:p-8">
        {/* Header Stats & Title */}
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Operação de clientes</p>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight dark:text-slate-100">Clientes</h1>
          </div>

          <div className="flex items-center gap-3">
             <button onClick={() => setQuickCreateOpen(true)} className="btn-primary h-12 px-6 rounded-2xl shadow-xl shadow-primary/20">
              <Plus size={20} />
              Cadastrar Agora
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-[28px] border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
             <div className="flex p-1 bg-slate-50 rounded-2xl dark:bg-slate-800/50">
               <button 
                onClick={() => setViewMode('public')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all",
                  viewMode === 'public' ? "bg-white text-primary shadow-sm shadow-primary/10" : "text-slate-500 hover:text-slate-700"
                )}
               >
                 <Globe size={16} />
                 Públicos
               </button>
               {isAdmin && (
                 <button 
                  onClick={() => setViewMode('restricted')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all",
                    viewMode === 'restricted' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                 >
                   <Lock size={16} />
                   Restritos
                 </button>
               )}
             </div>

             <div className="h-6 w-[1px] bg-slate-100 dark:bg-slate-800 hidden lg:block" />

             <div className="relative flex-1 min-w-[200px]">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-900 placeholder:text-slate-400 pl-11 h-10"
                  placeholder="Pesquisar por nome, email ou segmento..."
                />
             </div>
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-full border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
             <div className="flex items-center gap-2 px-4">
                <Filter size={14} className="text-slate-400" />
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-transparent border-none text-sm font-bold text-slate-600 focus:ring-0 pr-8"
                >
                  <option value="all">Todos Status</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Desativados</option>
                </select>
             </div>
          </div>
        </div>

        {/* List View */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((client) => (
              <motion.div
                key={client.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="group relative flex flex-col overflow-hidden rounded-[40px] border border-slate-100 bg-white p-3 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 cursor-pointer"
              >
                {/* Visual Accent */}
                <div className={cn(
                  "absolute top-0 right-0 h-32 w-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20",
                  client.status === 'active' ? "bg-primary" : "bg-slate-500"
                )} />

                {/* Card Header */}
                <div className="relative flex items-center justify-between p-3">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[28px] border-4 border-white bg-slate-50 shadow-lg transition-transform group-hover:scale-105 dark:border-slate-800">
                    {client.logo_url ? (
                      <img 
                        src={client.logo_url} 
                        alt={client.name} 
                        className="h-full w-full object-cover" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) {
                            const span = document.createElement('span');
                            span.className = "text-2xl font-black text-primary opacity-40";
                            span.innerText = client.name[0];
                            parent.appendChild(span);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-2xl font-black text-primary opacity-40">{client.name[0]}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={cn(
                      "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border",
                      client.status === 'active' 
                        ? "bg-green-50 text-green-600 border-green-100" 
                        : "bg-slate-50 text-slate-500 border-slate-100"
                    )}>
                      {client.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                    {client.is_free_or_trade && (
                      <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 border border-rose-100">
                        <Lock size={14} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="relative flex-1 p-3">
                  <h3 className="text-lg font-black text-slate-900 leading-tight dark:text-slate-100">{client.name}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-wider">{client.industry || 'Consultoria Estratégica'}</p>
                  
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center gap-2.5 text-slate-500 group-hover:text-primary transition-colors">
                      <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800">
                        <Mail size={12} />
                      </div>
                      <span className="text-[13px] font-medium truncate">{client.email}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-500">
                      <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800">
                        <Phone size={12} />
                      </div>
                      <span className="text-[13px] font-medium">{client.phone || '(No contact)'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="relative mt-4 flex items-center justify-between border-t border-slate-50 p-2 pt-4 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/boards?client=${client.id}`); }}
                      className="h-10 px-4 flex items-center gap-2 rounded-2xl bg-white border border-slate-100 text-[11px] font-black uppercase tracking-tighter text-slate-600 hover:bg-slate-50 hover:text-primary transition-all shadow-sm"
                    >
                      <KanbanSquare size={14} />
                      Board
                    </button>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(client); }}
                    className="h-10 w-10 flex items-center justify-center rounded-full text-slate-300 hover:bg-primary/10 hover:text-primary transition-all"
                  >
                    <Settings size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {!filtered.length && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-dashed border-slate-200">
               <div className="h-20 w-20 flex items-center justify-center rounded-full bg-slate-50 text-slate-300 mb-4">
                  <UserIcon size={40} />
               </div>
               <p className="text-lg font-bold text-slate-400">Nenhum cliente por aqui.</p>
               <button onClick={() => setQuickCreateOpen(true)} className="mt-4 text-primary font-bold hover:underline">Cadastrar novo cliente</button>
            </div>
          )}
        </div>
      </div>

      <ClientModal
        draft={draft}
        plans={clientPlans}
        onChange={updateDraft}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={draft?.mode === 'edit' ? handleDelete : null}
        onUploadLogo={draft?.mode === 'edit' ? handleUploadLogo : null}
        onRemoveLogo={draft?.mode === 'edit' ? handleRemoveLogo : null}
      />
    </>
  );
};

export default ClientsPage;
