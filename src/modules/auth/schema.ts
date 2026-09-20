import { z } from 'zod';
export const registerSchema = z.object({ body: z.object({ email: z.string().email(), phone: z.string().min(8).max(20).optional(), password: z.string().min(12).max(128), firstName: z.string().min(1).max(80), lastName: z.string().min(1).max(80) }), params: z.object({}), query: z.object({}) });
export const loginSchema = z.object({ body: z.object({ email: z.string().email(), password: z.string().min(1), mfaCode: z.string().regex(/^\d{6}$/).optional() }), params: z.object({}), query: z.object({}) });
