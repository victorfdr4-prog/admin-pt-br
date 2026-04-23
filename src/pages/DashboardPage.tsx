import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
  Users,
  CheckSquare,
  MessageSquarePlus,
  ArrowRight,
  AlertTriangle,
  Clock,
  TrendingUp,
  Layers,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { AuthService, JokeService } from '@/services';
import { subscribeProfileUpdated, subscribeRealtimeChange } from '@/lib/realtime';
import { useSystemStore } from '@/store/useSystemStore';
import ActivityFeedList from '@/components/activity/ActivityFeedList';
import { HealthBadge, HealthDot } from '@/components/HealthBadge';
import { NextActionCard } from '@/components/NextActionCard';
import { usePendingApprovalCount } from '@/hooks/useApprovals';
import { useIntakePendingCount } from '@/hooks/useIntake';
import { useAllHealth } from '@/hooks/useClientHealth';
import { useGlobalTimeline } from '@/hooks/useTimeline';
import { useDashboardSummary } from '@/hooks/useDashboard';
import { buildFeedItemFromDashboardRecent, buildFeedItemFromTimelineEvent, groupFeedItems } from '@/lib/activity-feed';

interface DashboardSummary {
  operations: {
    clients: {
      total: number;
      active: number;
      leads: number;
      new_this_month: number;
    };
    tasks: {
      total: number;
      pending: number;
      in_progress: number;
      done: number;
      overdue: number;
    };
    onboarding: {
      total: number;
      pending: number;
      completed: number;
      in_progress_clients: number;
      completed_clients: number;
      completion_rate: number;
    };
  };
  client_health: Array<{
    id: string;
    name: string;
    status: string;
    pending_tasks: number;
    overdue_tasks: number;
    onboarding_completion: number;
    pending_onboarding: number;
    total_open_items: number;
    last_activity: string | null;
  }>;
  recent_activity: Array<{
    id: string;
    action: string;
    entity: string;
    entity_id: string | null;
    client_id: string | null;
    client_name: string | null;
    created_at: string | null;
    metadata: Record<string, unknown> | null;
  }>;
}

interface LoginJoke {
  id: string;
  text: string;
  active: boolean;
  created_at: string | null;
}

