import { Router } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { config } from '../config.js';

const router = Router();

const signupSchema = z.object({
  username: z.string().min(1).max(30),
  email: z.string().email(),
  password: z.string().min(4).max(64),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth/refresh',
};

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const { username, email, password } = signupSchema.parse(req.body);
    const user = await authService.signup(username, email, password);
    const accessToken = authService.issueAccessToken(user.id, user.username);
    const refreshToken = await authService.issueRefreshToken(user.id);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.status(201).json({ accessToken, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await authService.login(email, password);
    const accessToken = authService.issueAccessToken(user.id, user.username);
    const refreshToken = await authService.issueRefreshToken(user.id);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.json({ accessToken, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) { res.status(401).json({ error: 'リフレッシュトークンがありません' }); return; }
    const userId = await authService.validateRefreshToken(token);
    if (!userId) { res.status(401).json({ error: 'トークンが無効または期限切れです' }); return; }
    const user = await authService.getUserById(userId);
    if (!user) { res.status(401).json({ error: 'ユーザーが見つかりません' }); return; }
    const newRefreshToken = await authService.rotateRefreshToken(token, userId);
    const accessToken = authService.issueAccessToken(userId, user.username);
    res.cookie('refreshToken', newRefreshToken, COOKIE_OPTS);
    res.json({ accessToken, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (token) await authService.revokeRefreshToken(token);
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await authService.getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: 'ユーザーが見つかりません' }); return; }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
