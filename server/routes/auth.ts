import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {sendEmail} from '../email';
import type { RowDataPacket } from 'mysql2';
import { createAccessToken, publicUser, type AuthUser } from '../auth';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { validateLogin, validateOtp, validateRegistration } from '../validation';
import { createPasswordResetRouter } from './passwordReset';

type UserRow = RowDataPacket & AuthUser & { password_hash: string; is_verified: number; last_otp_sent_at: Date | null };
type OtpRow = RowDataPacket & { code_hash: string; expires_at: Date; attempts: number };

const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many verification requests. Please wait before trying again.' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please wait before trying again.' } });

function sixDigitCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function sendVerificationEmail(name: string, email: string, code: string, reset=false) {
  const subject=reset?'Reset your Acadex password':'Your Acadex verification code';
  const text=reset?`Hello ${name}, your Acadex password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`:`Hello ${name}, your Acadex verification code is ${code}. It expires in 10 minutes.`;
  await sendEmail(email,subject,text);
}

export async function issueOtp(user: UserRow) {
  if (user.last_otp_sent_at && Date.now() - user.last_otp_sent_at.getTime() < 60_000) {
    throw new ApiError(429, 'Please wait one minute before requesting another verification code.');
  }

  const code = sixDigitCode();
  const codeHash = await bcrypt.hash(code, 12);
  await query('DELETE FROM verification_otps WHERE user_id = ?', [user.id]);
  await query('INSERT INTO verification_otps (user_id, code_hash, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))', [user.id, codeHash]);
  await query('UPDATE users SET last_otp_sent_at = UTC_TIMESTAMP() WHERE id = ?', [user.id]);
  await sendVerificationEmail(user.name, user.email, code);
}

const router = Router();
router.use(createPasswordResetRouter((name,email,code)=>sendVerificationEmail(name,email,code,true)));

router.post('/register', otpLimiter, asyncHandler(async (req, res) => {
  const { name, email, password, role } = validateRegistration(req.body);
  const users = await query<UserRow[]>('SELECT id, name, email, role, session_version, password_hash, is_verified, last_otp_sent_at FROM users WHERE email = ?', [email]);
  let user = users[0];
  if(user?.role==='admin')throw new ApiError(409,'This email is reserved for an administrator. Sign in or use password recovery.');

  if (user?.is_verified) throw new ApiError(409, 'An account with this email already exists. Please sign in instead.');

  const passwordHash = await bcrypt.hash(password, 12);
  if (user) {
    await query('UPDATE users SET name = ?, role = ?, password_hash = ? WHERE id = ?', [name, role, passwordHash, user.id]);
    user = { ...user, name, role, password_hash: passwordHash, last_otp_sent_at: null };
    await query('UPDATE users SET last_otp_sent_at = NULL WHERE id = ?', [user.id]);
  } else {
    const id = crypto.randomUUID();
    await query('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', [id, name, email, passwordHash, role]);
    user = { id, name, email, role, password_hash: passwordHash, is_verified: 0, last_otp_sent_at: null } as UserRow;
  }

  await issueOtp(user);
  return res.status(201).json({ message: 'Verification code sent.', email });
}));

router.post('/resend-otp', otpLimiter, asyncHandler(async (req, res) => {
  const { email } = validateOtp({ email: req.body?.email, code: '000000' });
  const users = await query<UserRow[]>('SELECT id, name, email, role, session_version, password_hash, is_verified, last_otp_sent_at FROM users WHERE email = ?', [email]);
  const user = users[0];
  if (!user || user.is_verified) throw new ApiError(400, 'No unverified account was found for this email.');
  await issueOtp(user);
  return res.json({ message: 'A new verification code was sent.' });
}));

router.post('/verify-otp', asyncHandler(async (req, res) => {
  const { email, code } = validateOtp(req.body);
  const users = await query<UserRow[]>('SELECT id, name, email, role, session_version, password_hash, is_verified, last_otp_sent_at FROM users WHERE email = ?', [email]);
  const user = users[0];
  if (!user) throw new ApiError(400, 'No account was found for this email.');
  if (user.is_verified) throw new ApiError(400, 'This account is already verified. Please sign in.');

  const otps = await query<OtpRow[]>('SELECT code_hash, expires_at, attempts FROM verification_otps WHERE user_id = ?', [user.id]);
  const otp = otps[0];
  if (!otp || otp.expires_at.getTime() < Date.now()) {
    await query('DELETE FROM verification_otps WHERE user_id = ?', [user.id]);
    throw new ApiError(400, 'This verification code has expired. Request a new one.');
  }
  if (otp.attempts >= 5) throw new ApiError(429, 'Too many incorrect codes. Request a new verification code.');

  const valid = await bcrypt.compare(code, otp.code_hash);
  if (!valid) {
    await query('UPDATE verification_otps SET attempts = attempts + 1 WHERE user_id = ?', [user.id]);
    throw new ApiError(400, 'Incorrect verification code.');
  }

  await query('UPDATE users SET is_verified = 1, verified_at = UTC_TIMESTAMP() WHERE id = ?', [user.id]);
  await query('DELETE FROM verification_otps WHERE user_id = ?', [user.id]);
  const publicAccount = publicUser(user);
  return res.json({ token: createAccessToken(user), user: publicAccount });
}));

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = validateLogin(req.body);
  const users = await query<UserRow[]>('SELECT id, name, email, role, session_version, password_hash, is_verified, last_otp_sent_at FROM users WHERE email = ?', [email]);
  const user = users[0];
  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) throw new ApiError(401, 'Invalid email or password.');
  const [access]=await query<any[]>('SELECT is_suspended,deleted_at FROM users WHERE id=?',[user.id]);
  if(access?.is_suspended||access?.deleted_at)throw new ApiError(403,'This account is unavailable. Contact support.');
  if (!user.is_verified) throw new ApiError(403, 'Verify your email before signing in.');
  return res.json({ token: createAccessToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const users = await query<UserRow[]>('SELECT id, name, email, role, session_version, password_hash, is_verified, last_otp_sent_at FROM users WHERE id = ? AND is_verified = 1', [req.user!.id]);
  const user = users[0];
  if (!user) throw new ApiError(401, 'Your session is no longer valid.');
  return res.json({ user: publicUser(user) });
}));

export default router;
