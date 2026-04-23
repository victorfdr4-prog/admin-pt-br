import { supabase } from '@/lib/supabase';
import {
  buildPortalUrl,
  createPortalRowToken,
  ensureUniquePortalToken,
  logActivity,
} from './_shared';

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
      url: buildPortalUrl(client.portal_token, client.name),
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
      url: buildPortalUrl(token, clientRow?.name || ''),
      is_active: true,
      expires_at: expiresAt,
      created_at: portalRow.created_at,
      is_legacy: false,
    };
  },
};
