import { RequestHandler } from 'express';
import * as s from './service';

export const create: RequestHandler = async (req, res) =>
  res.status(201).json({
    data: await s.create(
      String(req.params.doctorId),
      req.user!.id,
      req.body.startsAt,
      req.body.endsAt,
    ),
  });

export const list: RequestHandler = async (req, res) =>
  res.json({
    data: await s.list(
      String(req.params.doctorId),
      req.query.from as string,
      req.query.to as string,
    ),
  });