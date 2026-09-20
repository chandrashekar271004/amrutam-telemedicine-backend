import { RequestHandler } from 'express';
import * as s from './service.js';

export const create: RequestHandler = async (req, res, next) => {
  try {
    const prescription = await s.create(
      req.user!.id,
      String(req.params.consultationId),
      req.body.medicines,
      req.body.instructions,
    );

    res.status(201).json({ data: prescription });
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    const prescription = await s.get(
      req.user!.id,
      req.user!.role,
      String(req.params.id),
    );

    res.json({ data: prescription });
  } catch (error) {
    next(error);
  }
};
