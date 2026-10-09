import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import type { RowDataPacket } from 'mysql2';
import { createAccessToken, publicUser, type AuthUser } from '../auth';
import { config } from '../config';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { validateLogin, validateOtp, validateRegistration } from '../validation';

type UserRow = RowDataPacket & AuthUser & { password_hash: string; is_verified: number; last_otp_sent_at: Date | null };
type OtpRow = RowDataPacket & { code_hash: string; expires_at: Date; attempts: number };

const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many verification requests. Please wait before trying again.' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please wait before trying again.' } });

function sixDigitCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function sendVerificationEmail(name: string, email: string, code: string) {
  if(process.env.RESEND_API_KEY){
    if(!process.env.MAIL_FROM)throw new ApiError(503,'Configure MAIL_FROM with your verified email sender.');
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',signal:AbortSignal.timeout(10000),
      headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({from:process.env.MAIL_FROM,to:[email],subject:'Your Acadex verification code',text:`Hello ${name}, your Acadex verification code is ${code}. It expires in 10 minutes.`}),
    });
    if(!response.ok)throw new ApiError(503,'The email provider could not send your verification code. Check the sender configuration.');
    return;
  }
  const { host, port, user, pass, from } = config.smtp;
  if (!host || !user || !pass || !from) throw new ApiError(503, 'Email verification is not configured on the server.');

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Your Acadex verification code',
    text: `Hello ${name}, your Acadex verification code is ${code}. It expires in 10 minutes.`,
  });
}

async function issueOtp(user: UserRow) {
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

router.post('/register', otpLimiter, asyncHandler(async (req, res) => {
  const { name, email, password, role } = validateRegistration(req.body);
  const users = await query<UserRow[]>('SELECT id, name, email, role, password_hash, is_verified, last_otp_sent_at FROM users WHERE email = ?', [email]);
  let user = users[0];

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
  const users = await query<UserRow[]>('SELECT id, name, email, role, password_hash, is_verified, last_otp_sent_at FROM users WHERE email = ?', [email]);
  const user = users[0];
  if (!user || user.is_verified) throw new ApiError(400, 'No unverified account was found for this email.');
  await issueOtp(user);
  return res.json({ message: 'A new verification code was sent.' });
}));

router.post('/verify-otp', asyncHandler(async (req, res) => {
  const { email, code } = validateOtp(req.body);
  const users = await query<UserRow[]>('SELECT id, name, email, role, password_hash, is_verified, last_otp_sent_at FROM users WHERE email = ?', [email]);
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
  const users = await query<UserRow[]>('SELECT id, name, email, role, password_hash, is_verified, last_otp_sent_at FROM users WHERE email = ?', [email]);
  const user = users[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new ApiError(401, 'Invalid email or password.');
  if (!user.is_verified) throw new ApiError(403, 'Verify your email before signing in.');
  return res.json({ token: createAccessToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const users = await query<UserRow[]>('SELECT id, name, email, role, password_hash, is_verified, last_otp_sent_at FROM users WHERE id = ? AND is_verified = 1', [req.user!.id]);
  const user = users[0];
  if (!user) throw new ApiError(401, 'Your session is no longer valid.');
  return res.json({ user: publicUser(user) });
}));

export default router;
