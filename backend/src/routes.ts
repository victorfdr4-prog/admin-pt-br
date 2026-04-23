import { Router } from 'express';
import { getDashboardMonitoring, getDashboardSummary } from './modules/dashboard/dashboard.controller';
import { getBoardBundle, getBoardTask, listBoards } from './modules/boards/boards.controller';
import { getFinanceOverview } from './modules/finance/finance.controller';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'cromia-bff',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/dashboard/summary', getDashboardSummary);
apiRouter.get('/dashboard/monitoring', getDashboardMonitoring);

apiRouter.get('/boards', listBoards);
apiRouter.get('/boards/:boardId/bundle', getBoardBundle);
apiRouter.get('/boards/tasks/:taskId', getBoardTask);

apiRouter.get('/finance/overview', getFinanceOverview);
