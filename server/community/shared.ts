import { randomUUID } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import type { Request } from 'express';
import { pool, query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import type { AuthRequest } from '../middleware/auth';

export const verified = asyncHandler(async (req: AuthRequest, _res, next) => {
  const [user] = await query<any[]>('SELECT id, name, email, role FROM users WHERE id = ? AND is_verified = TRUE', [req.user?.id]);
  if (!user) throw new ApiError(401, 'Please sign in with a verified account.');
  req.user = user;
  next();
});
export function userId(req: Request) { return (req as AuthRequest).user!.id; }
export function teaching(req: Request) {
  if (!['tutor', 'leader', 'admin'].includes((req as AuthRequest).user!.role)) throw new ApiError(403, 'A tutor or study group leader account is required.');
}
export async function tutor(req: Request) {
  if (!['tutor', 'admin'].includes((req as AuthRequest).user!.role)) throw new ApiError(403, 'A tutor account is required.');
  if((req as AuthRequest).user!.role!=='admin'){
    const blocked=await query<any[]>("SELECT id FROM tutor_applications WHERE user_id=? AND (status<>'approved')",[userId(req)]);
    if(blocked.length)throw new ApiError(403,'An approved tutor application is required.');
  }
}
export function text(value: unknown, label: string, min = 1, max = 160) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new ApiError(400, `${label} must be between ${min} and ${max} characters.`);
  return value.trim();
}
export function httpsUrl(value: unknown, label = 'Link', optional = false) {
  if (optional && !value) return '';
  const raw = text(value, label, 8, 2000);
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) throw new Error();
    return url.href;
  } catch { throw new ApiError(400, `${label} must be a valid HTTPS URL.`); }
}
export function timeRange(body: any, future = true, maxHours = 24) {
  const start = new Date(body.startsAt), end = new Date(body.endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || (future && start.getTime() <= Date.now()) || end.getTime() - start.getTime() > maxHours * 3600_000) throw new ApiError(400, `Choose a valid start and end time, up to ${maxHours} hours apart.${future?' New sessions must be in the future.':''}`);
  return [start, end];
}
export function money(value: unknown) {
  if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10000) throw new ApiError(400, 'Price must be between AED 0 and 10,000.');
  return Math.round(Number(value) * 100) / 100;
}
export async function university(id: unknown) {
  const value = text(id, 'University', 1, 80);
  if (!(await query<any[]>('SELECT id FROM universities WHERE id = ?', [value])).length) throw new ApiError(400, 'Choose a university from the list.');
  return value;
}
export async function course(id: unknown, universityId?: string) {
  const value = text(id, 'Course', 1, 120);
  const [row] = await query<any[]>('SELECT * FROM courses WHERE id = ?', [value]);
  if (!row || (universityId && row.university_id !== universityId)) throw new ApiError(400, 'Choose a course from the selected university.');
  return value;
}
export async function transaction<T>(action: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
export async function rows(connection: PoolConnection, sql: string, values: any[] = []): Promise<any[]> {
  const [result] = await connection.execute(sql, values);
  return result as any[];
}
export async function notify(connection: PoolConnection, user: string, title: string, href: string, key: string | null = null) {
  await connection.execute('INSERT IGNORE INTO notifications (id,user_id,title,href,dedupe_key) VALUES (?,?,?,?,?)', [randomUUID(), user, title.slice(0,240), href, key]);
}
export async function notifyGroup(connection: PoolConnection, groupId: string, title: string, except?: string) {
  const members = await rows(connection, 'SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
  for (const member of members) if (member.user_id !== except) await notify(connection, member.user_id, title, `/study-groups/${groupId}`);
}
export function filters(req: Request, universityColumn: string, searchColumns: string[]) {
  const clauses: string[] = [], values: any[] = [];
  if (typeof req.query.university === 'string' && req.query.university) { clauses.push(`${universityColumn} = ?`); values.push(req.query.university); }
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    clauses.push('(' + searchColumns.map((column) => `${column} LIKE ?`).join(' OR ') + ')');
    values.push(...searchColumns.map(() => '%' + String(req.query.q).trim().slice(0,160).replace(/[\\%_]/g, '\\$&') + '%'));
  }
  return { clauses, values };
}
export async function page(req: Request, select: string, from: string, clauses: string[], values: any[], order: string) {
  const current = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page) || 1)));
  const limit = Math.max(1, Math.min(24, Math.floor(Number(req.query.limit) || 12)));
  const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
  const [count] = await query<any[]>('SELECT COUNT(*) AS total ' + from + where, values);
  const items = await query<any[]>(select + ' ' + from + where + ' ORDER BY ' + order + ` LIMIT ${limit} OFFSET ${(current-1)*limit}`, values);
  return { items, total: Number(count.total), page: current, pages: Math.max(1, Math.ceil(count.total / limit)) };
}
