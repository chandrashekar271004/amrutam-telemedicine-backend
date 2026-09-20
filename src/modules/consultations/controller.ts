import { RequestHandler } from 'express';
import * as s from './service.js';

type IdempotentRequest = Parameters<RequestHandler>[0] & {
  saveIdempotency?: (
    status: number,
    body: unknown,
  ) => Promise<void>;
};

export const book: RequestHandler = async (req, res, next) => {
  try {
    const d = await s.book(
      req.user!.id,
      req.body.slotId,
      req.body.reason,
    );

    const idempotentReq = req as IdempotentRequest;

    await idempotentReq.saveIdempotency?.(
      201,
      { data: d },
    );

    res.status(201).json({ data: d });
  } catch (error) {
    next(error);
  }
};

export const status: RequestHandler = async (req, res, next) => {
  try {
    const d = await s.updateStatus(
      req.user!,
      String(req.params.id),
      req.body.status,
      req.body.notes,
    );

    const idempotentReq = req as IdempotentRequest;

    await idempotentReq.saveIdempotency?.(
      200,
      { data: d },
    );

    res.json({ data: d });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    const statusValue = req.query.status;

    const status =
      typeof statusValue === 'string'
        ? statusValue as
            | 'SCHEDULED'
            | 'IN_PROGRESS'
            | 'COMPLETED'
            | 'CANCELLED'
        : undefined;

    res.json({
      data: await s.list(req.user!, {
        page,
        limit,
        status,
      }),
    });
  } catch (error) {
    next(error);
  }
};
