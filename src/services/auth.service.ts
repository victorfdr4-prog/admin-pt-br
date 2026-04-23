import { supabase } from '@/lib/supabase';
import {
  getCurrentUser,
  getCurrentProfile,
  getEphemeralAuthClient,
  resolveEmailIdentifier,
  logActivity,
} from './_shared';

const normalizeRedirectPath = (value?: string | null) => {
  const redirectPath = String(value || '').trim();
  if (!redirectPath.startsWith('/') || redirectPath.startsWith('//')) {
    return '/dashboard';
  }
  return redirectPath;
};

const buildOAuthRedirectUrl = (redirectPath?: string | null) => {
  const loginPath = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
  const url = new URL(loginPath, window.location.origin);
  url.searchParams.set('redirect', normalizeRedirectPath(redirectPath));
  return url.toString();
};

export const AuthService = {
  login: async (identifier: string, password: string) => {
    const email = await resolveEmailIdentifier(identifier);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { session: data.session, user: data.user };
  },

  loginWithGoogle: async (redirectPath?: string | null) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildOAuthRedirectUrl(redirectPath),
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
    return data;
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
      access_scope: profile?.access_scope || null,
      functional_profile: profile?.functional_profile || null,
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

  updateMyProfile: async (payload: {
    full_name: string;
    username: string;
    avatar_url?: string | null;
    signature_role?: string | null;
    bio_hook?: string | null;
    phone?: string | null;
    phone_display?: string | null;
    linkedin_url?: string | null;
    signature_html?: string | null;
  }) => {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: payload.full_name,
        username: payload.username || null,
        avatar_url: payload.avatar_url || null,
        signature_role: payload.signature_role || null,
        bio_hook: payload.bio_hook || '',
        phone: payload.phone || null,
        phone_display: payload.phone_display || null,
        linkedin_url: payload.linkedin_url || null,
        signature_html: payload.signature_html || null,
      })
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    await logActivity('profile_updated', 'profile', user.id, null, {
      username: data.username,
      signature_role: data.signature_role,
    });
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
