import type { Request, Response } from 'express';
import { apiCache, createScopedCacheKey } from '../../lib/cache';
import { createSupabaseClient, extractAccessToken } from '../../lib/supabaseClient';
import { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';

const FINANCE_OVERVIEW_TTL_MS = 60_000;

function buildService(req: Request) {
  const accessToken = extractAccessToken(req.header('authorization'));
  const supabase = createSupabaseClient(accessToken);
  return {
    accessToken,
    service: new FinanceService(new FinanceRepository(supabase)),
  };
}

export async function getFinanceOverview(req: Request, res: Response) {
  try {
    const { accessToken, service } = buildService(req);
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
    const cacheKey = createScopedCacheKey('finance-overview', accessToken, clientId);
    const payload = await apiCache.remember(cacheKey, FINANCE_OVERVIEW_TTL_MS, () => service.getOverview(clientId));
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      message: 'Falha ao carregar o financeiro.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
