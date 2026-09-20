import { Request, Response, NextFunction } from 'express';
import * as service from './service.js';

export async function create(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const patientId = req.user!.id;

    const booking = await service.createBooking(
      patientId,
      req.body.slotId,
      req.body.reason,
    );

    const body = {
      data: booking,
    };

    await req.saveIdempotency?.(201, body);

    res.status(201).json(body);
  } catch (error) {
    next(error);
  }
}

export async function getById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const booking = await service.getBooking(
      req.user!.id,
      String(req.params.id),
    );

    res.json({
      data: booking,
    });
  } catch (error) {
    next(error);
  }
}
