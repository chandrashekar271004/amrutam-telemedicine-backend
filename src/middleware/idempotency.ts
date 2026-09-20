import { RequestHandler } from 'express';
import crypto from 'crypto';
import { redis } from '../lib/redis.js';
import { AppError } from './error.js';

export const requireIdempotencyKey: RequestHandler = async (
  req,
  res,
  next,
) => {
  const key = req.header('Idempotency-Key');

  if (!key) {
    return next(
      new AppError(
        400,
        'Idempotency-Key header is required',
        'IDEMPOTENCY_KEY_REQUIRED',
      ),
    );
  }

  if (key.length > 128) {
    return next(
      new AppError(
        400,
        'Idempotency-Key is too long',
        'INVALID_IDEMPOTENCY_KEY',
      ),
    );
  }

  const userId = req.user?.id || 'anonymous';

  const fingerprint = crypto
    .createHash('sha256')
    .update(
      `${userId}:${req.method}:${req.originalUrl}:${key}`,
    )
    .digest('hex');

  const redisKey = `idem:${fingerprint}`;

  const lock = await redis.set(
    redisKey,
    JSON.stringify({ state: 'PROCESSING' }),
    {
      NX: true,
      EX: 120,
    },
  );

  if (!lock) {
    const existing = await redis.get(redisKey);

    if (existing) {
      const parsed: {
        state: 'PROCESSING' | 'DONE';
        status?: number;
        body?: unknown;
      } = JSON.parse(existing);

      if (
        parsed.state === 'DONE' &&
        parsed.status !== undefined
      ) {
        return res
          .status(parsed.status)
          .json(parsed.body);
      }

      return next(
        new AppError(
          409,
          'A request with this Idempotency-Key is already being processed',
          'IDEMPOTENCY_IN_PROGRESS',
        ),
      );
    }
  }

  req.saveIdempotency = async (
    status: number,
    body: unknown,
  ) => {
    await redis.set(
      redisKey,
      JSON.stringify({
        state: 'DONE',
        status,
        body,
      }),
      {
        EX: 86400,
      },
    );
  };

  next();
};
