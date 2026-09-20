import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code = 'APP_ERROR') { super(message); }
}
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.flatten() } });
  const status = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
  if (status >= 500) logger.error({ err, requestId: (req as any).requestId }, 'Unhandled error');
  return res.status(status).json({ error: { code, message: status >= 500 ? 'Internal server error' : err.message, requestId: (req as any).requestId } });
};
