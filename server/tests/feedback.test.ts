import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import express from 'express';
import feedback from '../community/feedback';
import { pool, query } from '../db';
import { errorHandler } from '../errors';
import { createAccessToken } from '../auth';

test('feedback submission and private administrator review', { skip: process.env.FEEDBACK_INTEGRATION !== '1' }, async t => {
  const admin = { id: randomUUID(), name: 'Feedback admin', email: randomUUID() + '@example.test', role: 'admin' as const };
  const student = { ...admin, id: randomUUID(), email: randomUUID() + '@example.test', role: 'student' as const };
  const marker = randomUUID();
  const app = express(); app.use(express.json()); app.use('/feedback', feedback); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + (server.address() as any).port;
  const call = async (method: string, path: string, expected: number, body?: unknown, token?: string) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data;
  };
  try {
    for (const u of [admin, student]) await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)', [u.id, u.name, u.email, 'not-a-login-password', u.role]);
    const adminToken = createAccessToken(admin), studentToken = createAccessToken(student);
    await t.test('guests can submit without a university account', async () => {
      await call('POST', '/feedback', 201, { category: 'suggestion', name: marker, message: 'Please add more past papers.' });
      const [entry] = await query<any[]>('SELECT * FROM feedback WHERE name=?', [marker]);
      assert.equal(entry.status, 'new'); assert.equal(entry.category, 'suggestion');
    });
    await t.test('invalid categories and short comments are rejected', async () => {
      await call('POST', '/feedback', 400, { category: 'other', message: 'A sufficiently long comment.' });
      await call('POST', '/feedback', 400, { category: 'problem', message: 'short' });
    });
    await t.test('guests and students cannot read submissions or review them', async () => {
      await call('GET', '/feedback', 401);
      await call('GET', '/feedback', 403, undefined, studentToken);
      await call('PATCH', '/feedback/' + randomUUID(), 403, { status: 'reviewed' }, studentToken);
    });
    await t.test('admin can read, review and reopen feedback', async () => {
      const data = await call('GET', '/feedback', 200, undefined, adminToken);
      const entry = data.items.find((item: any) => item.name === marker); assert.ok(entry);
      await call('PATCH', '/feedback/' + entry.id, 200, { status: 'reviewed' }, adminToken);
      assert.equal((await query<any[]>('SELECT status FROM feedback WHERE id=?', [entry.id]))[0].status, 'reviewed');
      await call('PATCH', '/feedback/' + entry.id, 200, { status: 'new' }, adminToken);
      await call('PATCH', '/feedback/' + entry.id, 400, { status: 'invalid' }, adminToken);
      await call('PATCH', '/feedback/' + randomUUID(), 404, { status: 'reviewed' }, adminToken);
    });
  } finally {
    await query('DELETE FROM feedback WHERE name=?', [marker]);
    await query('DELETE FROM users WHERE id IN (?,?)', [admin.id, student.id]);
    await new Promise<void>(resolve => server.close(() => resolve())); await pool.end();
  }
});
