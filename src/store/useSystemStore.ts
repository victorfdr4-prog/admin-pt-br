import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_BRANDING,
  DEFAULT_PLANS_CATALOG,
  DEFAULT_DASHBOARD_BLOCKS,
  DEFAULT_OPERATIONAL_RULES,
} from '@/domain/agencyPlatform';

export type RadarTone = 'blue' | 'amber' | 'red' | 'green';

export interface DiagnosticLog {
  id: string;
  source: string;
  message: string;
  details?: unknown;
  type: 'error' | 'warning' | 'info';
  timestamp: string;
}

export interface SystemAlert {
  id: string;
  text: string;
  tone: RadarTone;
  route?: string;
  createdAt?: number;
}

interface SystemState {
  theme: 'light' | 'dark';
  branding: {
    agency_name: string;
    primary_color: string;
    logo_url: string;
  };
  plans: string[];
  dashboardBlocks: typeof DEFAULT_DASHBOARD_BLOCKS;
  operationalRules: typeof DEFAULT_OPERATIONAL_RULES;
  alerts: SystemAlert[];
  logs: DiagnosticLog[];
  sidebarCollapsed: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  setBranding: (branding: Partial<SystemState['branding']>) => void;
  setPlans: (plans: string[]) => void;
  setDashboardBlocks: (blocks: typeof DEFAULT_DASHBOARD_BLOCKS) => void;
  setOperationalRules: (rules: typeof DEFAULT_OPERATIONAL_RULES) => void;
  setAppConfig: (config: {
    branding?: Partial<SystemState['branding']>;
    plans?: string[];
    dashboardBlocks?: typeof DEFAULT_DASHBOARD_BLOCKS;
    operationalRules?: typeof DEFAULT_OPERATIONAL_RULES;
  }) => void;
  dismissAlert: (id: string) => void;
  pushLog: (log: Omit<DiagnosticLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => void;
  clearLogs: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      theme: 'light',
      branding: DEFAULT_BRANDING,
      plans: DEFAULT_PLANS_CATALOG,
      dashboardBlocks: DEFAULT_DASHBOARD_BLOCKS,
      operationalRules: DEFAULT_OPERATIONAL_RULES,
      alerts: [],
      logs: [],
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      setBranding: (branding) =>
        set((state) => ({ branding: { ...state.branding, ...branding } })),
      setPlans: (plans) => set({ plans }),
      setDashboardBlocks: (dashboardBlocks) => set({ dashboardBlocks }),
      setOperationalRules: (operationalRules) => set({ operationalRules }),
      setAppConfig: (config) =>
        set((state) => ({
          branding: config.branding ? { ...state.branding, ...config.branding } : state.branding,
          plans: config.plans && config.plans.length > 0 ? config.plans : state.plans,
          dashboardBlocks: config.dashboardBlocks && config.dashboardBlocks.length > 0 ? config.dashboardBlocks : state.dashboardBlocks,
          operationalRules: config.operationalRules && config.operationalRules.length > 0 ? config.operationalRules : state.operationalRules,
        })),
      dismissAlert: (id) => set((state) => ({ alerts: state.alerts.filter((alert) => alert.id !== id) })),
      pushLog: (log) =>
        set((state) => ({
          logs: [
            {
              id: log.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              timestamp: log.timestamp || new Date().toISOString(),
              source: log.source,
              message: log.message,
              details: log.details,
              type: log.type,
            },
            ...state.logs,
          ].slice(0, 200),
        })),
      clearLogs: () => set({ logs: [] }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    { name: 'cromia-system' }
  )
);
