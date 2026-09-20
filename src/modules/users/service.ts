import { prisma } from '../../lib/prisma.js';
import { audit } from '../audit/service.js';
export async function me(userId: string) { return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, phone: true, role: true, mfaEnabled: true, profile: true, doctor: true } }); }
export async function update(userId: string, data: { firstName?: string; lastName?: string; phone?: string | null }) {
  const { firstName, lastName, phone } = data;
  const result = await prisma.$transaction(async tx => {
    const user = await tx.user.update({ where: { id: userId }, data: { phone } });
    const profile = await tx.profile.update({ where: { userId }, data: { firstName, lastName } });
    return { user, profile };
  });
  await audit({ actorId: userId, action: 'PROFILE_UPDATED', resource: 'User', resourceId: userId });
  return result;
}
