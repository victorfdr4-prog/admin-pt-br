import React, { useEffect, useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { AuthService } from '@/services';
import { useAuthStore } from '@/store/useAuthStore';
import { useSystemStore } from '@/store/useSystemStore';
import { buildAccessContext } from '@/domain/accessControl';
import { cn } from '@/lib/utils';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const branding = useSystemStore((state) => state.branding);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const redirectTarget = (() => {
    const rawRedirect = String(searchParams.get('redirect') || '/dashboard').trim();
    if (!rawRedirect.startsWith('/') || rawRedirect.startsWith('//')) {
      return '/dashboard';
    }
    return rawRedirect;
  })();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTarget]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!identifier.trim() || !password.trim()) {
      toast.error('Preencha usuário e senha.');
      return;
    }

    setSubmitting(true);

    try {
      const { session } = await AuthService.login(identifier.trim(), password);
      const me = await AuthService.getMe();
      const identity = {
        role: me.role || 'user',
        full_name: me.profile?.full_name || me.user_metadata?.full_name || me.email || 'Usuário',
        username: me.username || me.profile?.username || me.user_metadata?.username || null,
        email: me.email || '',
        access_scope: me.access_scope || me.profile?.access_scope || null,
        functional_profile: me.functional_profile || me.profile?.functional_profile || null,
      };
      const access = buildAccessContext(identity);

      setAuth(
        {
          id: String(me.id),
          name: String(identity.full_name),
          email: String(identity.email),
          username: identity.username ? String(identity.username) : undefined,
          role: access.role,
          access_scope: access.accessScope,
          functional_profile: access.functionalProfile,
          role_label: access.roleLabel,
          avatar: me.profile?.avatar_url ? String(me.profile.avatar_url) : undefined,
        },
        String(session?.access_token || '')
      );

      navigate(redirectTarget, { replace: true });
      toast.success('Sessão iniciada.');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setSubmitting(true);
      await AuthService.loginWithGoogle(redirectTarget);
      // O Supabase redireciona automaticamente, então o toast pode não aparecer ou ser rápido demais
      toast.loading('Redirecionando para o Google...');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Falha ao iniciar login com Google.');
      setSubmitting(false);
    }
  };


  const agencyName = branding.agency_name || 'CromiaOS';
  const initial = agencyName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left Panel: Branding ─────────────────────────── */}
      <div
        className="relative hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #292f4c 0%, #1a1f38 45%, #0f1225 100%)',
        }}
      >
        {/* Decorative gradient orbs */}
        <div
          className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #0073ea 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #a25ddc 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute top-1/2 right-0 h-64 w-64 -translate-y-1/2 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #00c875 0%, transparent 70%)' }}
        />

        {/* Subtle grid pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative flex flex-1 flex-col items-center justify-center p-10 xl:p-14">
          {/* Logo centralizado */}
          <div className="flex flex-col items-center gap-4 text-center">
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt={agencyName}
                className="h-20 w-20 rounded-2xl border border-white/20 object-cover shadow-xl"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 border border-white/20 shadow-xl">
                <span className="text-3xl font-bold text-white">{initial}</span>
              </div>
            )}

            <div>
              <h1 className="text-[2rem] font-bold text-white tracking-tight">{agencyName}</h1>
              <p className="mt-2 text-[14px] text-white/45">Painel interno de operações</p>
            </div>
          </div>

          {/* Linha decorativa */}
          <div className="mt-12 w-16 border-t border-white/10" />

          {/* Ano */}
          <p className="absolute bottom-8 text-[11px] text-white/20 tracking-widest uppercase">
            {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* ── Right Panel: Form ─────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12 xl:px-16">
        {/* Mobile logo */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={agencyName}
              className="mb-3 h-12 w-12 rounded-2xl border border-border object-cover"
            />
          ) : (
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <span className="text-base font-bold">{initial}</span>
            </div>
          )}
          <span className="text-xl font-semibold text-foreground">{agencyName}</span>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-[1.65rem] font-bold tracking-tight text-foreground">
              Acesso à Plataforma
            </h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              Identifique-se para gerenciar as operações
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                E-mail ou Usuário
              </label>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="seu@parceiro.com"
                autoComplete="username"
                className="field-control h-11"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Senha de Acesso
                </label>
                <span className="text-[12px] text-muted-foreground cursor-default select-none opacity-60">
                  Recuperar acesso
                </span>
              </div>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="field-control h-11"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                'btn-primary h-11 w-full justify-center gap-2 text-[14px] font-semibold',
                'transition-all duration-200'
              )}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50"></div>
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-widest text-muted-foreground/60">
              <span className="bg-background px-4">Ou continuar com</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={submitting}
            className={cn(
              "flex w-full items-center justify-center gap-3 h-11 px-4 py-2 rounded-xl",
              "bg-white border border-slate-200 text-slate-700 font-medium text-[14px]",
              "hover:bg-slate-50 hover:border-slate-300 transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            )}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                fill="#EA4335"
              />
            </svg>
            Entrar com Google
          </button>


        </div>
      </div>
    </div>
  );
};

export default LoginPage;
