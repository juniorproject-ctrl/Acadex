import dotenv from 'dotenv';
import path from 'node:path';

// This module is also imported by CLI scripts, before server.ts can load env values.
dotenv.config({ path: '.env.local' });

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  databaseUrl: () => required('DATABASE_URL'),
  jwtSecret: () => required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  uploadDirectory: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
  paperDirectory: path.resolve(process.cwd(), process.env.PAPERS_DIR || 'private-papers'),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
  },
};
