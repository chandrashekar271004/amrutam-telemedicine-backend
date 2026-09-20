import { RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from './error.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      role: Role;
    };

    requestId?: string;

    saveIdempotency?: (
      status: number,
      body: unknown,
    ) => Promise<void>;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');

  if (!header?.startsWith('Bearer ')) {
    return next(
      new AppError(
        401,
        'Authentication required',
        'UNAUTHENTICATED',
      ),
    );
  }

  try {
    const c = verifyAccessToken(header.slice(7));

    req.user = {
      id: c.sub,
      role: c.role,
    };

    next();
  } catch {
    next(
      new AppError(
        401,
        'Invalid or expired token',
        'INVALID_TOKEN',
      ),
    );
  }
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(403, 'Forbidden', 'FORBIDDEN'),
      );
    }

    next();
  };
