import jwt from 'jsonwebtoken';
import { config } from './config';

export type AuthUser = { id: string; email: string; name: string; role: string; session_version?:number };

export function createAccessToken(user: AuthUser) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role, version:user.session_version||0 }, config.jwtSecret(), {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function publicUser(user: AuthUser) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
