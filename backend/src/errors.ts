import type { ErrorRequestHandler } from 'express';
import type { FieldErrors } from '@curriculos/shared';

/** Erro de negócio com status HTTP e mensagem já pensada para o usuário. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ code: err.code, message: err.message, fieldErrors: err.fieldErrors });
    return;
  }

  // JSON malformado no corpo da requisição.
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ code: 'INVALID_JSON', message: 'Corpo da requisição inválido.' });
    return;
  }

  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Erro inesperado no servidor. Tente novamente.' });
};
