import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { text, verified } from './shared';

const router = Router();
router.post('/', rateLimit({ windowMs: 3600000, limit: 10 }), asyncHandler(async (req, res) => {
  if (!['suggestion', 'problem', 'comment'].includes(req.body.category)) throw new ApiError(400, 'Choose a feedback category.');
  const name = req.body.name ? text(req.body.name, 'Name', 1, 100) : '';
  const message = text(req.body.message, 'Comments', 10, 3000);
  await query('INSERT INTO feedback (id,name,category,message) VALUES (?,?,?,?)', [randomUUID(), name, req.body.category, message]);
  res.status(201).json({ ok: true });
}));
router.use(requireAuth, verified);
router.use((req: AuthRequest, _res, next) => {
  if (req.user?.role !== 'admin') return next(new ApiError(403, 'Administrator access required.'));
  next();
});
router.get('/', asyncHandler(async (_req, res) => {
  res.json({ items: await query('SELECT * FROM feedback ORDER BY created_at DESC LIMIT 200') });
}));
router.patch('/:id', asyncHandler(async (req, res) => {
  if (!['new', 'reviewed'].includes(req.body.status)) throw new ApiError(400, 'Choose a feedback status.');
  const result = await query<any>('UPDATE feedback SET status=? WHERE id=?', [req.body.status, req.params.id]);
  if (!result.affectedRows) throw new ApiError(404, 'Feedback not found.');
  res.json({ ok: true });
}));
export default router;
