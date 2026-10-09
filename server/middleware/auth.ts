import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ApiError } from '../errors';

export type AuthRequest = Request & { user?: { id: string; email: string; name: string; role: string } };

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return next(new ApiError(401, 'Authentication is required.'));

  try {
    const payload = jwt.verify(token, config.jwtSecret()) as jwt.JwtPayload;
    if (!payload.sub || !payload.email || !payload.name || !payload.role) throw new Error('Invalid token payload');
    req.user = { id: String(payload.sub), email: String(payload.email), name: String(payload.name), role: String(payload.role) };
    return next();
  } catch {
    return next(new ApiError(401, 'Your session has expired. Please sign in again.'));
  }
}
