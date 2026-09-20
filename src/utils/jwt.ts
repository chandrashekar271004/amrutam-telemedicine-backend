import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from '@prisma/client';

export type AccessClaims = { sub: string; role: Role; type: 'access' };
export function signAccessToken(userId: string, role: Role) {
  return jwt.sign({ sub: userId, role, type: 'access' }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}
export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, env.JWT_SECRET) as AccessClaims;
}
