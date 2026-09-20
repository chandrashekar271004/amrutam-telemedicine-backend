import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

type SearchQuery = {
  page: number;
  limit: number;
  specialty?: string;
  fromFee?: number;
  toFee?: number;
  q?: string;
};

export async function search(query: SearchQuery) {
  const {
    page,
    limit,
    specialty,
    fromFee,
    toFee,
    q,
  } = query;

  const where = {
    isVerified: true,

    ...(specialty
      ? {
          specialty: {
            contains: specialty,
            mode: 'insensitive' as const,
          },
        }
      : {}),

    ...(fromFee !== undefined || toFee !== undefined
      ? {
          consultationFee: {
            ...(fromFee !== undefined
              ? { gte: fromFee }
              : {}),
            ...(toFee !== undefined
              ? { lte: toFee }
              : {}),
          },
        }
      : {}),

    ...(q
      ? {
          OR: [
            {
              specialty: {
                contains: q,
                mode: 'insensitive' as const,
              },
            },
            {
              bio: {
                contains: q,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {}),
  };

  const cacheKey =
    'doctor-search:' +
    crypto
      .createHash('sha1')
      .update(
        JSON.stringify({
          where,
          page,
          limit,
        }),
      )
      .digest('hex');

  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const [items, total] = await prisma.$transaction([
    prisma.doctor.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        experienceYears: 'desc',
      },
      select: {
        id: true,
        specialty: true,
        bio: true,
        consultationFee: true,
        experienceYears: true,
        isVerified: true,
      },
    }),

    prisma.doctor.count({
      where,
    }),
  ]);

  const result = {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };

  await redis.set(
    cacheKey,
    JSON.stringify(result),
    { EX: 60 },
  );

  return result;
}
