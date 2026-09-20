import { z } from 'zod';

export const createBookingSchema = z.object({
  body: z.object({
    slotId: z.string().uuid(),
    reason: z.string().trim().max(1000).optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});