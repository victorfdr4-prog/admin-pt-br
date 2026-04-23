import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '');
export const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

export const DONE_TASK_STATUSES = new Set(['done', 'completed', 'concluido', 'finalizado']);
export const IN_PROGRESS_TASK_STATUSES = new Set(['in-progress', 'in_progress', 'executando', 'doing', 'andamento']);
export const PORTAL_FALLBACK_DOMAIN = 'cromia.local';

export const normalizeBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1';

export const isQuietClient = (client: Record<string, unknown>) =>
  normalizeBoolean(client.is_free_or_trade) || normalizeBoolean(client.one_time_payment);

export const normalizeOnboardingStatus = (value: unknown) => {
  const token = String(value || '').toLowerCase();
  return token === 'done' ? 'completed' : token || 'pending';
};

export const normalizeTaskStatus = (value: unknown) => String(value || '').trim().toLowerCase();

export const isDoneTask = (status: unknown) => DONE_TASK_STATUSES.has(normalizeTaskStatus(status));

export const isInProgressTask = (status: unknown) => IN_PROGRESS_TASK_STATUSES.has(normalizeTaskStatus(status));

export const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });

export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error('Não autenticado.');
  return user;
};

export const getCurrentProfile = async () => {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw error;
  return { user, profile: data };
};

