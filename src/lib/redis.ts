import { createClient } from 'redis';
import { env } from '../config/env';
import { logger } from './logger';

export const redis = createClient({ url: env.REDIS_URL });
redis.on('error', (err) => logger.error({ err }, 'Redis error'));
