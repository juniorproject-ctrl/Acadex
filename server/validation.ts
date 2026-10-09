import { ApiError } from './errors';

const universityEmailPattern = /^[^\s@]+@(?:(?:[a-z0-9-]+\.)*ac\.ae|aus\.edu)$/i;
const passwordPattern = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function validatePassword(value:unknown){
  if(typeof value!=='string'||!passwordPattern.test(value)||Buffer.byteLength(value,'utf8')>72)throw new ApiError(400,'Password must be at least 8 characters, include a number and special character, and be no more than 72 bytes.');
  return value;
}

export function isAllowedUniversityEmail(email: string) {
  return universityEmailPattern.test(email.trim());
}

export function validateRegistration(input: { name?: unknown; email?: unknown; password?: unknown; role?: unknown }) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (input.role !== undefined && !['student','Student'].includes(String(input.role))) throw new ApiError(400, 'New accounts are students. Apply to tutor after signing in.');
  const role = 'student';

  if (name.length < 2 || name.length > 100) throw new ApiError(400, 'Please enter a name between 2 and 100 characters.');
  if (!isAllowedUniversityEmail(email)) throw new ApiError(400, 'Please use a UAE university email from a .ac.ae campus domain or aus.edu.');
  validatePassword(password);

  return { name, email, password, role };
}

export function validateLogin(input: { email?: unknown; password?: unknown }) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (!email || !password) throw new ApiError(400, 'Email and password are required.');
  return { email, password };
}

export function validateOtp(input: { email?: unknown; code?: unknown }) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const code = typeof input.code === 'string' ? input.code.trim() : '';
  if (!email || !/^\d{6}$/.test(code)) throw new ApiError(400, 'Enter the six-digit verification code.');
  return { email, code };
}
