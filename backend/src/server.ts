import dotenv from 'dotenv';
import express from 'express';
import { apiRouter } from './routes';

dotenv.config();

const app = express();
const port = Number(process.env.BFF_PORT || process.env.PORT || 3333);

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.header('origin') || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
});

app.use('/api', apiRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[bff] erro não tratado:', error);
  res.status(500).json({
    message: 'Erro interno no BFF.',
  });
});

app.listen(port, () => {
  console.log(`[bff] rodando em http://localhost:${port}`);
});
