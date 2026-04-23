import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_POSTING_CALENDAR_TEMPLATE,
  normalizePostingCalendarTemplateConfig,
  normalizePostingCalendarTemplateRegistry,
  type PostingCalendarTemplateConfig,
} from '@/domain/agencyPlatform';

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '');
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

const DONE_TASK_STATUSES = new Set(['done', 'completed', 'concluido', 'finalizado']);
const IN_PROGRESS_TASK_STATUSES = new Set(['in-progress', 'in_progress', 'executando', 'doing', 'andamento']);
const PORTAL_FALLBACK_DOMAIN = 'cromia.local';

const normalizeBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1';

const isQuietClient = (client: Record<string, unknown>) =>
  normalizeBoolean(client.is_free_or_trade) || normalizeBoolean(client.one_time_payment);

const normalizeOnboardingStatus = (value: unknown) => {
  const token = String(value || '').toLowerCase();
  return token === 'done' ? 'completed' : token || 'pending';
};

const normalizeTaskStatus = (value: unknown) => String(value || '').trim().toLowerCase();

const isDoneTask = (status: unknown) => DONE_TASK_STATUSES.has(normalizeTaskStatus(status));

const isInProgressTask = (status: unknown) => IN_PROGRESS_TASK_STATUSES.has(normalizeTaskStatus(status));

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });

const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error('Não autenticado.');
  return user;
};

const getCurrentProfile = async () => {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw error;
  return { user, profile: data };
};

