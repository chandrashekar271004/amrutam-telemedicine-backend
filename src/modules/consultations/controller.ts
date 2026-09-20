import { RequestHandler } from 'express';
import * as s from './service';

export const book: RequestHandler = async (req, res) => {
  const d = await s.book(
    req.user!.id,
    req.body.slotId,
    req.body.reason,
  );

  await (req as any).saveIdempotency?.(201, { data: d });

  res.status(201).json({ data: d });
};

export const status: RequestHandler = async (req, res) => {
  const d = await s.updateStatus(
    req.user!,
    String(req.params.id),
    req.body.status,
    req.body.notes,
  );

  await (req as any).saveIdempotency?.(200, { data: d });

  res.json({ data: d });
};

export const list: RequestHandler = async (req, res) =>
  res.json({
    data: await s.list(req.user!, req.query),
  });