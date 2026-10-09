import jwt from 'jsonwebtoken';
import { config } from './config';

export type AuthUser = { id: string; email: string; name: string; role: string };

export function createAccessToken(user: AuthUser) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role }, config.jwtSecret(), {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function publicUser(user: AuthUser) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
