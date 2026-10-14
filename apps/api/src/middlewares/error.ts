import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError, z } from 'zod';
import { logger } from '../config/logger.js';
import { HttpError } from '../utils/http.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'route_not_found', message: 'Rota não encontrada' } });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json({ error: { code: 'validation_error', message: 'Dados inválidos', details: z.flattenError(err) } });
    return;
  }
  if (err instanceof HttpError) {
    if (err.status >= 500) logger.error({ err, path: req.path }, err.message);
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid_json', message: 'JSON inválido' } });
    return;
  }
  if (err?.name === 'MulterError') {
    res.status(422).json({ error: { code: 'upload_error', message: 'Arquivo inválido ou acima de 20 MB' } });
    return;
  }
  logger.error({ err, path: req.path }, 'Erro não tratado');
  res.status(500).json({ error: { code: 'internal_error', message: 'Erro interno. Tente novamente.' } });
};