export const slugify = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildDriveFileUrl = (fileId: string, mode: 'view' | 'download' = 'view') =>
  mode === 'download'
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
    : `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;

const resolvePortalBaseUrl = () => {
  const explicitBase = String(import.meta.env.VITE_PORTAL_BASE_URL || '').trim();
  if (explicitBase) return explicitBase.replace(/\/+$/, '');
  if (typeof window === 'undefined') return '';

  const current = new URL(window.location.origin);
  const hostname = current.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return current.origin;
  }

  if (hostname === 'portal.cromiacomunicacao.com') {
    return current.origin;
  }

  return current.origin;
};

export const buildPortalUrl = (reference: string, clientName?: string | null) => {
  const normalizedReference = slugify(clientName || '') || slugify(reference) || String(reference || '').trim();
  if (!normalizedReference) return '';

  const baseUrl = resolvePortalBaseUrl();
  const isDedicatedPortalHost = /portal\.cromiacomunicacao\.com$/i.test(baseUrl);
  const pathname = isDedicatedPortalHost ? `/${encodeURIComponent(normalizedReference)}` : `/portal/${encodeURIComponent(normalizedReference)}`;

  if (!baseUrl) return pathname;
  return new URL(pathname, `${baseUrl}/`).toString();
};


export const createPortalRowToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

export const getSettingValue = async (key: string) => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  return (data?.value as Record<string, any>) || {};
};

export const saveSettingValue = async (key: string, value: Record<string, unknown>) => {
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

// Mapeia action + entity para um título legível na timeline
const buildTimelineTitle = (action: string, entity: string, metadata: Record<string, unknown>): string => {
  const titleMap: Record<string, string> = {
    task_created:         `Tarefa criada: ${String(metadata.title || '')}`,
    task_updated:         `Tarefa atualizada: ${String(metadata.title || '')}`,
    task_deleted:         'Tarefa removida',
    task_status_change:   `Status alterado → ${String(metadata.status || '')}`,
    file_upload:          `Arquivo enviado: ${String(metadata.name || '')}`,
    file_deleted:         `Arquivo removido: ${String(metadata.name || '')}`,
    approval_requested:   `Aprovação solicitada: ${String(metadata.title || '')}`,
    approval_approved:    `Aprovado: ${String(metadata.title || '')}`,
    approval_rejected:    `Rejeitado: ${String(metadata.title || '')}`,
    approval_cancelled:   'Aprovação cancelada',
    finance_entry_created:'Lançamento financeiro criado',
    profile_updated:      'Perfil atualizado',
    password_changed:     'Senha alterada',
    client_created:       `Cliente criado: ${String(metadata.name || '')}`,
    client_updated:       `Cliente atualizado: ${String(metadata.name || '')}`,
    onboarding_completed: 'Onboarding concluído',
  };
  return titleMap[action] || `${entity}: ${action.replace(/_/g, ' ')}`;
};

export const logActivity = async (
  action: string,
  entity: string,
  entityId?: string | null,
  clientId?: string | null,
  metadata: Record<string, unknown> = {}
) => {
  try {
    const user = await getCurrentUser();

    await Promise.all([
      // Log original
      supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: clientId || null,
        action,
        entity,
        entity_id: entityId || null,
        metadata,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
      // Dual-write na timeline unificada
      supabase.from('timeline_events').insert({
        event_type: action,
        entity_type: entity,
        entity_id: entityId || user.id,
        client_id: clientId || null,
        actor_id: user.id,
        title: buildTimelineTitle(action, entity, metadata),
        metadata,
      }),
    ]);
  } catch {
    // Best effort only.
  }
};

// ── Edge Function call helpers ────────────────────────────────────────────────

const EDGE_TIMEOUT_MS = 8_000;
const EDGE_MAX_RETRIES = 2;

const getEdgeResponseBody = async (response: Response) => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    try {
      return JSON.stringify(await response.json());
    } catch {
      return '(json inválido)';
    }
  }

  try {
    return await response.text();
  } catch {
    return '(sem corpo)';
  }
};

const resolveValidAccessToken = async () => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`AUTH_SESSION_ERROR: ${sessionError.message}`);
  }

  let activeSession = session;
  const expiresAtMs = Number(activeSession?.expires_at || 0) * 1000;
  const shouldRefresh = !activeSession?.access_token || (expiresAtMs > 0 && expiresAtMs <= Date.now() + 60_000);

  if (shouldRefresh) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error('NOT_AUTHENTICATED: sessão inválida. Faça login novamente.');
    }
    activeSession = refreshed.session;
  }

  if (!activeSession?.access_token) {
    throw new Error('NOT_AUTHENTICATED: sessão inválida. Faça login novamente.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(activeSession.access_token);
  if (userError || !userData.user) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error('NOT_AUTHENTICATED: sessão inválida. Faça login novamente.');
    }
    return refreshed.session.access_token;
  }

  return activeSession.access_token;
};

/**
 * Chama uma Supabase Edge Function via fetch nativo com:
 * - Verificação de sessão antes da chamada (evita 401 desnecessário)
 * - Timeout de 8 s via AbortController
 * - Retry automático em timeout ou erro de rede (não em 4xx/5xx)
 * - Mensagem de erro estruturada para depuração rápida
 */
export const callEdgeFunction = async <T>(
  name: string,
  body?: Record<string, unknown>,
  opts: { timeoutMs?: number; maxRetries?: number } = {}
): Promise<T> => {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const timeoutMs = opts.timeoutMs ?? EDGE_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? EDGE_MAX_RETRIES;

  let lastError: Error = new Error('Nenhuma tentativa realizada.');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const accessToken = await resolveValidAccessToken();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timerId);

      if (!res.ok) {
        if (res.status === 401 && attempt < maxRetries) {
          await supabase.auth.refreshSession().catch(() => null);
          continue;
        }

        const text = await getEdgeResponseBody(res);
        throw new Error(`HTTP_${res.status}: ${text}`);
      }

      return (await res.json()) as T;

    } catch (err) {
      clearTimeout(timerId);

      const isAbort   = (err as Error).name === 'AbortError';
      const isNetwork = !isAbort && (err as Error).message?.startsWith('HTTP_') === false;

      lastError = isAbort
        ? new Error(`TIMEOUT: função "${name}" não respondeu em ${timeoutMs}ms`)
        : (err as Error);

      // Não repete em erros HTTP (4xx/5xx) — só em timeout/rede
      if (!isAbort && !isNetwork) throw lastError;

      // Última tentativa → lança
      if (attempt >= maxRetries) throw lastError;

      // Aguarda backoff exponencial antes da próxima tentativa
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }

  throw lastError;
};

/**
 * Wrapper legado — usa callEdgeFunction internamente.
 * Mantido para compatibilidade com todos os serviços existentes.
 */
export const invokeFunction = async <T>(name: string, body?: Record<string, unknown>): Promise<T> =>
  callEdgeFunction<T>(name, body);

export const getEphemeralAuthClient = () => {
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

export const ensureUniquePortalToken = async (desired: string, clientId?: string) => {
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

export const provisionOnboardingTasks = async (clientId: string) => {
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

export const resolveEmailIdentifier = async (identifier: string) => {
  const sanitized = String(identifier || '').trim();
  if (!sanitized) {
    throw new Error('Informe um username ou e-mail para entrar.');
  }

  if (sanitized.includes('@')) {
    return sanitized;
  }

  try {
    const { data: exactMatch } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('username', sanitized)
      .maybeSingle();

    if (exactMatch?.email) return String(exactMatch.email);

    const { data: caseInsensitive } = await supabase
      .from('profiles')
      .select('email, username')
      .filter('username', 'ilike', sanitized)
      .maybeSingle();

    if (caseInsensitive?.email) return String(caseInsensitive.email);

    const { data: partial } = await supabase
      .from('profiles')
      .select('email, username')
      .filter('username', 'ilike', `%${sanitized}%`)
      .limit(1)
      .single();

    if (partial?.email) return String(partial.email);

    throw new Error('Usuário não encontrado ou sem e-mail vinculado.');
  } catch {
    throw new Error('Usuário não encontrado ou sem e-mail vinculado.');
  }
};

export const calculateFinanceSummary = (entries: any[]) => {
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

export const isMissingRelationError = (error: unknown, relation: string) => {
  const message = String((error as { message?: unknown })?.message || '').toLowerCase();
  return message.includes('does not exist') && message.includes(relation.toLowerCase());
};

export const isMissingColumnError = (error: unknown, column: string) => {
  const code = String((error as { code?: unknown })?.code || '').toUpperCase();
  const message = String((error as { message?: unknown })?.message || '').toLowerCase();
  const target = column.toLowerCase();
  return (
    (message.includes('column') && message.includes(target) && message.includes('does not exist')) ||
    (code === 'PGRST204' && message.includes(target) && message.includes('schema cache'))
  );
};

export const normalizeLoginJoke = (item: any) => ({
  id: String(item.id),
  text: String(item.text || ''),
  active: item.active !== false,
  created_at: item.created_at ? String(item.created_at) : null,
});
