import { supabase } from '@/lib/supabase';

export type SystemLogLevel = 'info' | 'warning' | 'error';

export interface SystemLogInput {
  scope: string;
  action: string;
  clientId?: string | null;
  userId?: string | null;
  tableName?: string | null;
  query?: string | null;
  message?: string | null;
  error?: unknown;
  data?: Record<string, unknown> | null;
  level?: SystemLogLevel;
}

export interface SystemLogRecord {
  id: string;
  scope: string;
  action: string;
  client_id: string | null;
  user_id: string | null;
  table_name: string | null;
  query: string | null;
  message: string | null;
  error: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

const resolveErrorMessage = (error: unknown) => {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const printConsoleLog = (level: SystemLogLevel, input: SystemLogInput, errorMessage: string | null) => {
  const payload = {
    scope: input.scope,
    action: input.action,
    clientId: input.clientId ?? null,
    tableName: input.tableName ?? null,
    query: input.query ?? null,
    message: input.message ?? null,
    data: input.data ?? null,
    error: errorMessage,
  };

  if (level === 'error') {
    console.error('❌ Log do sistema:', payload);
    return;
  }

  if (level === 'warning') {
    console.warn('⚠️ Log do sistema:', payload);
    return;
  }

  console.log('🧾 Log do sistema:', payload);
};

const persistSystemLog = async (input: SystemLogInput, errorMessage: string | null) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !input.userId) {
    return;
  }

  const payload = {
    scope: input.scope,
    action: input.action,
    client_id: input.clientId ?? null,
    user_id: input.userId ?? user?.id ?? null,
    table_name: input.tableName ?? null,
    query: input.query ?? null,
    message: input.message ?? null,
    error: errorMessage,
    data: input.data ?? {},
  };

  const { error } = await supabase.from('system_logs').insert(payload);
  if (error) {
    console.warn('⚠️ Falha ao persistir system_logs:', error);
  }
};

export const systemLog = async (input: SystemLogInput) => {
  const level = input.level ?? 'info';
  const errorMessage = resolveErrorMessage(input.error);
  printConsoleLog(level, input, errorMessage);

  try {
    await persistSystemLog(input, errorMessage);
  } catch (persistError) {
    console.warn('⚠️ Logger interno indisponível:', persistError);
  }
};

export const systemError = async (input: Omit<SystemLogInput, 'level'>) =>
  systemLog({
    ...input,
    level: 'error',
  });

export const SystemLogService = {
  async list(filters?: {
    clientId?: string;
    scope?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    let query = supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters?.limit ?? 200);

    if (filters?.clientId) query = query.eq('client_id', filters.clientId);
    if (filters?.scope && filters.scope !== 'all') query = query.eq('scope', filters.scope);
    if (filters?.from) query = query.gte('created_at', filters.from);
    if (filters?.to) query = query.lte('created_at', filters.to);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as SystemLogRecord[];
  },
};
