import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
export const apiRateLimit = rateLimit({ windowMs: env.RATE_LIMIT_WINDOW_MS, limit: env.RATE_LIMIT_MAX, standardHeaders: 'draft-8', legacyHeaders: false });
export const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
