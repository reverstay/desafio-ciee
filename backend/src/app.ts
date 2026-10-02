import express from 'express';
import cors from 'cors';
import { candidatesRouter } from './candidates/routes.js';
import type { CandidateRepository } from './candidates/repository.js';
import { resumesRouter, type PdfTextExtractor } from './resumes/routes.js';
import { AppError, errorHandler } from './errors.js';

export type AppDependencies = {
  candidates: CandidateRepository;
  extractPdfText: PdfTextExtractor;
  /** Verifica se o banco responde; usado pelo /api/health. */
  checkDatabase?: () => Promise<void>;
  corsOrigin?: string;
};

/** Monta a aplicação recebendo as dependências, o que permite testá-la sem banco. */
export function createApp(deps: AppDependencies) {
  const app = express();

  app.use(cors({ origin: deps.corsOrigin ?? 'http://localhost:5173' }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await deps.checkDatabase?.();
      res.json({ status: 'ok', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  app.use('/api/candidates', candidatesRouter(deps.candidates));
  app.use('/api/resumes', resumesRouter(deps.extractPdfText));

  app.use('/api', (_req, _res, next) => next(new AppError(404, 'Rota não encontrada.', 'NOT_FOUND')));
  app.use(errorHandler);

  return app;
}
