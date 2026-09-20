import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';
beforeAll(async()=>{await prisma.$connect(); await redis.connect();});
afterAll(async()=>{await redis.quit(); await prisma.$disconnect();});
