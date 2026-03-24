import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  console.error('[ErrorHandler]', err);
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
}
