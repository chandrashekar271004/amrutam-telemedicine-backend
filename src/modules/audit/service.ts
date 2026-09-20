import { prisma } from '../../lib/prisma.js';

type AuditInput = {
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: unknown;
};

export async function audit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata ?? undefined,
    },
  });
}
