import { randomBytes, createHash } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';
import { AppError } from '../../middleware/error.js';
import { audit } from '../audit/service.js';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { env } from '../../config/env.js';

export async function register(input: { email: string; phone?: string; password: string; firstName: string; lastName: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
  const user = await prisma.user.create({ data: { email: input.email.toLowerCase(), phone: input.phone, passwordHash: await hashPassword(input.password), profile: { create: { firstName: input.firstName, lastName: input.lastName } } }, include: { profile: true } });
  await audit({ actorId: user.id, action: 'USER_REGISTERED', resource: 'User', resourceId: user.id });
  return { id: user.id, email: user.email, role: user.role };
}

export async function login(email: string, password: string, mfaCode?: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  if (user.mfaEnabled) {
    if (!mfaCode || !user.mfaSecret || !authenticator.check(mfaCode, user.mfaSecret)) throw new AppError(401, 'Valid MFA code required', 'MFA_REQUIRED');
  }
  return { accessToken: signAccessToken(user.id, user.role), user: { id: user.id, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled } };
}

export async function setupMfa(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, 'Amrutam Telemedicine', secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);
  await prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });
  return { otpauth, qrDataUrl };
}

export async function enableMfa(userId: string, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaSecret || !authenticator.check(code, user.mfaSecret)) throw new AppError(400, 'Invalid MFA code', 'INVALID_MFA_CODE');
  await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
  await audit({ actorId: userId, action: 'MFA_ENABLED', resource: 'User', resourceId: userId });
  return { enabled: true };
}

export async function createRefreshToken(userId: string) {
  const raw = randomBytes(48).toString('base64url');
  const tokenHash = createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 86400000);
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return raw;
}
