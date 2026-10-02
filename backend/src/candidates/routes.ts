import { Router } from 'express';
import { validateCandidate, type CandidateSource } from '@curriculos/shared';
import { AppError } from '../errors.js';
import type { CandidateRepository } from './repository.js';

const SOURCES: CandidateSource[] = ['manual', 'pdf'];
const EMAIL_TAKEN = 'Já existe um candidato cadastrado com este e-mail.';

/** Erro 2627/2601 do SQL Server: violação de índice único. */
const isUniqueViolation = (err: unknown) =>
  typeof err === 'object' && err !== null && [2627, 2601].includes((err as { number?: number }).number ?? 0);

export function candidatesRouter(repository: CandidateRepository): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    res.json(await repository.list(search || undefined));
  });

  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(400, 'Identificador de candidato inválido.', 'INVALID_ID');
    }
    const candidate = await repository.findById(id);
    if (!candidate) throw new AppError(404, 'Candidato não encontrado.', 'NOT_FOUND');
    res.json(candidate);
  });

  router.post('/', async (req, res) => {
    const validation = validateCandidate(req.body ?? {});
    if (!validation.success) {
      throw new AppError(400, 'Verifique os campos destacados.', 'VALIDATION_ERROR', validation.errors);
    }

    const source: CandidateSource = SOURCES.includes(req.body.source) ? req.body.source : 'manual';

    if (await repository.existsByEmail(validation.data.email)) {
      throw new AppError(409, EMAIL_TAKEN, 'EMAIL_TAKEN', { email: EMAIL_TAKEN });
    }

    try {
      const candidate = await repository.create(validation.data, source);
      res.status(201).location(`/api/candidates/${candidate.id}`).json(candidate);
    } catch (err) {
      // Duas gravações simultâneas com o mesmo e-mail: o índice único do banco decide.
      if (isUniqueViolation(err)) throw new AppError(409, EMAIL_TAKEN, 'EMAIL_TAKEN', { email: EMAIL_TAKEN });
      throw err;
    }
  });

  return router;
}
