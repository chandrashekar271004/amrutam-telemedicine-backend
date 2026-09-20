import { prisma } from '../../lib/prisma';

export async function audit(input: {
  actorId?: string; action: string; resource: string; resourceId?: string; ipAddress?: string; userAgent?: string; metadata?: unknown;
}) {
  await prisma.auditLog.create({ data: { ...input, metadata: input.metadata as any } });
}
