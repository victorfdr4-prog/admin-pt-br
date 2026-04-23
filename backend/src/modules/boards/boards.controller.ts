import type { Request, Response } from 'express';
import { apiCache, createScopedCacheKey } from '../../lib/cache';
import { createSupabaseClient, extractAccessToken } from '../../lib/supabaseClient';
import { BoardsRepository } from './boards.repository';
import { BoardsService } from './boards.service';

const LIST_TTL_MS = 30_000;
const BUNDLE_TTL_MS = 20_000;
const TASK_TTL_MS = 15_000;

function buildService(req: Request) {
  const accessToken = extractAccessToken(req.header('authorization'));
  const supabase = createSupabaseClient(accessToken);
  return {
    accessToken,
    service: new BoardsService(new BoardsRepository(supabase)),
  };
}

export async function listBoards(req: Request, res: Response) {
  try {
    const { accessToken, service } = buildService(req);
    const includeArchived = req.query.includeArchived === 'true';
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
    const cacheKey = createScopedCacheKey('boards-list', accessToken, includeArchived, clientId);
    const payload = await apiCache.remember(cacheKey, LIST_TTL_MS, () => service.listBoards({ includeArchived, clientId }));
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      message: 'Falha ao carregar quadros.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

export async function getBoardBundle(req: Request, res: Response) {
  try {
    const { accessToken, service } = buildService(req);
    const boardId = req.params.boardId;
    const cacheKey = createScopedCacheKey('boards-bundle', accessToken, boardId);
    const payload = await apiCache.remember(cacheKey, BUNDLE_TTL_MS, () => service.getBoardBundle(boardId));
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      message: 'Falha ao carregar dados do board.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

export async function getBoardTask(req: Request, res: Response) {
  try {
    const { accessToken, service } = buildService(req);
    const taskId = req.params.taskId;
    const cacheKey = createScopedCacheKey('board-task', accessToken, taskId);
    const payload = await apiCache.remember(cacheKey, TASK_TTL_MS, () => service.getTask(taskId));
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      message: 'Falha ao carregar tarefa.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
