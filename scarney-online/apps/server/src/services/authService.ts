import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma.js';
import { config } from '../config.js';
import type { AuthUser, JWTPayload } from '@scarney/shared';

export function issueAccessToken(userId: string, username: string): string {
  return jwt.sign({ userId, username } satisfies JWTPayload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN as string,
  });
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } });
}

export async function rotateRefreshToken(oldToken: string, userId: string): Promise<string> {
  await revokeRefreshToken(oldToken);
  return issueRefreshToken(userId);
}

export async function validateRefreshToken(token: string): Promise<string | null> {
  const record = await prisma.refreshToken.findUnique({ where: { token } });
  if (!record || record.revoked || record.expiresAt < new Date()) return null;
  return record.userId;
}

export async function signup(username: string, email: string, password: string): Promise<AuthUser> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { username }] },
  });
  if (existing) {
    if (existing.email === email.toLowerCase()) throw new Error('このメールアドレスは既に使用されています');
    throw new Error('このユーザー名は既に使用されています');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email: email.toLowerCase(), passwordHash },
  });
  // Initialize ranking record
  await prisma.ranking.create({ data: { userId: user.id } }).catch(() => {});
  return { id: user.id, username: user.username, email: user.email, avatarEmoji: user.avatarEmoji, chips: user.chips };
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new Error('メールアドレスまたはパスワードが正しくありません');
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('メールアドレスまたはパスワードが正しくありません');
  return { id: user.id, username: user.username, email: user.email, avatarEmoji: user.avatarEmoji, chips: user.chips };
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return { id: user.id, username: user.username, email: user.email, avatarEmoji: user.avatarEmoji, chips: user.chips };
}
