import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireAuth } from '../middleware/auth';
import { rows, text, transaction, userId, verified } from './shared';

const router = Router();
router.use(requireAuth, verified);
async function member(id: string, user: string) {
  const [conversation] = await query<any[]>('SELECT * FROM listing_conversations WHERE id=? AND (buyer_id=? OR seller_id=?)', [id, user, user]);
  if (!conversation) throw new ApiError(404, 'Conversation not found.');
  return conversation;
}
router.get('/', asyncHandler(async (req, res) => {
  const items = await query<any[]>(`SELECT c.id,c.listing_id AS listingId,c.listing_title AS title,c.updated_at AS updatedAt,
    CASE WHEN c.buyer_id=? THEN s.name ELSE b.name END AS otherName,
    (SELECT body FROM listing_messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1) AS preview,
    (SELECT COUNT(*) FROM listing_messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.id>CASE WHEN c.buyer_id=? THEN c.buyer_read_id ELSE c.seller_read_id END) AS unread
    FROM listing_conversations c JOIN users b ON b.id=c.buyer_id JOIN users s ON s.id=c.seller_id
    WHERE c.buyer_id=? OR c.seller_id=? ORDER BY c.updated_at DESC LIMIT 100`, Array(5).fill(userId(req)));
  res.json({ items });
}));
router.post('/', rateLimit({ windowMs: 60000, limit: 20 }), asyncHandler(async (req, res) => {
  const listingId = text(req.body.listingId, 'Listing', 1, 36);
  const id = await transaction(async connection => {
    const [listing] = await rows(connection, 'SELECT * FROM listings WHERE id=? FOR UPDATE', [listingId]);
    if (!listing || listing.status !== 'ACTIVE') throw new ApiError(404, 'This listing is no longer available.');
    if (listing.owner_id === userId(req)) throw new ApiError(400, 'You cannot start a conversation with yourself.');
    const [existing] = await rows(connection, 'SELECT id FROM listing_conversations WHERE listing_id=? AND buyer_id=?', [listingId, userId(req)]);
    if (existing) return existing.id;
    const id = randomUUID();
    await connection.execute('INSERT INTO listing_conversations (id,listing_id,listing_title,buyer_id,seller_id) VALUES (?,?,?,?,?)', [id, listingId, listing.title, userId(req), listing.owner_id]);
    return id;
  });
  res.status(201).json({ id });
}));
router.get('/:id', asyncHandler(async (req, res) => {
  const conversation = await member(req.params.id, userId(req));
  const before = req.query.before === undefined ? null : String(req.query.before);
  if (before !== null && !/^\d{1,18}$/.test(before)) throw new ApiError(400, 'Invalid message cursor.');
  const messages = await query<any[]>(`SELECT CAST(m.id AS CHAR) AS id,m.sender_id AS senderId,u.name AS author,m.body,m.created_at AS createdAt FROM listing_messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=?${before ? ' AND m.id<?' : ''} ORDER BY m.id DESC LIMIT 51`, before ? [conversation.id, before] : [conversation.id]);
  const hasMore = messages.length > 50;
  const page = messages.slice(0, 50).reverse();
  const [other] = await query<any[]>('SELECT name FROM users WHERE id=?', [conversation.buyer_id === userId(req) ? conversation.seller_id : conversation.buyer_id]);
  res.json({ id: conversation.id, listingId: conversation.listing_id, title: conversation.listing_title, otherName: other.name, messages: page, hasMore });
}));
router.post('/:id/read', asyncHandler(async (req, res) => {
  const conversation = await member(req.params.id, userId(req));
  const lastId = text(req.body.lastId, 'Last message', 1, 18);
  if (!/^\d+$/.test(lastId)) throw new ApiError(400, 'Invalid message cursor.');
  const [message] = await query<any[]>('SELECT id FROM listing_messages WHERE conversation_id=? AND id=?', [conversation.id, lastId]);
  if (!message) throw new ApiError(400, 'Message not found.');
  const column = conversation.buyer_id === userId(req) ? 'buyer_read_id' : 'seller_read_id';
  await query(`UPDATE listing_conversations SET ${column}=GREATEST(${column},?) WHERE id=?`, [lastId, conversation.id]);
  res.json({ ok: true });
}));
router.post('/:id/messages', rateLimit({ windowMs: 60000, limit: 30 }), asyncHandler(async (req, res) => {
  const body = text(req.body.body, 'Message', 1, 2000);
  const conversation = await member(req.params.id, userId(req));
  await transaction(async connection => {
    await connection.execute('INSERT INTO listing_messages (conversation_id,sender_id,body) VALUES (?,?,?)', [conversation.id, userId(req), body]);
    await connection.execute('UPDATE listing_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [conversation.id]);
  });
  res.status(201).json({ ok: true });
}));
export default router;
