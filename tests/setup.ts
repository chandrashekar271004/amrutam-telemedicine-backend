import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
beforeAll(async()=>{await prisma.$connect(); await redis.connect();});
afterAll(async()=>{await redis.quit(); await prisma.$disconnect();});
