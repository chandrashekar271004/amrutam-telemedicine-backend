import { randomUUID } from 'crypto';
import { RequestHandler } from 'express';
export const requestId: RequestHandler = (req, res, next) => {
  const id = req.header('x-request-id') || randomUUID();
  res.setHeader('x-request-id', id);
  (req as any).requestId = id;
  next();
};
