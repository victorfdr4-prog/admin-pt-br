import { Suspense, lazy, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from 'react';
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from 'lucide-react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthService } from "@/services";
import { MainLayout } from "@/layouts/MainLayout";
import {
  normalizeBrandingConfig,
  normalizePlansCatalog,
  normalizeDashboardBlocks,
  normalizeOperationalRules,
} from '@/domain/agencyPlatform';
import { useSystemStore } from "@/store/useSystemStore";
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { emitProfileUpdated, emitRealtimeChange, type RealtimeChangeDetail } from '@/lib/realtime';
import DashboardPage from "./pages/DashboardPage";
import BoardsPage from "./pages/BoardsPage";
import ClientsPage from "./pages/ClientsPage";
import IntakePage from "./pages/IntakePage";
import ClientHubPage from "./pages/ClientHubPage";
import OnboardingPage from "./pages/OnboardingPage";
import TeamPage from "./pages/TeamPage";
import FinancePage from "./pages/FinancePage";
import DrivePage from "./pages/DrivePage";
import SettingsPage from "./pages/SettingsPage";
import { PortalPage } from "./pages/PortalPage";
import PublicApprovalPage from "./pages/PublicApprovalPage";
import LogsPage from "./pages/LogsPage";
import DocumentsPage from "./pages/DocumentsPage";
import DocumentEditorPage from "./pages/DocumentEditorPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import WhatsAppPage from "./pages/WhatsAppPage";
import { ThemeProvider } from '@/providers/ThemeProvider';
import { buildAccessContext, canAccessModule, type AppModuleKey } from '@/domain/accessControl';
import { RouteTitleManager } from '@/components/RouteTitleManager';

const PostingCalendarHomePage = lazy(() => import('./pages/PostingCalendarHomePage'));
const PostingCalendarTemplatePage = lazy(() => import('./pages/PostingCalendarTemplatePage'));
const HubPage = lazy(() => import('@/pages/HubPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
const ADMIN_BASENAME = "/admin";
const isPortalSubdomain = () =>
  typeof window !== "undefined" && /^portal\./i.test(window.location.hostname);
const getRouterBasename = () =>
  typeof window === "undefined"
    ? ADMIN_BASENAME
    : isPortalSubdomain()
        ? "/"
        : window.location.pathname.startsWith(ADMIN_BASENAME)
          ? ADMIN_BASENAME
          : "/";

const buildAuthUser = (me: any) => ({
  ...(() => {
    const identity = {
      role: me.role || 'user',
      full_name: me.profile?.full_name || me.user_metadata?.full_name || me.email || 'Usuário',
      username: me.username || me.profile?.username || me.user_metadata?.username || null,
      email: me.email || '',
      access_scope: me.access_scope || me.profile?.access_scope || null,
      functional_profile: me.functional_profile || me.profile?.functional_profile || null,
    };
    const access = buildAccessContext(identity);

    return {
      id: String(me.id),
      name: String(identity.full_name),
      email: String(identity.email),
      username: identity.username ? String(identity.username) : undefined,
      role: access.role,
      access_scope: access.accessScope,
      functional_profile: access.functionalProfile,
      role_label: access.roleLabel,
      avatar: me.profile?.avatar_url ? String(me.profile.avatar_url) : undefined,
    };
  })(),
});

const AppBootstrap = () => {
  const setAppConfig = useSystemStore((state) => state.setAppConfig);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.logout);
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    let cancelled = false;

    setInitialized(false);

    void (async () => {
      try {
        const config = await AuthService.getAppConfig();
        if (cancelled) return;

        setAppConfig({
          branding: normalizeBrandingConfig(config.branding),
          plans: normalizePlansCatalog(config.plans_catalog),
          dashboardBlocks: normalizeDashboardBlocks(config.dashboard_blocks),
          operationalRules: normalizeOperationalRules(config.dashboard_rules),
        });
      } catch (error) {
        console.error('Falha ao carregar configuração do app:', error);
      }
    })();

    // onAuthStateChange fires INITIAL_SESSION immediately — no need for a
    // separate syncAuth() that would duplicate the AuthService.getMe() call.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      if (cancelled) return;

      if (!session) {
        clearAuth();
        setInitialized(true);
        return;
      }

      void (async () => {
        try {
          const me = await AuthService.getMe();
          if (cancelled) return;

          setAuth(buildAuthUser(me), String(session.access_token || ''));
        } catch (error) {
          console.error('Falha ao sincronizar sessão:', error);
          clearAuth();
        } finally {
          if (!cancelled) setInitialized(true);
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [clearAuth, setAppConfig, setAuth, setInitialized]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const channel = supabase.channel('cromia-admin-realtime');

    const handleChange = (payload: RealtimeChangeDetail) => {
      if (cancelled) return;
      emitRealtimeChange(payload);

      if (payload.table === 'system_settings' && payload.newRow) {
        const key = String(payload.newRow.key || '');
        const value = payload.newRow.value;
        const store = useSystemStore.getState();

        if (key === 'branding') {
          store.setBranding(normalizeBrandingConfig(value));
        } else if (key === 'plans_catalog') {
          store.setPlans(normalizePlansCatalog(value));
        } else if (key === 'dashboard_blocks') {
          store.setDashboardBlocks(normalizeDashboardBlocks(value));
        } else if (key === 'dashboard_rules') {
          store.setOperationalRules(normalizeOperationalRules(value));
        }
      }

      if (payload.table === 'profiles' && payload.newRow) {
        const currentUser = useAuthStore.getState().user;
        if (currentUser && String(payload.newRow.id || '') === currentUser.id) {
          const nextUser = {
            name: String(payload.newRow.full_name || payload.newRow.name || currentUser.name),
            username: payload.newRow.username ? String(payload.newRow.username) : currentUser.username,
            email: payload.newRow.email ? String(payload.newRow.email) : currentUser.email,
            avatar: payload.newRow.avatar_url ? String(payload.newRow.avatar_url) : currentUser.avatar,
          };

          useAuthStore.getState().updateUser(nextUser);
          emitProfileUpdated({
            full_name: nextUser.name,
            username: nextUser.username,
            email: nextUser.email,
            avatar_url: nextUser.avatar,
          });
        }
      }
    };

    const tables = [
      'system_settings',
      'profiles',
      'clients',
      'tasks',
      'onboarding_tasks',
      'finance_entries',
      'login_jokes',
      'timeline_events',
      'approvals',
      'file_comments',
      'file_versions',
      'intake_requests',
      'drive_files',
    ];
    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) =>
          handleChange({
            schema: String(payload.schema || 'public'),
            table: String(payload.table || table),
            eventType: payload.eventType as RealtimeChangeDetail['eventType'],
            newRow: (payload.new as Record<string, unknown> | null) || null,
            oldRow: (payload.old as Record<string, unknown> | null) || null,
          })
      );
    });

    void channel.subscribe();

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [isAuthenticated]);

  return null;
};