const buildDriveFileUrl = (fileId: string, mode: 'view' | 'download' = 'view') =>
  mode === 'download'
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
    : `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;

const buildPortalUrl = (reference: string, clientName?: string | null) => {
  const basePath = String(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  const readableReference = slugify(clientName || '');
  const fallbackReference = slugify(reference) || String(reference || '');
  const normalizedPath = `${basePath}portal/${encodeURIComponent(readableReference || fallbackReference)}`;
  if (typeof window === 'undefined') return normalizedPath;
  return new URL(normalizedPath, window.location.origin).toString();
};

const createPortalRowToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const resolveEmailIdentifier = async (identifier: string) => {
  const sanitized = String(identifier || '').trim();
  if (!sanitized) {
    throw new Error('Informe um username ou e-mail para entrar.');
  }

  // Se já é email, retorna direto
  if (sanitized.includes('@')) {
    return sanitized;
  }

  try {
    console.log('🔍 Buscando username:', sanitized);

    // Busca exata primeiro
    const { data: exactMatch, error: exactError } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('username', sanitized)
      .maybeSingle();

    console.log('Resultado busca exata:', { exactMatch, exactError });

    if (exactMatch?.email) {
      console.log('✅ Email encontrado (busca exata):', exactMatch.email);
      return String(exactMatch.email);
    }

    // Se não encontrar, tenta case-insensitive
    const { data: caseInsensitive, error: caseError } = await supabase
      .from('profiles')
      .select('email, username')
      .filter('username', 'ilike', sanitized)
      .maybeSingle();

    console.log('Resultado busca case-insensitive:', { caseInsensitive, caseError });

    if (caseInsensitive?.email) {
      console.log('✅ Email encontrado (case-insensitive):', caseInsensitive.email);
      return String(caseInsensitive.email);
    }

    // Se ainda não encontrar, busca parcial
    const { data: partial, error: partialError } = await supabase
      .from('profiles')
      .select('email, username')
      .filter('username', 'ilike', `%${sanitized}%`)
      .limit(1)
      .single();

    console.log('Resultado busca parcial:', { partial, partialError });

    if (partial?.email) {
      console.log('✅ Email encontrado (parcial):', partial.email);
      return String(partial.email);
    }

    throw new Error('Usuário não encontrado ou sem e-mail vinculado.');
  } catch (error: any) {
    console.error('❌ Erro ao resolver email:', error);
    throw new Error('Usuário não encontrado ou sem e-mail vinculado.');
  }
};

const slugify = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const calculateFinanceSummary = (entries: any[]) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalIncome = 0;
  let totalExpense = 0;
  let recurringIncomeThisMonth = 0;
  let acquisitionExpenseThisMonth = 0;
  const recurringClients = new Set<string>();

  for (const entry of entries) {
    const amount = Number(entry.amount || 0);
    const date = new Date(entry.date || entry.created_at || now.toISOString());
    const sameMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    const isRecurringClient = !normalizeBoolean(entry.client?.one_time_payment);

    if (entry.type === 'income') {
      totalIncome += amount;
      if (sameMonth && isRecurringClient) {
        recurringIncomeThisMonth += amount;
        if (entry.client_id) recurringClients.add(String(entry.client_id));
      }
    } else {
      totalExpense += amount;
      if (sameMonth && normalizeBoolean(entry.acquisition_cost)) {
        acquisitionExpenseThisMonth += amount;
      }
    }
  }

  const activeRecurringClients = recurringClients.size;
  const averageRecurringRevenue = activeRecurringClients > 0 ? recurringIncomeThisMonth / activeRecurringClients : 0;

  return {
    mrr: recurringIncomeThisMonth,
    cac: activeRecurringClients > 0 ? acquisitionExpenseThisMonth / activeRecurringClients : 0,
    ltv: averageRecurringRevenue * 12,
    total_income: totalIncome,
    total_expense: totalExpense,
    net_profit: totalIncome - totalExpense,
  };
};

const getSettingValue = async (key: string) => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  return (data?.value as Record<string, any>) || {};
};

const saveSettingValue = async (key: string, value: Record<string, unknown>) => {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('system_settings')
    .upsert(
      {
        key,
        value,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

const logActivity = async (
  action: string,
  entity: string,
  entityId?: string | null,
  clientId?: string | null,
  metadata: Record<string, unknown> = {}
) => {
  try {
    const user = await getCurrentUser();
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      client_id: clientId || null,
      action,
      entity,
      entity_id: entityId || null,
      metadata,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch {
    // Best effort only.
  }
};

const ensureUniquePortalToken = async (desired: string, clientId?: string) => {
  const base = slugify(desired) || `cliente-${Date.now()}`;
  let suffix = 0;
  let candidate = base;

  while (true) {
    let query = supabase.from('clients').select('id').eq('portal_token', candidate);
    if (clientId) query = query.neq('id', clientId);

    const { data, error } = await query.limit(1);
    if (error) throw error;
    if (!data?.length) return candidate;

    suffix += 1;
    candidate = `${base}-${suffix + 1}`;
  }
};

const provisionOnboardingTasks = async (clientId: string) => {
  const template = await getSettingValue('onboarding_template');
  const items = Array.isArray(template?.tasks) ? template.tasks : [];
  if (!items.length) return [];

  const payload = items.map((item: any, index: number) => ({
    client_id: clientId,
    title: String(item?.title || `Etapa ${index + 1}`),
    description: item?.description ? String(item.description) : null,
    required: Boolean(item?.required),
    status: 'pending',
    order_index: Number(item?.order_index || index + 1),
    due_date: item?.due_date || null,
  }));

  const { data, error } = await supabase.from('onboarding_tasks').insert(payload).select('*');
  if (error) throw error;
  return data || [];
};

const getEphemeralAuthClient = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase não configurado corretamente no frontend.');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

const invokeFunction = async <T>(name: string, body?: Record<string, unknown>) => {
  // Always attach the session token so Edge Functions can verify the caller.
  const { data: { session } } = await supabase.auth.getSession();
  const options: Parameters<typeof supabase.functions.invoke>[1] = body ? { body } : {};
  if (session?.access_token) {
    options.headers = { ...options.headers, Authorization: `Bearer ${session.access_token}` };
  }
  const { data, error } = await supabase.functions.invoke(name, options);
  if (error) throw error;
  return data as T;
};

const POSTING_CALENDAR_TEMPLATE_SETTING_KEY = 'posting_calendar_templates';
const POSTING_CALENDAR_BUCKET = 'posting-calendars';

const isMissingRelationError = (error: unknown, relation: string) => {
  const message = String((error as { message?: unknown })?.message || '').toLowerCase();
  return message.includes('does not exist') && message.includes(relation.toLowerCase());
};

const isMissingColumnError = (error: unknown, column: string) => {
  const code = String((error as { code?: unknown })?.code || '').toUpperCase();
  const message = String((error as { message?: unknown })?.message || '').toLowerCase();
  const target = column.toLowerCase();
  return (
    (message.includes('column') && message.includes(target) && message.includes('does not exist')) ||
    (code === 'PGRST204' && message.includes(target) && message.includes('schema cache'))
  );
};

const getPostingCalendarTemplateRegistryFallback = async () =>
  normalizePostingCalendarTemplateRegistry(await getSettingValue(POSTING_CALENDAR_TEMPLATE_SETTING_KEY));

const savePostingCalendarTemplateRegistryFallback = async (registry: unknown) =>
  saveSettingValue(POSTING_CALENDAR_TEMPLATE_SETTING_KEY, registry as Record<string, unknown>);

const normalizeLoginJoke = (item: any) => ({
  id: String(item.id),
  text: String(item.text || ''),
  active: item.active !== false,
  created_at: item.created_at ? String(item.created_at) : null,
});

export const AuthService = {
  login: async (identifier: string, password: string) => {
    const email = await resolveEmailIdentifier(identifier);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { session: data.session, user: data.user };
  },

  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session || null;
  },

  getMe: async () => {
    const { user, profile } = await getCurrentProfile();
    return {
      ...user,
      profile,
      role: profile?.role || 'user',
      username: profile?.username || user.user_metadata?.username || null,
    };
  },

  getAppConfig: async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['branding', 'plans_catalog', 'dashboard_blocks', 'dashboard_rules']);

    if (error) throw error;

    return (data || []).reduce<Record<string, any>>((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  },

  updateMyProfile: async (payload: { full_name: string; username: string; avatar_url?: string | null }) => {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: payload.full_name,
        username: payload.username || null,
        avatar_url: payload.avatar_url || null,
      })
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    await logActivity('profile_updated', 'profile', user.id, null, { username: data.username });
    return data;
  },

  changeMyPassword: async (currentPassword: string, newPassword: string) => {
    const user = await getCurrentUser();
    if (!user.email) throw new Error('Usuário sem e-mail vinculado.');

    const authClient = getEphemeralAuthClient();
    const { error: verifyError } = await authClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) throw new Error('Senha atual inválida.');

    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    await logActivity('password_changed', 'profile', user.id);
    return data.user;
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};

export const ClientService = {
  getAll: async (params?: { search?: string; status?: string; include_free_or_trade?: boolean }) => {
    let query = supabase.from('clients').select('*').order('created_at', { ascending: false });

    if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
    if (params?.search) query = query.or(`name.ilike.%${params.search}%,email.ilike.%${params.search}%`);

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao carregar clientes:', error);
      return [];
    }

    return (data || []).filter((item) => !isQuietClient(item as Record<string, unknown>));
  },

  getById: async (id: string) => {
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  create: async (payload: Record<string, any>) => {
    const user = await getCurrentUser();
    const insertPayload = {
      owner_id: user.id,
      name: String(payload.name || '').trim(),
      email: String(payload.email || '').trim() || `${slugify(payload.name || 'cliente')}@${PORTAL_FALLBACK_DOMAIN}`,
      phone: payload.phone ? String(payload.phone).trim() : null,
      plan: String(payload.plan || 'Social Media Mensal'),
      industry: payload.industry ? String(payload.industry).trim() : null,
      notes: payload.notes ? String(payload.notes).trim() : null,
      site_url: payload.site_url ? String(payload.site_url).trim() : null,
      site_description: payload.site_description ? String(payload.site_description).trim() : null,
      display_order: Number(payload.display_order || 0),
      is_visible_site: payload.is_visible_site !== false,
      is_featured_site: Boolean(payload.is_featured_site),
      testimonial_content: payload.testimonial_content ? String(payload.testimonial_content).trim() : null,
      testimonial_author_name: payload.testimonial_author_name ? String(payload.testimonial_author_name).trim() : null,
      testimonial_author_role: payload.testimonial_author_role ? String(payload.testimonial_author_role).trim() : null,
      testimonial_author_avatar: payload.testimonial_author_avatar ? String(payload.testimonial_author_avatar).trim() : null,
      testimonial_rating: Number(payload.testimonial_rating || 5),
      testimonial_display_order: Number(payload.testimonial_display_order || 0),
      is_testimonial_visible: Boolean(payload.is_testimonial_visible),
      is_free_or_trade: Boolean(payload.is_free_or_trade),
      one_time_payment: Boolean(payload.one_time_payment),
      generate_drive_folder: payload.generate_drive_folder !== false,
      status: payload.status || 'active',
      portal_token: await ensureUniquePortalToken(payload.name || 'cliente'),
      portal_active: true,
    };

    const { data, error } = await supabase.from('clients').insert(insertPayload).select('*').single();
    if (error) throw error;

    let clientRow = data;

    try {
      await provisionOnboardingTasks(clientRow.id);
    } catch (provisionError) {
      console.error('Falha ao provisionar onboarding:', provisionError);
    }

    if (clientRow.generate_drive_folder !== false) {
      try {
        const driveData = await invokeFunction<{ folderId?: string; subfolders?: Record<string, string> }>('create-drive-folder', {
          clientName: clientRow.name,
          ramo: clientRow.industry || clientRow.segment || 'GERAL',
        });

        if (driveData?.folderId) {
          const { data: updatedClient, error: updateError } = await supabase
            .from('clients')
            .update({
              drive_folder_id: driveData.folderId,
              drive_subfolders: driveData.subfolders || {},
            })
            .eq('id', clientRow.id)
            .select('*')
            .single();

          if (!updateError && updatedClient) clientRow = updatedClient;
        }
      } catch (driveError) {
        console.error('Falha ao criar pasta inicial do Drive:', driveError);
      }
    }

    await logActivity('client_created', 'client', clientRow.id, clientRow.id, {
      name: clientRow.name,
      plan: clientRow.plan,
    });

    return clientRow;
  },

  update: async (id: string, payload: any) => {
    const { data, error } = await supabase.from('clients').update(payload).eq('id', id).select('*').single();
    if (error) throw error;

    await logActivity('client_updated', 'client', id, id, {
      fields: Object.keys(payload || {}),
    });

    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    await logActivity('client_deleted', 'client', id, id);
  },

  uploadLogo: async (clientId: string, file: File) => {
    const logoUrl = await readFileAsDataUrl(file);
    const { data, error } = await supabase
      .from('clients')
      .update({ logo_url: logoUrl })
      .eq('id', clientId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  removeLogo: async (clientId: string) => {
    const { data, error } = await supabase
      .from('clients')
      .update({ logo_url: null })
      .eq('id', clientId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  runAudit: async (clientId: string) => {
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('drive_folder_id')
      .eq('id', clientId)
      .single();

    if (fetchError || !client?.drive_folder_id) throw new Error('Cliente sem pasta vinculada.');

    const data = await invokeFunction<{ success?: boolean; message?: string; error?: string }>('auditoria-drive', {
      clientId,
      clienteFolderId: client.drive_folder_id,
    });

    if (data?.success === false) throw new Error(data.error || 'Falha ao executar auditoria.');

    await logActivity('drive_audit', 'client', clientId, clientId);
    return data;
  },
};

export const UserService = {
  getAll: async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (error) throw error;

    return (data || []).map((item) => ({
      ...item,
      name: item.full_name,
      avatar: item.avatar_url,
    }));
  },

  updateProfile: async (id: string, payload: any) => {
    const { data, error } = await supabase.from('profiles').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
};

export const AdminService = {
  getNotifications: async () => {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) throw error;
    return data || [];
  },

  markNotificationRead: async (id: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  markAllNotificationsRead: async () => {
    const user = await getCurrentUser();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (error) throw error;
    return true;
  },

  getSettings: async (key?: string) => {
    let query = supabase.from('system_settings').select('*');
    if (key) query = query.eq('key', key);
    const { data, error } = await query.order('key');
    if (error) throw error;
    return data || [];
  },

  saveSetting: async (key: string, value: Record<string, unknown>) => {
    return saveSettingValue(key, value);
  },

  createTeamMember: async (payload: Record<string, unknown>) => {
    return invokeFunction('admin-users', {
      action: 'create_user',
      payload,
    });
  },

  updateTeamMember: async (userId: string, payload: Record<string, unknown>) => {
    return invokeFunction('admin-users', {
      action: 'update_user',
      userId,
      payload,
    });
  },
};

export const JokeService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('login_jokes')
      .select('id, text, active, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(normalizeLoginJoke);
  },

  create: async (payload: { text: string; active?: boolean }) => {
    const { data, error } = await supabase
      .from('login_jokes')
      .insert({
        text: String(payload.text || '').trim(),
        active: payload.active !== false,
      })
      .select('id, text, active, created_at')
      .single();

    if (error) throw error;
    await logActivity('login_joke_created', 'login_joke', String(data.id), null, { active: data.active });
    return normalizeLoginJoke(data);
  },

  update: async (id: string, payload: { text?: string; active?: boolean }) => {
    const nextPayload: Record<string, unknown> = {};

    if (typeof payload.text === 'string') {
      nextPayload.text = payload.text.trim();
    }

    if (typeof payload.active === 'boolean') {
      nextPayload.active = payload.active;
    }

    const { data, error } = await supabase
      .from('login_jokes')
      .update(nextPayload)
      .eq('id', id)
      .select('id, text, active, created_at')
      .single();

    if (error) throw error;
    await logActivity('login_joke_updated', 'login_joke', id, null, { fields: Object.keys(nextPayload) });
    return normalizeLoginJoke(data);
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('login_jokes').delete().eq('id', id);
    if (error) throw error;
    await logActivity('login_joke_deleted', 'login_joke', id);
    return true;
  },
};

export const FinanceService = {
  getAll: async (params?: { clientId?: string }) => {
    let query = supabase
      .from('finance_entries')
      .select('*, clients(name, one_time_payment, is_free_or_trade)')
      .order('date', { ascending: false });

    if (params?.clientId) query = query.eq('client_id', params.clientId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || [])
      .filter((item: any) => !item.clients || !isQuietClient(item.clients as Record<string, unknown>))
      .map((item: any) => ({
        ...item,
        amount: Number(item.amount || 0),
        client_name: item.clients?.name || null,
        client: item.clients || null,
      }));
  },

  create: async (payload: any) => {
    const { data, error } = await supabase.from('finance_entries').insert(payload).select('*').single();
    if (error) throw error;

    await logActivity('finance_entry_created', 'finance_entry', data.id, data.client_id, {
      type: data.type,
      amount: Number(data.amount || 0),
    });

    return data;
  },

  getSummary: async () => {
    const entries = await FinanceService.getAll();
    return calculateFinanceSummary(entries as any[]);
  },
};

export const BoardService = {
  getTasks: async (clientId?: string) => {
    let query = supabase
      .from('tasks')
      .select('*, clients!tasks_client_id_fkey(name, is_free_or_trade, one_time_payment)')
      .order('status', { ascending: true })
      .order('order_index', { ascending: true });

    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || [])
      .filter((item: any) => !item.clients || !isQuietClient(item.clients as Record<string, unknown>))
      .map((item: any) => ({
        ...item,
        client_name: item.clients?.name || null,
      }));
  },

  updateTaskStatus: async (id: string, status: string, orderIndex?: number) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status,
        ...(typeof orderIndex === 'number' ? { order_index: orderIndex } : {}),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  updateTask: async (id: string, payload: any) => {
    const { data, error } = await supabase.from('tasks').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },

  createTask: async (payload: any) => {
    if (!payload?.client_id) throw new Error('Selecione um cliente antes de criar a tarefa.');

    const { data, error } = await supabase.from('tasks').insert(payload).select('*, clients!tasks_client_id_fkey(name)').single();
    if (error) throw error;

    await logActivity('task_created', 'task', data.id, data.client_id, {
      title: data.title,
      status: data.status,
    });

    return {
      ...data,
      client_name: data.clients?.name || null,
    };
  },

  deleteTask: async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    await logActivity('task_deleted', 'task', id);
  },

  updateTasksBatch: async (items: Array<{ id: string; status: string; order_index: number }>) => {
    await Promise.all(
      items.map((item) =>
        supabase
          .from('tasks')
          .update({ status: item.status, order_index: item.order_index })
          .eq('id', item.id)
      )
    );

    return items;
  },
};

export const KanbanService = {
  getColumns: async (clientId?: string) => {
    const key = clientId ? `kanban_pipeline_client_${clientId}` : 'kanban_pipeline';
    const settings = await getSettingValue(key);

    if (clientId && !Array.isArray(settings?.columns)) {
      const fallback = await getSettingValue('kanban_pipeline');
      return Array.isArray(fallback?.columns) ? fallback.columns : [];
    }

    return Array.isArray(settings?.columns) ? settings.columns : [];
  },

  updateColumns: async (columns: Array<{ id: string; title: string; color?: string }>, clientId?: string) => {
    const key = clientId ? `kanban_pipeline_client_${clientId}` : 'kanban_pipeline';
    const current = await getSettingValue(key);
    const normalized = columns.map((column, index) => ({
      id: String(column.id || `col-${index + 1}`),
      title: String(column.title || `Coluna ${index + 1}`),
      color: String(column.color || '#475569'),
      order: index + 1,
    }));

    await saveSettingValue(key, {
      ...current,
      client_id: clientId || null,
      columns: normalized,
    });

    return normalized;
  },

  updateGlobalColumns: async (columns: Array<{ id: string; title: string; color?: string }>) => {
    return KanbanService.updateColumns(columns);
  },
};

export const OnboardingService = {
  getAll: async (clientId?: string) => {
    let query = supabase
      .from('onboarding_tasks')
      .select('*, clients(name, is_free_or_trade, one_time_payment)')
      .order('order_index', { ascending: true });

    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || [])
      .filter((item: any) => !item.clients || !isQuietClient(item.clients as Record<string, unknown>))
      .map((item: any) => ({
        ...item,
        status: normalizeOnboardingStatus(item.status),
        client_name: item.clients?.name || null,
      }));
  },

  updateStatus: async (taskId: string, status: string) => {
    const normalizedStatus = normalizeOnboardingStatus(status);
    const { data, error } = await supabase
      .from('onboarding_tasks')
      .update({
        status: normalizedStatus,
        completed_at: normalizedStatus === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', taskId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },
};

export const DashboardService = {
  getSummary: async () => {
    try {
      const [
        { data: clients, error: clientsError },
        { data: tasks, error: tasksError },
        { data: onboarding, error: onboardingError },
        { data: activity, error: activityError },
      ] = await Promise.all([
        supabase.from('clients').select('id, name, status, created_at, is_free_or_trade, one_time_payment'),
        supabase.from('tasks').select('id, client_id, status, due_date, created_at, updated_at'),
        supabase.from('onboarding_tasks').select('id, client_id, status, created_at, updated_at, completed_at'),
        supabase
          .from('activity_logs')
          .select('id, client_id, created_at, action, entity, entity_id, metadata')
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      if (clientsError) throw clientsError;
      if (tasksError) throw tasksError;
      if (onboardingError) throw onboardingError;
      if (activityError) throw activityError;

      const clientRows = (clients || []).filter((client: any) => !isQuietClient(client as Record<string, unknown>));
      const quietClientIds = new Set(
        (clients || [])
          .filter((client: any) => isQuietClient(client as Record<string, unknown>))
          .map((client: any) => String(client.id))
      );
      const taskRows = (tasks || []).filter((task: any) => !task.client_id || !quietClientIds.has(String(task.client_id)));
      const onboardingRows = (onboarding || []).filter(
        (item: any) => !item.client_id || !quietClientIds.has(String(item.client_id))
      );
      const activityRows = (activity || []).filter(
        (item: any) => !item.client_id || !quietClientIds.has(String(item.client_id))
      );

      const tasksByClient = new Map<string, any[]>();
      const onboardingByClient = new Map<string, any[]>();
      const activityByClient = new Map<string, string>();
      const clientNameById = new Map<string, string>(clientRows.map((client: any) => [String(client.id), String(client.name || '')]));

      for (const task of taskRows) {
        const bucket = tasksByClient.get(task.client_id) || [];
        bucket.push(task);
        tasksByClient.set(task.client_id, bucket);
      }

      for (const item of onboardingRows) {
        const bucket = onboardingByClient.get(item.client_id) || [];
        bucket.push(item);
        onboardingByClient.set(item.client_id, bucket);
      }

      for (const log of activityRows) {
        if (!log.client_id) continue;
        if (!activityByClient.has(log.client_id)) {
          activityByClient.set(log.client_id, String(log.created_at));
        }
      }

      const recentActivity = activityRows.slice(0, 6).map((item: any) => ({
        id: String(item.id || ''),
        action: String(item.action || 'activity'),
        entity: String(item.entity || 'activity'),
        entity_id: item.entity_id ? String(item.entity_id) : null,
        client_id: item.client_id ? String(item.client_id) : null,
        client_name: item.client_id ? clientNameById.get(String(item.client_id)) || null : null,
        created_at: item.created_at ? String(item.created_at) : null,
        metadata: item.metadata || null,
      }));

      const now = new Date();
      const clientHealth = clientRows.map((client: any) => {
        const clientTasks = tasksByClient.get(client.id) || [];
        const clientOnboarding = onboardingByClient.get(client.id) || [];
        const pendingTasks = clientTasks.filter((task) => !isDoneTask(task.status)).length;
        const overdueTasks = clientTasks.filter((task) => {
          if (!task.due_date || isDoneTask(task.status)) return false;
          const due = new Date(task.due_date);
          return Number.isFinite(due.getTime()) && due.getTime() < now.getTime();
        }).length;
        const completedOnboarding = clientOnboarding.filter(
          (item) => normalizeOnboardingStatus(item.status) === 'completed'
        ).length;
        const onboardingCompletion = clientOnboarding.length
          ? Math.round((completedOnboarding / clientOnboarding.length) * 100)
          : 0;

        const lastTaskDate = clientTasks
          .map((task) => String(task.updated_at || task.created_at || ''))
          .filter(Boolean)
          .sort()
          .reverse()[0];
        const lastOnboardingDate = clientOnboarding
          .map((item) => String(item.updated_at || item.completed_at || item.created_at || ''))
          .filter(Boolean)
          .sort()
          .reverse()[0];
        const lastActivity = [activityByClient.get(client.id), lastTaskDate, lastOnboardingDate]
          .filter(Boolean)
          .sort()
          .reverse()[0] || null;

        return {
          id: client.id,
          name: client.name,
          status: client.status,
          pending_tasks: pendingTasks,
          overdue_tasks: overdueTasks,
          onboarding_completion: onboardingCompletion,
          pending_onboarding: Math.max(clientOnboarding.length - completedOnboarding, 0),
          total_open_items: pendingTasks + Math.max(clientOnboarding.length - completedOnboarding, 0),
          last_activity: lastActivity,
        };
      });

      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      return {
        operations: {
          clients: {
            total: clientRows.length,
            active: clientRows.filter((client: any) => client.status === 'active').length,
            leads: clientRows.filter((client: any) => client.status === 'lead').length,
            new_this_month: clientRows.filter((client: any) => {
              const created = new Date(client.created_at);
              return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
            }).length,
          },
          tasks: {
            total: taskRows.length,
            pending: taskRows.filter((task: any) => !isDoneTask(task.status) && !isInProgressTask(task.status)).length,
            in_progress: taskRows.filter((task: any) => isInProgressTask(task.status)).length,
            done: taskRows.filter((task: any) => isDoneTask(task.status)).length,
            overdue: taskRows.filter((task: any) => {
              if (!task.due_date || isDoneTask(task.status)) return false;
              return new Date(task.due_date).getTime() < now.getTime();
            }).length,
          },
          onboarding: {
            total: onboardingRows.length,
            pending: onboardingRows.filter((item: any) => normalizeOnboardingStatus(item.status) !== 'completed').length,
            completed: onboardingRows.filter((item: any) => normalizeOnboardingStatus(item.status) === 'completed').length,
            in_progress_clients: clientHealth.filter(
              (client) => client.onboarding_completion > 0 && client.onboarding_completion < 100
            ).length,
            completed_clients: clientHealth.filter((client) => client.onboarding_completion === 100).length,
            completion_rate: clientHealth.length
              ? Math.round(
                  clientHealth.reduce((acc, item) => acc + item.onboarding_completion, 0) / clientHealth.length
                )
              : 0,
          },
        },
        client_health: clientHealth,
        recent_activity: recentActivity,
      };
    } catch (err) {
      console.error('Erro no DashboardService:', err);
      return {
        operations: {
          clients: { total: 0, active: 0, leads: 0, new_this_month: 0 },
          tasks: { total: 0, pending: 0, in_progress: 0, done: 0, overdue: 0 },
          onboarding: {
            total: 0,
            pending: 0,
            completed: 0,
            in_progress_clients: 0,
            completed_clients: 0,
            completion_rate: 0,
          },
        },
        client_health: [],
        recent_activity: [],
      };
    }
  },

  getMonitoring: async () => {
    const [eventsResult, financeEntries, quietClientsResult] = await Promise.all([
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50),
      FinanceService.getAll(),
      supabase.from('clients').select('id, is_free_or_trade, one_time_payment'),
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (quietClientsResult.error) throw quietClientsResult.error;

    const quietClientIds = new Set(
      (quietClientsResult.data || [])
        .filter((client: any) => isQuietClient(client as Record<string, unknown>))
        .map((client: any) => String(client.id))
    );

    return {
      metrics: calculateFinanceSummary(financeEntries as any[]),
      events: (eventsResult.data || []).filter(
        (event: any) => !event.client_id || !quietClientIds.has(String(event.client_id))
      ),
    };
  },
};

export const FileService = {
  setupClient: async (clientId: string) => {
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, industry, segment, drive_folder_id, drive_subfolders, generate_drive_folder')
      .eq('id', clientId)
      .single();

    if (error) throw error;
    if (client.drive_folder_id || client.generate_drive_folder === false) return client;

    const driveData = await invokeFunction<{ folderId?: string; subfolders?: Record<string, string> }>('create-drive-folder', {
      clientName: client.name,
      ramo: client.industry || client.segment || 'GERAL',
    });

    if (!driveData?.folderId) return client;

    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update({
        drive_folder_id: driveData.folderId,
        drive_subfolders: driveData.subfolders || {},
      })
      .eq('id', clientId)
      .select('*')
      .single();

    if (updateError) throw updateError;
    return updatedClient;
  },

  listByClient: async (clientId: string) => {
    const { data, error } = await supabase
      .from('drive_files')
      .select('*')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      modifiedTime: item.updated_at,
      webViewLink: buildDriveFileUrl(String(item.file_id)),
    }));
  },
};

export const InteractionService = {
  getByClientId: async (clientId: string) => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map((item: any) => {
      const action = String(item.action || '').toLowerCase();
      let type: 'meeting' | 'email' | 'call' | 'whatsapp' = 'meeting';
      if (action.includes('email')) type = 'email';
      else if (action.includes('call') || action.includes('lig')) type = 'call';
      else if (action.includes('whats')) type = 'whatsapp';

      return {
        id: item.id,
        date: item.created_at,
        summary:
          item.metadata?.summary ||
          item.metadata?.message ||
          `${item.action} • ${item.entity}${item.entity_id ? ` (${item.entity_id})` : ''}`,
        type,
      };
    });
  },
};

export const PortalService = {
  getByClientId: async (clientId: string) => {
    const [{ data: client, error: clientError }, { data: portalRows, error: portalError }] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, portal_token, portal_active')
        .eq('id', clientId)
        .maybeSingle(),
      supabase
        .from('client_portal')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    if (clientError) throw clientError;
    if (portalError) throw portalError;
    if (!client?.portal_token) return null;

    const latest = portalRows?.[0];
    return {
      id: latest?.id || clientId,
      token: client.portal_token,
      url: buildPortalUrl(client.name, client.name),
      is_active: latest?.is_active ?? client.portal_active ?? true,
      expires_at: latest?.expires_at || null,
      created_at: latest?.created_at || null,
      is_legacy: false,
    };
  },

  generateForClient: async (
    clientId: string,
    payload?: {
      expires_in_days?: number;
      token?: string;
    }
  ) => {
    const desiredToken = payload?.token || `cliente-${clientId}`;
    const token = await ensureUniquePortalToken(desiredToken, clientId);
    const expiresInDays = Math.max(1, Number(payload?.expires_in_days || 90));
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('clients')
      .update({
        portal_token: token,
        portal_active: true,
      })
      .eq('id', clientId);

    if (updateError) throw updateError;

    const { data: clientRow, error: clientRowError } = await supabase
      .from('clients')
      .select('id, name, portal_token, portal_active')
      .eq('id', clientId)
      .maybeSingle();

    if (clientRowError) throw clientRowError;

    const { data: portalRow, error: portalError } = await supabase
      .from('client_portal')
      .insert({
        client_id: clientId,
        token: createPortalRowToken(),
        expires_at: expiresAt,
        is_active: true,
      })
      .select('*')
      .single();

    if (portalError) throw portalError;

    await logActivity('portal_generated', 'client_portal', portalRow.id, clientId, {
      token,
      expires_at: expiresAt,
    });

    return {
      id: portalRow.id,
      token,
      url: buildPortalUrl(clientRow?.name || token, clientRow?.name || null),
      is_active: true,
      expires_at: expiresAt,
      created_at: portalRow.created_at,
      is_legacy: false,
    };
  },
};

export const DriveService = {
  list: async (params: { clientId: string; folderId?: string; sort?: string; order?: string }) => {
    return invokeFunction<{
      rootFolderId: string;
      currentFolderId: string;
      currentFolderLink?: string;
      clientName?: string;
      items: any[];
    }>('drive-interactor', {
      action: 'list',
      clientId: params.clientId,
      folderId: params.folderId,
      sort: params.sort,
      order: params.order,
    });
  },

  upload: async (
    params: { clientId: string; folderId: string; file: File },
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    formData.append('clientId', params.clientId);
    formData.append('folderId', params.folderId);
    formData.append('file', params.file);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${SUPABASE_URL}/functions/v1/drive-upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        const body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else {
          reject(new Error(body?.error || `Upload falhou (${xhr.status}).`));
        }
      };

      xhr.onerror = () => reject(new Error('Erro de rede durante o upload.'));
      xhr.send(formData);
    });
  },

  delete: async (params: { clientId: string; fileId: string }) => {
    return invokeFunction('drive-delete', params);
  },

  createFolder: async (params: { clientId: string; parentId: string; name: string }) => {
    return invokeFunction('drive-interactor', {
      action: 'create_folder',
      clientId: params.clientId,
      folderId: params.parentId,
      name: params.name,
    });
  },
};

export const PostingCalendarService = {
  getResolvedTemplate: async (clientId?: string | null) => {
    try {
      if (clientId) {
        const { data: clientTemplate, error: clientError } = await supabase
          .from('posting_calendar_templates')
          .select('*')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (clientError) throw clientError;
        if (clientTemplate) {
          return {
            template: normalizePostingCalendarTemplateConfig({
              ...clientTemplate,
              ...clientTemplate.config,
              legend_items: clientTemplate.legend_items,
              scope: 'client',
              client_id: clientId,
            }),
            source: 'client' as const,
            persisted: true,
          };
        }
      }

      const { data: defaultTemplate, error: defaultError } = await supabase
        .from('posting_calendar_templates')
        .select('*')
        .is('client_id', null)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (defaultError) throw defaultError;
      if (defaultTemplate) {
        return {
          template: normalizePostingCalendarTemplateConfig({
            ...defaultTemplate,
            ...defaultTemplate.config,
            legend_items: defaultTemplate.legend_items,
            scope: 'default',
            client_id: null,
          }),
          source: 'default' as const,
          persisted: true,
        };
      }
    } catch (error) {
      if (!isMissingRelationError(error, 'posting_calendar_templates')) throw error;
    }

    const registry = await getPostingCalendarTemplateRegistryFallback();
    if (clientId && registry.clients[clientId]) {
      return {
        template: normalizePostingCalendarTemplateConfig({
          ...registry.clients[clientId],
          scope: 'client',
          client_id: clientId,
        }),
        source: 'client' as const,
        persisted: false,
      };
    }

    if (registry.default) {
      return {
        template: normalizePostingCalendarTemplateConfig({
          ...registry.default,
          scope: 'default',
          client_id: null,
        }),
        source: 'default' as const,
        persisted: false,
      };
    }

    return {
      template: normalizePostingCalendarTemplateConfig(DEFAULT_POSTING_CALENDAR_TEMPLATE),
      source: 'classic' as const,
      persisted: false,
    };
  },

  saveTemplate: async (payload: {
    template: PostingCalendarTemplateConfig;
    clientId?: string | null;
    userId?: string | null;
  }) => {
    const scope = payload.clientId ? 'client' : 'default';
    const normalized = normalizePostingCalendarTemplateConfig({
      ...payload.template,
      scope,
      client_id: payload.clientId || null,
      status: 'active',
      version: Number(payload.template.version || 1) + 1,
    });

    try {
      const user = payload.userId ? { id: payload.userId } : await getCurrentUser();

      if (payload.clientId) {
        await supabase
          .from('posting_calendar_templates')
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq('client_id', payload.clientId);
      } else {
        await supabase
          .from('posting_calendar_templates')
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .is('client_id', null);
      }

      const rowPayload = {
        name: normalized.name,
        slug: normalized.slug,
        client_id: normalized.client_id,
        reference_image_url: normalized.reference_image_url,
        config: {
          sidebar_title: normalized.sidebar_title,
          logo_source: normalized.logo_source,
          visibility: normalized.visibility,
          layout: normalized.layout,
          theme: normalized.theme,
        },
        legend_items: normalized.legend_items,
        status: normalized.status,
        is_active: true,
        version: normalized.version,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const query = payload.template.id && !payload.template.id.startsWith('posting-calendar-')
        ? supabase
            .from('posting_calendar_templates')
            .update(rowPayload)
            .eq('id', payload.template.id)
            .select('*')
            .single()
        : supabase
            .from('posting_calendar_templates')
            .insert(rowPayload)
            .select('*')
            .single();

      const { data, error } = await query;
      if (error) throw error;

      await logActivity('posting_calendar_template_saved', 'posting_calendar_template', data.id, payload.clientId || null, {
        scope,
        slug: normalized.slug,
      });

      return normalizePostingCalendarTemplateConfig({
        ...data,
        ...data.config,
        legend_items: data.legend_items,
        scope,
        client_id: payload.clientId || null,
      });
    } catch (error) {
      if (!isMissingRelationError(error, 'posting_calendar_templates')) throw error;
    }

    const registry = await getPostingCalendarTemplateRegistryFallback();
    const nextRegistry = {
      ...registry,
      clients: { ...registry.clients },
    };

    if (payload.clientId) {
      nextRegistry.clients[payload.clientId] = {
        ...normalized,
        id: `posting-calendar-client-${payload.clientId}`,
        scope: 'client',
        client_id: payload.clientId,
      };
    } else {
      nextRegistry.default = {
        ...normalized,
        id: 'posting-calendar-default',
        scope: 'default',
        client_id: null,
      };
    }

    await savePostingCalendarTemplateRegistryFallback(nextRegistry);

    await logActivity('posting_calendar_template_saved', 'system_settings', POSTING_CALENDAR_TEMPLATE_SETTING_KEY, payload.clientId || null, {
      scope,
      slug: normalized.slug,
    });

    return payload.clientId ? nextRegistry.clients[payload.clientId] : nextRegistry.default;
  },

  uploadTemplateReferenceImage: async (params: {
    file: File;
    templateName: string;
    clientId?: string | null;
  }) => {
    const scopeFolder = params.clientId ? `clients/${params.clientId}` : 'default';
    const fileExt = params.file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `${slugify(params.templateName || 'template')}-reference.${fileExt}`;
    const path = `templates/${scopeFolder}/${fileName}`;

    const { error } = await supabase.storage.from(POSTING_CALENDAR_BUCKET).upload(path, params.file, {
      upsert: true,
      contentType: params.file.type || 'image/png',
    });

    if (error) throw error;

    const { data } = supabase.storage.from(POSTING_CALENDAR_BUCKET).getPublicUrl(path);
    return {
      path,
      public_url: data.publicUrl,
    };
  },

  uploadExportFile: async (params: {
    calendarId: string;
    clientId: string;
    month: number;
    year: number;
    fileName: string;
    blob: Blob;
    contentType: string;
  }) => {
    const path = `clients/${params.clientId}/${params.year}/${String(params.month + 1).padStart(2, '0')}/${params.calendarId}/exports/${params.fileName}`;

    const { error } = await supabase.storage.from(POSTING_CALENDAR_BUCKET).upload(path, params.blob, {
      upsert: true,
      contentType: params.contentType,
    });

    if (error) throw error;

    const { data } = supabase.storage.from(POSTING_CALENDAR_BUCKET).getPublicUrl(path);

    await logActivity('posting_calendar_export_uploaded', 'posting_calendar', params.calendarId, params.clientId, {
      path,
      content_type: params.contentType,
    });

    return {
      path,
      public_url: data.publicUrl,
    };
  },

  uploadCalendarAsset: async (params: {
    calendarId: string;
    clientId: string;
    month: number;
    year: number;
    dayNumber: number;
    kind: 'image' | 'video';
    file: File;
  }) => {
    const fileExt = params.file.name.split('.').pop()?.toLowerCase() || (params.kind === 'video' ? 'mp4' : 'png');
    const path = `clients/${params.clientId}/${params.year}/${String(params.month + 1).padStart(2, '0')}/${params.calendarId}/items/day-${String(params.dayNumber).padStart(2, '0')}-${params.kind}.${fileExt}`;

    const { error } = await supabase.storage.from(POSTING_CALENDAR_BUCKET).upload(path, params.file, {
      upsert: true,
      contentType: params.file.type || (params.kind === 'video' ? 'video/mp4' : 'image/png'),
    });

    if (error) throw error;

    const { data } = supabase.storage.from(POSTING_CALENDAR_BUCKET).getPublicUrl(path);
    return {
      path,
      public_url: data.publicUrl,
    };
  },

  saveExportedFileUrl: async (calendarId: string, exportedFileUrl: string | null) =>
    PostingCalendarService.updateCalendar(calendarId, { exported_file_url: exportedFileUrl }),

  getOrCreateCalendar: async (clientId: string, month: number, year: number) => {
    const { data: existing, error: existingError } = await supabase
      .from('posting_calendars')
      .select('*')
      .eq('client_id', clientId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    const user = await getCurrentUser();

    const { data, error } = await supabase
      .from('posting_calendars')
      .insert({
        client_id: clientId,
        month,
        year,
        title: null,
        template_name: null,
        status: 'draft',
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) throw error;

    await logActivity('posting_calendar_created', 'posting_calendar', data.id, clientId, {
      month,
      year,
    });

    return data;
  },

  getCalendarByClientAndMonth: async (clientId: string, month: number, year: number) => {
    const { data, error } = await supabase
      .from('posting_calendars')
      .select('*')
      .eq('client_id', clientId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

updateCalendar: async (
  calendarId: string,
  payload: {
    title?: string | null;
    template_name?: string | null;
    status?: string | null;
    exported_file_url?: string | null;
  }
) => {
  const normalizedPayload = {
    ...(payload.title !== undefined ? { title: payload.title || null } : {}),
    ...(payload.template_name !== undefined ? { template_name: payload.template_name || null } : {}),
    ...(payload.status !== undefined ? { status: payload.status || 'draft' } : {}),
    ...(payload.exported_file_url !== undefined ? { exported_file_url: payload.exported_file_url || null } : {}),
  };

  const { data, error } = await supabase
    .from('posting_calendars')
    .update(normalizedPayload)
    .eq('id', calendarId)
    .select('*')
    .single();

  if (error) throw error;

  await logActivity('posting_calendar_updated', 'posting_calendar', data.id, data.client_id, {
    fields: Object.keys(normalizedPayload),
  });

  return data;
},

  getCalendarItems: async (calendarId: string) => {
    const { data, error } = await supabase
      .from('posting_calendar_items')
      .select('*')
      .eq('calendar_id', calendarId)
      .order('post_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  saveCalendarItem: async (payload: {
    calendar_id: string;
    post_date: string;
    day_number: number;
    post_type: string;
    title?: string | null;
    description?: string | null;
    notes?: string | null;
    image_url?: string | null;
    video_url?: string | null;
    label_color?: string | null;
    status?: string;
    approval_status?: string | null;
    approval_notes?: string | null;
  }) => {
    const { data: existing, error: existingError } = await supabase
      .from('posting_calendar_items')
      .select('id')
      .eq('calendar_id', payload.calendar_id)
      .eq('day_number', payload.day_number)
      .maybeSingle();

    if (existingError) throw existingError;

    const normalizedPayload = {
      calendar_id: payload.calendar_id,
      post_date: payload.post_date,
      day_number: payload.day_number,
      post_type: payload.post_type || 'feed',
      title: payload.title || null,
      description: payload.description || null,
      notes: payload.notes || null,
      image_url: payload.image_url || null,
      video_url: payload.video_url || null,
      label_color: payload.label_color || null,
      status: payload.status || 'planned',
      approval_status: payload.approval_status || 'pending',
      approval_notes: payload.approval_notes || null,
      approved_at: payload.approval_status === 'approved' ? new Date().toISOString() : null,
      approved_by_name: payload.approval_status === 'approved' ? 'Equipe Cromia' : null,
    };

    if (existing?.id) {
      let { data, error } = await supabase
        .from('posting_calendar_items')
        .update(normalizedPayload)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (
        error &&
        (
          isMissingColumnError(error, 'approval_status') ||
          isMissingColumnError(error, 'approval_notes') ||
          isMissingColumnError(error, 'approved_at') ||
          isMissingColumnError(error, 'approved_by_name')
        )
      ) {
        const fallbackPayload = {
          calendar_id: normalizedPayload.calendar_id,
          post_date: normalizedPayload.post_date,
          day_number: normalizedPayload.day_number,
          post_type: normalizedPayload.post_type,
          title: normalizedPayload.title,
          description: normalizedPayload.description,
          notes: normalizedPayload.notes,
          image_url: normalizedPayload.image_url,
          video_url: normalizedPayload.video_url,
          label_color: normalizedPayload.label_color,
          status: normalizedPayload.status,
        };

        const fallbackResponse = await supabase
          .from('posting_calendar_items')
          .update(fallbackPayload)
          .eq('id', existing.id)
          .select('*')
          .single();

        data = fallbackResponse.data;
        error = fallbackResponse.error;
      }

      if (error) throw error;

      await logActivity(
        'posting_calendar_item_updated',
        'posting_calendar_item',
        data.id,
        null,
        {
          calendar_id: payload.calendar_id,
          day_number: payload.day_number,
          post_type: payload.post_type,
        }
      );

      return data;
    }

    let { data, error } = await supabase
      .from('posting_calendar_items')
      .insert(normalizedPayload)
      .select('*')
      .single();

    if (
      error &&
      (
        isMissingColumnError(error, 'approval_status') ||
        isMissingColumnError(error, 'approval_notes') ||
        isMissingColumnError(error, 'approved_at') ||
        isMissingColumnError(error, 'approved_by_name')
      )
    ) {
      const fallbackPayload = {
        calendar_id: normalizedPayload.calendar_id,
        post_date: normalizedPayload.post_date,
        day_number: normalizedPayload.day_number,
        post_type: normalizedPayload.post_type,
        title: normalizedPayload.title,
        description: normalizedPayload.description,
        notes: normalizedPayload.notes,
        image_url: normalizedPayload.image_url,
        video_url: normalizedPayload.video_url,
        label_color: normalizedPayload.label_color,
        status: normalizedPayload.status,
      };

      const fallbackResponse = await supabase
        .from('posting_calendar_items')
        .insert(fallbackPayload)
        .select('*')
        .single();

      data = fallbackResponse.data;
      error = fallbackResponse.error;
    }

    if (error) throw error;

    await logActivity(
      'posting_calendar_item_created',
      'posting_calendar_item',
      data.id,
      null,
      {
        calendar_id: payload.calendar_id,
        day_number: payload.day_number,
        post_type: payload.post_type,
      }
    );

    return data;
  },

  deleteCalendarItem: async (itemId: string) => {
    const { error } = await supabase
      .from('posting_calendar_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;

    await logActivity('posting_calendar_item_deleted', 'posting_calendar_item', itemId);
    return true;
  },
};
