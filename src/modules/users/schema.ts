import { z } from 'zod';
export const updateProfileSchema = z.object({ body: z.object({ firstName: z.string().min(1).max(80).optional(), lastName: z.string().min(1).max(80).optional(), phone: z.string().min(8).max(20).nullable().optional() }), params: z.object({}), query: z.object({}) });
