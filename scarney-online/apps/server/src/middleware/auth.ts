import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { JWTPayload } from '@scarney/shared';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as JWTPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'トークンが無効または期限切れです' });
  }
}