const formatRelative = (value: string | null) => {
  if (!value) return 'sem atividade';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'sem atividade';
  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))} min atrás`;
  if (diff < day) return `${Math.max(1, Math.round(diff / hour))} h atrás`;
  return `${Math.max(1, Math.round(diff / day))} dia(s) atrás`;
};

const getMinutesSince = (value: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
};

const getGreeting = (name?: string) => {
  const hour = new Date().getHours();
  const firstName = String(name || '').trim().split(' ')[0];
  const suffix = firstName ? `, ${firstName}` : '';
  if (hour < 5) return `Boa madrugada${suffix}`;
  if (hour < 12) return `Bom dia${suffix}`;
  if (hour < 18) return `Boa tarde${suffix}`;
  return `Boa noite${suffix}`;
};

const dashboardEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: dashboardEase } },
};

// ─────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────
interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  accent: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';
  href?: string;
  onClick?: () => void;
  highlight?: boolean;
}

const ACCENT_MAP: Record<KpiCardProps['accent'], {
  bg: string; iconBg: string; iconColor: string; value: string; bar: string; badge?: string;
}> = {
  blue:    { bg: '',             iconBg: 'bg-lime-50',    iconColor: 'text-lime-600',   value: 'text-lime-700',   bar: 'bg-lime-500' },
  emerald: { bg: '',             iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',value: 'text-emerald-700',bar: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-50/60',iconBg: 'bg-amber-100', iconColor: 'text-amber-600',  value: 'text-amber-700',  bar: 'bg-amber-500' },
  rose:    { bg: 'bg-rose-50/60', iconBg: 'bg-rose-100',  iconColor: 'text-rose-600',   value: 'text-rose-700',   bar: 'bg-rose-500' },
  purple:  { bg: '',             iconBg: 'bg-purple-50',  iconColor: 'text-purple-600', value: 'text-purple-700', bar: 'bg-purple-500' },
  slate:   { bg: '',             iconBg: 'bg-slate-100',  iconColor: 'text-slate-600',  value: 'text-slate-700',  bar: 'bg-slate-400' },
};

const KpiCard: React.FC<KpiCardProps> = ({ icon: Icon, label, value, sub, accent, href, onClick, highlight }) => {
  const style = ACCENT_MAP[accent];
  const Wrapper = href ? Link : 'div';
  const wrapperProps = href ? { to: href } : {};

  return (
    <Wrapper
      {...(wrapperProps as any)}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all duration-200',
        (href || onClick) && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]',
        highlight && style.bg,
      )}
    >
      {/* Accent bar */}
      <div className={cn('absolute left-0 top-0 h-full w-[3px]', style.bar)} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-white to-slate-50/70 opacity-90" />

      <div className="relative flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{label}</p>
          <p className={cn('mt-1.5 text-[1.9rem] font-bold leading-none tracking-tight', style.value)}>
            {value}
          </p>
          {sub && <p className="mt-1.5 text-[12px] text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', style.iconBg)}>
          <Icon size={17} className={style.iconColor} />
        </div>
      </div>

      {(href || onClick) && (
        <div className="absolute right-3 bottom-3 opacity-0 transition-opacity group-hover:opacity-100">
          <ChevronRight size={13} className="text-muted-foreground" />
        </div>
      )}
    </Wrapper>
  );
};

// ─────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({ children, action }) => (
  <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
    <p className="text-[12px] font-semibold tracking-[0.01em] text-slate-600">{children}</p>
    {action}
  </div>
);

// ─────────────────────────────────────────────────────────
// FocusItem
// ─────────────────────────────────────────────────────────
const FocusItem: React.FC<{
  title: string;
  detail: string;
  tone: 'critical' | 'attention' | 'calm';
  onClick: () => void;
  first?: boolean;
}> = ({ title, detail, tone, onClick, first }) => {
  const toneConfig = {
    critical:  { border: 'border-rose-300/70',   bg: 'bg-rose-50',   badge: 'border-rose-200 text-rose-600',   dot: 'bg-rose-500',   label: 'Urgente' },
    attention: { border: 'border-amber-300/70',  bg: 'bg-amber-50',  badge: 'border-amber-200 text-amber-700', dot: 'bg-amber-500',  label: 'Atenção' },
    calm:      { border: 'border-emerald-200/70',bg: 'bg-white',     badge: 'border-emerald-200 text-emerald-700', dot: 'bg-emerald-500', label: 'Normal' },
  };
  const cfg = toneConfig[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'interactive-list-clickable w-full rounded-xl border px-3.5 py-2.5 text-left transition',
        first
          ? `${cfg.border} ${cfg.bg} shadow-[0_4px_16px_rgba(15,23,42,0.06)]`
          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-foreground leading-tight">{title}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{detail}</p>
        </div>
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium', cfg.badge)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
          {cfg.label}
        </span>
      </div>
    </button>
  );
};

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────
export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const dashboardBlocks = useSystemStore((state) => state.dashboardBlocks);
  const operationalRules = useSystemStore((state) => state.operationalRules);
  const [viewerName, setViewerName] = useState('');
  const [headlineJoke, setHeadlineJoke] = useState('');
  const [jokes, setJokes] = useState<LoginJoke[]>([]);
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();

  const { data: pendingApprovals = 0 } = usePendingApprovalCount();
  const { data: pendingIntake = 0 } = useIntakePendingCount();
  const { data: allHealth = [] } = useAllHealth();
  const { data: globalTimeline = [] } = useGlobalTimeline({ limit: 8 });

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      AuthService.getMe().catch(() => null),
      JokeService.getAll().catch(() => [] as LoginJoke[]),
    ]).then(([me, fetchedJokes]) => {
      if (cancelled) return;

      const activeJokes = (fetchedJokes || []).filter((item) => item.active && item.text.trim());
      const jokeIndex = activeJokes.length ? new Date().getDate() % activeJokes.length : -1;

      setViewerName(String(me?.profile?.full_name || me?.full_name || me?.username || ''));
      setJokes((fetchedJokes || []) as LoginJoke[]);
      setHeadlineJoke(jokeIndex >= 0 ? activeJokes[jokeIndex].text : '');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribeProfile = subscribeProfileUpdated((detail) => {
      const name = String(detail.full_name || detail.username || '').trim();
      if (name) setViewerName(name);
    });

    const unsubscribeJokes = subscribeRealtimeChange((detail) => {
      if (detail.schema !== 'public' || detail.table !== 'login_jokes') return;
      const row = detail.eventType === 'DELETE' ? detail.oldRow : detail.newRow;
      if (!row) return;
      const normalized = {
        id: String((row as Record<string, unknown>).id || ''),
        text: String((row as Record<string, unknown>).text || ''),
        active: (row as Record<string, unknown>).active !== false,
        created_at: (row as Record<string, unknown>).created_at
          ? String((row as Record<string, unknown>).created_at)
          : null,
      };
      setJokes((current) => {
        if (detail.eventType === 'DELETE') return current.filter((item) => item.id !== normalized.id);
        const exists = current.some((item) => item.id === normalized.id);
        return exists
          ? current.map((item) => (item.id === normalized.id ? normalized : item))
          : [normalized, ...current];
      });
    });

    return () => {
      unsubscribeProfile();
      unsubscribeJokes();
    };
  }, []);

  useEffect(() => {
    const activeJokes = jokes.filter((item) => item.active && item.text.trim());
    const jokeIndex = activeJokes.length ? new Date().getDate() % activeJokes.length : -1;
    setHeadlineJoke(jokeIndex >= 0 ? activeJokes[jokeIndex].text : '');
  }, [jokes]);

  const operations = summary?.operations;
  const overdueTasks = operations?.tasks.overdue || 0;
  const inProgressTasks = operations?.tasks.in_progress || 0;
  const doneTasks = operations?.tasks.done || 0;

  const operationalRuleMap = useMemo(
    () => new Map(operationalRules.map((rule) => [rule.key, rule])),
    [operationalRules]
  );
  const getRuleThreshold = (key: string, fallback: number) => {
    const rule = operationalRuleMap.get(key);
    const threshold = Number(rule?.threshold);
    return Number.isFinite(threshold) ? threshold : fallback;
  };
  const overdueFocusThreshold = getRuleThreshold('overdue_focus', 1);
  const clientHealthAttentionThreshold = getRuleThreshold('client_health_attention', 40);
  const idleActivityThreshold = getRuleThreshold('idle_activity', 60);

  const attentionItems = useMemo(() => {
    return [...(summary?.client_health || [])]
      .filter(
        (client) =>
          client.overdue_tasks > 0 ||
          client.total_open_items > 0 ||
          client.onboarding_completion < clientHealthAttentionThreshold ||
          getMinutesSince(client.last_activity) >= idleActivityThreshold
      )
      .sort((left, right) => {
        const scoreLeft =
          left.overdue_tasks * 4 + left.total_open_items * 2 +
          Math.max(0, clientHealthAttentionThreshold - left.onboarding_completion) +
          Math.max(0, getMinutesSince(left.last_activity) - idleActivityThreshold) / 10;
        const scoreRight =
          right.overdue_tasks * 4 + right.total_open_items * 2 +
          Math.max(0, clientHealthAttentionThreshold - right.onboarding_completion) +
          Math.max(0, getMinutesSince(right.last_activity) - idleActivityThreshold) / 10;
        return scoreRight - scoreLeft;
      })
      .slice(0, 4);
  }, [clientHealthAttentionThreshold, idleActivityThreshold, summary]);

  const focusItems = useMemo(() => {
    const items: Array<{ id: string; title: string; detail: string; tone: 'critical' | 'attention' | 'calm' }> = [];
    const orderedClients = [...(summary?.client_health || [])].sort((left, right) => {
      const l = left.overdue_tasks * 4 + left.pending_onboarding * 2 + left.total_open_items;
      const r = right.overdue_tasks * 4 + right.pending_onboarding * 2 + right.total_open_items;
      return r - l;
    });
    const topClient = orderedClients[0] || null;

    if (topClient?.overdue_tasks >= overdueFocusThreshold) {
      items.push({
        id: `overdue-${topClient.id}`,
        title: `Resolver tarefa atrasada de ${topClient.name}`,
        detail: `${topClient.overdue_tasks} tarefa${topClient.overdue_tasks > 1 ? 's' : ''} atrasada${topClient.overdue_tasks > 1 ? 's' : ''} • ${formatRelative(topClient.last_activity)}`,
        tone: 'critical',
      });
    }

    if (topClient?.pending_onboarding || (topClient && topClient.onboarding_completion < clientHealthAttentionThreshold)) {
      items.push({
        id: `onboarding-${topClient.id}`,
        title: `Avançar onboarding de ${topClient.name}`,
        detail: topClient.pending_onboarding
          ? `${topClient.pending_onboarding} etapa${topClient.pending_onboarding > 1 ? 's' : ''} pendente${topClient.pending_onboarding > 1 ? 's' : ''}`
          : `Saúde operacional em ${topClient.onboarding_completion}%`,
        tone: 'attention',
      });
    }

    if (summary?.operations.clients.leads) {
      items.push({
        id: 'leads',
        title: 'Revisar leads ativos',
        detail: `${summary.operations.clients.leads} lead${summary.operations.clients.leads > 1 ? 's' : ''} ativo${summary.operations.clients.leads > 1 ? 's' : ''}`,
        tone: 'calm',
      });
    }

    if (!items.length) {
      items.push({
        id: 'calm',
        title: 'Manter o fluxo estável',
        detail: `${summary?.operations.clients.active || 0} clientes ativos sem urgências`,
        tone: 'calm',
      });
    }

    return items.slice(0, 3);
  }, [clientHealthAttentionThreshold, overdueFocusThreshold, summary]);

  const systemPulse = useMemo(() => {
    const idleClient = (summary?.client_health || []).find(
      (client) => getMinutesSince(client.last_activity) >= idleActivityThreshold
    );

    if (overdueTasks >= overdueFocusThreshold * 2) {
      return { tone: 'critical' as const, label: 'Crítico', detail: `${overdueTasks} tarefa${overdueTasks > 1 ? 's' : ''} atrasada${overdueTasks > 1 ? 's' : ''} e ${summary?.operations.onboarding.pending || 0} etapas pendentes.` };
    }
    if (overdueTasks >= overdueFocusThreshold || (summary?.operations.onboarding.pending || 0) > 0 || idleClient) {
      return { tone: 'attention' as const, label: 'Atenção', detail: idleClient ? `${idleClient.name} está sem atualização há ${formatRelative(idleClient.last_activity)}.` : 'Há pontos para revisão, mas o fluxo está controlado.' };
    }
    return { tone: 'calm' as const, label: 'Saudável', detail: 'Sem atrasos relevantes. O sistema está fluindo bem.' };
  }, [idleActivityThreshold, overdueFocusThreshold, overdueTasks, summary]);

  const recentActivity = summary?.recent_activity || [];
  const greeting = useMemo(() => getGreeting(viewerName), [viewerName]);
  const dashboardFeedGroups = useMemo(() => {
    if (globalTimeline.length > 0) {
      return groupFeedItems(globalTimeline.map(buildFeedItemFromTimelineEvent)).slice(0, 6);
    }
    return groupFeedItems(recentActivity.map(buildFeedItemFromDashboardRecent)).slice(0, 6);
  }, [globalTimeline, recentActivity]);

  if (summaryLoading || !summary) {
    return (
      <div className="mx-auto flex h-full w-full max-w-[1560px] flex-col gap-6 p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="relative mx-auto flex h-full w-full max-w-[1560px] flex-col gap-7 p-6"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(154,202,82,0.1),_transparent_46%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_36%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(154,202,82,0.18),_transparent_46%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_36%)]" />

      <motion.section variants={fadeUp} className="grid gap-6 xl:grid-cols-[minmax(0,1.24fr)_380px]">
        <div className="rounded-[32px] border border-slate-200/80 bg-white/95 px-6 py-6 shadow-[0_12px_40px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_10px_30px_rgba(2,6,23,0.45)]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <Activity size={14} className="text-lime-600" />
                  Painel executivo
                </div>
                <h1 className="mt-4 text-[2rem] font-bold leading-tight tracking-[-0.05em] text-foreground dark:text-slate-100">
                  {greeting}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground dark:text-slate-400">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {headlineJoke ? (
                  <p className="mt-4 max-w-[780px] rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                    {headlineJoke}
                  </p>
                ) : null}
              </div>

              <div
                className={cn(
                  'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm',
                  systemPulse.tone === 'critical'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : systemPulse.tone === 'attention'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    systemPulse.tone === 'critical'
                      ? 'bg-rose-500 animate-pulse'
                      : systemPulse.tone === 'attention'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  )}
                />
                Sistema {systemPulse.label}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/85 px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Clientes ativos</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{operations?.clients.active || 0}</div>
                <div className="mt-1 text-sm text-slate-600">{operations?.clients.new_this_month ? `+${operations.clients.new_this_month} este mês` : `${operations?.clients.total || 0} no total`}</div>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/85 px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Operação em andamento</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{inProgressTasks}</div>
                <div className="mt-1 text-sm text-slate-600">{doneTasks} concluídas na fila atual</div>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/85 px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Fila decisiva</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{pendingApprovals + pendingIntake}</div>
                <div className="mt-1 text-sm text-slate-600">Aprovações e solicitações aguardando ação</div>
              </div>
            </div>
          </div>
        </div>

        <aside className="grid gap-4">
          <div
            className={cn(
              'rounded-[28px] border p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]',
              systemPulse.tone === 'critical'
                ? 'border-rose-200 bg-rose-50/70'
                : systemPulse.tone === 'attention'
                  ? 'border-amber-200 bg-amber-50/70'
                  : 'border-emerald-200 bg-emerald-50/70'
            )}
          >
            <div className="flex items-center gap-2">
              <TrendingUp
                size={15}
                className={
                  systemPulse.tone === 'critical'
                    ? 'text-rose-600'
                    : systemPulse.tone === 'attention'
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                }
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Pulso do sistema</p>
            </div>
            <p className="mt-4 text-lg font-semibold tracking-[-0.03em] text-foreground">{systemPulse.label}</p>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{systemPulse.detail}</p>
          </div>

          {(pendingApprovals > 0 || pendingIntake > 0 || overdueTasks > 0) && (
            <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Ações imediatas</p>
              <div className="mt-4 flex flex-col gap-2.5">
                {overdueTasks > 0 && (
                  <Link
                    to="/boards"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700 transition-colors hover:bg-rose-100"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle size={14} />
                      {overdueTasks} tarefa{overdueTasks > 1 ? 's' : ''} atrasada{overdueTasks > 1 ? 's' : ''}
                    </span>
                    <ArrowRight size={13} />
                  </Link>
                )}
                {pendingApprovals > 0 && (
                  <Link
                    to="/hub?tab=approvals"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800 transition-colors hover:bg-amber-100"
                  >
                    <span className="flex items-center gap-2">
                      <CheckSquare size={14} />
                      {pendingApprovals} aprovação{pendingApprovals > 1 ? 'ões' : ''} aguardando
                    </span>
                    <ArrowRight size={13} />
                  </Link>
                )}
                {pendingIntake > 0 && (
                  <Link
                    to="/hub?tab=requests"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-[13px] font-medium text-lime-800 transition-colors hover:bg-lime-100"
                  >
                    <span className="flex items-center gap-2">
                      <MessageSquarePlus size={14} />
                      {pendingIntake} solicitação{pendingIntake > 1 ? 'ões' : ''} nova{pendingIntake > 1 ? 's' : ''}
                    </span>
                    <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            </div>
          )}
        </aside>
      </motion.section>

      <motion.section variants={fadeUp} className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Clientes ativos"
          value={operations?.clients.active || 0}
          sub={operations?.clients.new_this_month ? `+${operations.clients.new_this_month} este mês` : `${operations?.clients.total || 0} no total`}
          accent="blue"
          href="/clients"
        />
        <KpiCard
          icon={Layers}
          label="Tarefas em andamento"
          value={inProgressTasks}
          sub={`${doneTasks} concluídas`}
          accent="emerald"
          href="/boards"
        />
        <KpiCard
          icon={Clock}
          label="Tarefas atrasadas"
          value={overdueTasks}
          sub={overdueTasks > 0 ? 'Requer atenção imediata' : 'Tudo em dia'}
          accent={overdueTasks > 0 ? 'rose' : 'slate'}
          highlight={overdueTasks > 0}
          href="/boards"
        />
        <KpiCard
          icon={CheckSquare}
          label="Aprovações pendentes"
          value={pendingApprovals}
          sub={pendingIntake > 0 ? `+${pendingIntake} solicitações novas` : 'Fluxo operacional no HUB'}
          accent={pendingApprovals > 0 ? 'amber' : 'slate'}
          highlight={pendingApprovals > 0}
          href="/hub?tab=approvals"
        />
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <SectionLabel>Foco recomendado</SectionLabel>
              <div className="space-y-2">
                {focusItems.map((item, index) => (
                  <FocusItem
                    key={item.id}
                    title={item.title}
                    detail={item.detail}
                    tone={item.tone}
                    onClick={() => navigate('/boards')}
                    first={index === 0}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <SectionLabel
                action={
                  <Link to="/clients" className="flex items-center gap-1 text-[12px] text-primary hover:underline">
                    Ver clientes <ArrowRight size={12} />
                  </Link>
                }
              >
                Clientes que precisam de atenção
              </SectionLabel>
              {attentionItems.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                  {attentionItems.map((client, index) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => navigate(`/clients/${client.id}`)}
                      className={cn(
                        'interactive-list-clickable flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/30',
                        index !== attentionItems.length - 1 && 'border-b border-slate-100'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('h-2 w-2 flex-shrink-0 rounded-full', client.overdue_tasks > 0 ? 'bg-rose-500' : 'bg-amber-400')} />
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-foreground">{client.name}</p>
                          <p className="text-[12px] text-muted-foreground">
                            {client.overdue_tasks > 0
                              ? `${client.overdue_tasks} tarefa(s) atrasada(s)`
                              : `${client.total_open_items} item(ns) em aberto`}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            client.overdue_tasks > 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          )}
                        >
                          {client.overdue_tasks > 0 ? `${client.overdue_tasks} atr.` : `${client.total_open_items} abertos`}
                        </span>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatRelative(client.last_activity)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                  Nenhum cliente exige atenção imediata no momento.
                </div>
              )}
            </div>
          </div>

          {allHealth.length > 0 && (
            <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <SectionLabel
                action={
                  <Link to="/clients" className="flex items-center gap-1 text-[12px] text-primary hover:underline">
                    Ver todos <ArrowRight size={12} />
                  </Link>
                }
              >
                Saúde dos clientes
              </SectionLabel>

              <div className="flex gap-2 overflow-x-auto pb-1 minimal-scrollbar">
                {allHealth.slice(0, 12).map((h) => (
                  <Link
                    key={h.client_id}
                    to={`/clients/${h.client_id}`}
                    className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border bg-white px-3.5 py-2.5 transition-all hover:border-primary/30 hover:shadow-sm"
                  >
                    <HealthDot status={h.status} />
                    <span className="max-w-[130px] truncate text-[13px] font-medium text-foreground">
                      {(summary?.client_health || []).find((c) => c.id === h.client_id)?.name ?? 'Cliente'}
                    </span>
                    <span
                      className={cn(
                        'text-[12px] font-bold tabular-nums',
                        h.score >= 80 ? 'text-emerald-600' : h.score >= 50 ? 'text-amber-600' : 'text-rose-600'
                      )}
                    >
                      {h.score}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          {allHealth.some((h) => h.next_action) && (
            <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <SectionLabel>Próximas ações sugeridas</SectionLabel>
              <div className="space-y-2">
                {allHealth
                  .filter((h) => h.next_action)
                  .slice(0, 3)
                  .map((h) => (
                    <NextActionCard key={h.client_id} action={h.next_action!} />
                  ))}
              </div>
            </div>
          )}

          {dashboardFeedGroups.length > 0 ? (
            <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <SectionLabel>{globalTimeline.length > 0 ? 'Timeline global' : 'Atividade recente'}</SectionLabel>
              <ActivityFeedList groups={dashboardFeedGroups} compact />
            </div>
          ) : null}
        </aside>
      </motion.section>
    </motion.div>
  );
};

export default DashboardPage;
