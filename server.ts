import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handleAuthRequest,
  handleChatRequest,
  handleEvaluateMovieRequest,
  handleHealthRequest,
  handleMovieByIdRequest,
  handleMoviesRequest,
  handleUserActivityRequest,
} from './api/_lib/handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '2mb' }));

  // Rotas da API compartilhadas com as Serverless Functions da Vercel
  app.get('/api/health', async (req: Request, res: Response) => {
    await handleHealthRequest(req, res);
  });

  app.all('/api/auth/:action', async (req: Request, res: Response) => {
    await handleAuthRequest(req, res);
  });

  app.post('/api/user/activity', async (req: Request, res: Response) => {
    await handleUserActivityRequest(req, res);
  });

  app.get('/api/movies', async (req: Request, res: Response) => {
    await handleMoviesRequest(req, res);
  });

  app.post('/api/movies', async (req: Request, res: Response) => {
    await handleMoviesRequest(req, res);
  });

  app.patch('/api/movies/:id', async (req: Request, res: Response) => {
    await handleMovieByIdRequest(req, res);
  });

  app.delete('/api/movies/:id', async (req: Request, res: Response) => {
    await handleMovieByIdRequest(req, res);
  });

  app.post('/api/movies/:id/evaluate', async (req: Request, res: Response) => {
    await handleEvaluateMovieRequest(req, res);
  });

  app.get('/api/chat', async (req: Request, res: Response) => {
    await handleChatRequest(req, res);
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    await handleChatRequest(req, res);
  });

  app.patch('/api/chat', async (req: Request, res: Response) => {
    await handleChatRequest(req, res);
  });

  app.delete('/api/chat', async (req: Request, res: Response) => {
    await handleChatRequest(req, res);
  });

  // Integração com Vite no dev ou arquivos estáticos em produção
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CineRoda rodando na porta ${PORT}`);
  });
}

startServer();
