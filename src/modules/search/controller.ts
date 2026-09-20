import { RequestHandler } from 'express';
import * as s from './service.js';

export const search: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    const specialty =
      typeof req.query.specialty === 'string'
        ? req.query.specialty
        : undefined;

    const fromFee =
      typeof req.query.fromFee === 'string'
        ? Number(req.query.fromFee)
        : undefined;

    const toFee =
      typeof req.query.toFee === 'string'
        ? Number(req.query.toFee)
        : undefined;

    const q =
      typeof req.query.q === 'string'
        ? req.query.q
        : undefined;

    const result = await s.search({
      page,
      limit,
      specialty,
      fromFee,
      toFee,
      q,
    });

    res.json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
