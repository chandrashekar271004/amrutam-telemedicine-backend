import { Router } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth';
import { requireIdempotencyKey } from '../../middleware/idempotency';
import { validate } from '../../middleware/validate';
import * as controller from './controller';
import { createBookingSchema } from './schema';

const router = Router();

router.post(
  '/',
  requireAuth,
  requireRole(Role.PATIENT),
  requireIdempotencyKey,
  validate(createBookingSchema),
  controller.create,
);

router.get(
  '/:id',
  requireAuth,
  requireRole(Role.PATIENT),
  controller.getById,
);

export default router;