const ProtectedRoute = ({
  children,
  module,
}: {
  children: React.ReactNode;
  module?: AppModuleKey;
}) => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const user = useAuthStore((state) => state.user);

  if (isPortalSubdomain()) {
    return <NotFound />;
  }

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <Loader2 size={16} className="animate-spin text-primary" />
          Validando sessão...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  if (module && !canAccessModule(user?.role, module)) {
    const fallbackPath = user && canAccessModule(user.role, 'dashboard') ? '/dashboard' : '/login';
    return <Navigate to={fallbackPath} replace />;
  }

  return (
    <MainLayout>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 size={18} className="animate-spin text-primary" />
          </div>
        }
      >
        {children}
      </Suspense>
    </MainLayout>
  );
};

const RootRedirect = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  if (isPortalSubdomain()) {
    return <NotFound />;
  }

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <Loader2 size={16} className="animate-spin text-primary" />
          Carregando painel...
        </div>
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <AppBootstrap />
        <BrowserRouter basename={getRouterBasename()}>
          <RouteTitleManager />
          <Routes>
            <Route path="/login" element={isPortalSubdomain() ? <NotFound /> : <LoginPage />} />
            <Route path="/portal/:slug" element={<PortalPage />} />
            <Route path="/portal/aprovacao/:slug" element={<PublicApprovalPage />} />
            <Route path="/cliente/aprovacao/:slug" element={<PublicApprovalPage />} />
            <Route path="/:slug" element={isPortalSubdomain() ? <PortalPage /> : <NotFound />} />
            <Route path="/aprovacao/:slug" element={isPortalSubdomain() ? <PublicApprovalPage /> : <NotFound />} />
            <Route path="/" element={<RootRedirect />} />
            <Route path="/dashboard" element={<ProtectedRoute module="dashboard"><DashboardPage /></ProtectedRoute>} />
            <Route path="/boards" element={<ProtectedRoute module="boards"><BoardsPage /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute module="clients"><ClientsPage /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute module="client_hub"><ClientHubPage /></ProtectedRoute>} />
            <Route path="/posting-calendar" element={<ProtectedRoute module="posting_calendar"><PostingCalendarHomePage /></ProtectedRoute>} />
            <Route path="/posting-calendar/template" element={<ProtectedRoute module="posting_calendar"><PostingCalendarTemplatePage /></ProtectedRoute>} />
            <Route path="/hub" element={<ProtectedRoute module="posting_calendar"><HubPage /></ProtectedRoute>} />
            <Route path="/approvals" element={<Navigate to="/hub?tab=approvals" replace />} />
            <Route path="/content-approvals" element={<Navigate to="/hub?tab=approvals" replace />} />
            <Route path="/logs" element={<ProtectedRoute module="logs"><LogsPage /></ProtectedRoute>} />
            <Route path="/intake" element={<Navigate to="/hub?tab=requests" replace />} />
            <Route path="/portal/solicitar" element={<ProtectedRoute module="intake"><IntakePage /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute module="clients"><OnboardingPage /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute module="team"><TeamPage /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute module="finance"><FinancePage /></ProtectedRoute>} />
            <Route path="/drive" element={<ProtectedRoute module="drive"><DrivePage /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute module="documents"><DocumentsPage /></ProtectedRoute>} />
            <Route path="/documents/:id/edit" element={<ProtectedRoute module="documents"><DocumentEditorPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute module="settings"><SettingsPage /></ProtectedRoute>} />
            <Route path="/whatsapp" element={<ProtectedRoute module="whatsapp"><WhatsAppPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
