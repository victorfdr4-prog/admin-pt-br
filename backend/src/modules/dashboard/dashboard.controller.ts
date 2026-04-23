import type { Request, Response } from 'express';
import { createScopedCacheKey, apiCache } from '../../lib/cache';
import { createSupabaseClient, extractAccessToken } from '../../lib/supabaseClient';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

const SUMMARY_TTL_MS = 60_000;
const MONITORING_TTL_MS = 45_000;

function buildService(req: Request) {
  const accessToken = extractAccessToken(req.header('authorization'));
  const supabase = createSupabaseClient(accessToken);
  return {
    accessToken,
    service: new DashboardService(new DashboardRepository(supabase)),
  };
}

export async function getDashboardSummary(req: Request, res: Response) {
  try {
    const { accessToken, service } = buildService(req);
    const cacheKey = createScopedCacheKey('dashboard-summary', accessToken);
    const payload = await apiCache.remember(cacheKey, SUMMARY_TTL_MS, () => service.getSummary());
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      message: 'Falha ao carregar o dashboard.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

export async function getDashboardMonitoring(req: Request, res: Response) {
  try {
    const { accessToken, service } = buildService(req);
    const cacheKey = createScopedCacheKey('dashboard-monitoring', accessToken);
    const payload = await apiCache.remember(cacheKey, MONITORING_TTL_MS, () => service.getMonitoring());
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      message: 'Falha ao carregar monitoramento.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
