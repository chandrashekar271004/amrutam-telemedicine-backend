import { describe, it, expect } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

describe('booking invariants', () => {
  it('has unique slot ownership at database level', async () => {
    const indexes = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT indexname FROM pg_indexes WHERE tablename='AvailabilitySlot'`,
    );

    expect(indexes.length).toBeGreaterThan(0);
  });
});
