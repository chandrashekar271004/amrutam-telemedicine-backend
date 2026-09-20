import { RequestHandler } from 'express';
import * as s from './service.js';

export const create: RequestHandler = async (req, res, next) => {
  try {
    const doctor = await s.create(
      req.body,
      req.user!.id,
    );

    res.status(201).json({
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};

export const search: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    const specialty =
      typeof req.query.specialty === 'string'
        ? req.query.specialty
        : undefined;

    const verified =
      typeof req.query.verified === 'string'
        ? req.query.verified
        : undefined;

    const result = await s.search({
      page,
      limit,
      specialty,
      verified,
    });

    res.json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verify: RequestHandler = async (req, res, next) => {
  try {
    const doctor = await s.verify(
      String(req.params.id),
      req.user!.id,
    );

    res.json({
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};
