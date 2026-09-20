import { Router } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { requireIdempotencyKey } from '../../middleware/idempotency.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { createBookingSchema } from './schema.js';

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
