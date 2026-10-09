import crypto from 'node:crypto';
import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool, query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { listingUpload } from '../middleware/upload';
import { rows,transaction } from '../community/shared';

type ListingRow = RowDataPacket & {
  id: string; owner_id: string; title: string; description: string; price: number | null; category: string | null;
  item_condition: string | null; location: string | null; status: 'DRAFT' | 'ACTIVE' | 'SOLD'; created_at: Date; updated_at: Date;
  seller_name: string;
};
type ImageRow = RowDataPacket & { listing_id: string; image_url: string };

const validCategories = ['Textbooks', 'Electronics', 'Supplies', 'Study Setup', 'Lab Equipment'];
const validConditions = ['New', 'Like New', 'Good', 'Fair'];

function imageUrl(filename: string) {
  return `/uploads/${filename}`;
}

async function addImages(listings: ListingRow[]) {
  if (!listings.length) return [];
  const ids = listings.map((listing) => listing.id);
  const placeholders = ids.map(() => '?').join(', ');
  const images = await query<ImageRow[]>(`SELECT listing_id, image_url FROM listing_images WHERE listing_id IN (${placeholders}) ORDER BY position ASC`, ids);
  const byListing = new Map<string, string[]>();
  images.forEach((image) => byListing.set(image.listing_id, [...(byListing.get(image.listing_id) || []), image.image_url]));

  return listings.map((listing) => {
    const listingImages = byListing.get(listing.id) || [];
    return {
      id: listing.id,
      ownerId: listing.owner_id,
      title: listing.title,
      subtitle: listing.description.slice(0, 60),
      description: listing.description,
      price: Number(listing.price || 0),
      category: listing.category || 'Supplies',
      condition: listing.item_condition || 'Good',
      location: listing.location || '',
      status: listing.status.toLowerCase(),
      seller: listing.seller_name,
      image: listingImages[0] || '',
      images: listingImages,
      createdAt: listing.created_at.toISOString(),
      updatedAt: listing.updated_at.toISOString(),
    };
  });
}

function listingInput(body: Record<string, unknown>, status: 'DRAFT' | 'ACTIVE') {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const price = Number(body.price);
  const category = typeof body.category === 'string' ? body.category : '';
  const condition = typeof body.condition === 'string' ? body.condition : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';

  if (status === 'ACTIVE') {
    if (!title || !description || !location || !Number.isFinite(price) || price < 0) throw new ApiError(400, 'Title, description, price, and location are required.');
    if (description.length < 20) throw new ApiError(400, 'Description must be at least 20 characters.');
    if (!validCategories.includes(category) || !validConditions.includes(condition)) throw new ApiError(400, 'Choose a valid category and condition.');
  }

  return {
    title: title || 'Untitled draft',
    description,
    price: Number.isFinite(price) && price >= 0 ? price : null,
    category: validCategories.includes(category) ? category : null,
    condition: validConditions.includes(condition) ? condition : null,
    location,
  };
}

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const category = typeof req.query.category === 'string' && validCategories.includes(req.query.category) ? req.query.category : null;
  const condition = typeof req.query.condition === 'string' && validConditions.includes(req.query.condition) ? req.query.condition : null;
  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 16));
  const sort = req.query.sort === 'price_asc' ? 'l.price ASC' : req.query.sort === 'price_desc' ? 'l.price DESC' : 'l.created_at DESC';
  const clauses = ["l.status = 'ACTIVE'"];
  const values: unknown[] = [];

  if (search) { clauses.push('(l.title LIKE ? OR l.description LIKE ? OR l.location LIKE ? OR u.name LIKE ?)'); values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  if (category) { clauses.push('l.category = ?'); values.push(category); }
  if (condition) { clauses.push('l.item_condition = ?'); values.push(condition); }
  if (Number.isFinite(minPrice)) { clauses.push('l.price >= ?'); values.push(minPrice); }
  if (Number.isFinite(maxPrice)) { clauses.push('l.price <= ?'); values.push(maxPrice); }
  const where = clauses.join(' AND ');
  const totalRows = await query<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) AS total FROM listings l JOIN users u ON u.id = l.owner_id WHERE ${where}`, values);
  const listings = await query<ListingRow[]>(`SELECT l.*, u.name AS seller_name FROM listings l JOIN users u ON u.id = l.owner_id WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`, [...values, limit, (page - 1) * limit]);
  return res.json({ listings: await addImages(listings), total: totalRows[0].total, page, limit });
}));

router.get('/mine', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const listings = await query<ListingRow[]>('SELECT l.*, u.name AS seller_name FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.owner_id = ? ORDER BY l.updated_at DESC', [req.user!.id]);
  return res.json({ listings: await addImages(listings) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const listings = await query<ListingRow[]>("SELECT l.*, u.name AS seller_name FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.id = ? AND l.status = 'ACTIVE'", [req.params.id]);
  if (!listings[0]) throw new ApiError(404, 'Listing not found.');
  return res.json({ listing: (await addImages(listings))[0] });
}));

router.post('/', requireAuth, listingUpload.array('images', 5), asyncHandler(async (req: AuthRequest, res) => {
  const status = req.body.status === 'draft' ? 'DRAFT' : 'ACTIVE';
  const data = listingInput(req.body, status);
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  if (status === 'ACTIVE' && !files.length) throw new ApiError(400, 'Upload at least one image before publishing.');

  const id = crypto.randomUUID();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO listings (id, owner_id, title, description, price, category, item_condition, location, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, req.user!.id, data.title, data.description, data.price, data.category, data.condition, data.location, status]);
    for (const [position, file] of files.entries()) {
      await connection.execute('INSERT INTO listing_images (id, listing_id, image_url, position) VALUES (?, ?, ?, ?)', [crypto.randomUUID(), id, imageUrl(file.filename), position]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const created = await query<ListingRow[]>('SELECT l.*, u.name AS seller_name FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.id = ?', [id]);
  return res.status(201).json({ listing: (await addImages(created))[0] });
}));

router.patch('/:id', requireAuth, listingUpload.array('images', 5), asyncHandler(async (req: AuthRequest, res) => {
  await transaction(async connection=>{
  const [listing] = await rows(connection,'SELECT * FROM listings WHERE id=? FOR UPDATE',[req.params.id]);
  if (!listing) throw new ApiError(404, 'Listing not found.');
  if (listing.owner_id !== req.user!.id) throw new ApiError(403, 'You can only edit your own listings.');
  const orders=await rows(connection,"SELECT id FROM payment_orders WHERE kind='listing' AND reference_id=? AND status IN ('pending','paid')",[listing.id]);
  if(orders.length)throw new ApiError(409,'A reserved or purchased listing cannot be edited.');
  const status = req.body.status === 'draft' ? 'DRAFT' : req.body.status === 'sold' ? 'SOLD' : 'ACTIVE';
  const data = listingInput({ ...listing, ...req.body }, status === 'SOLD' ? 'DRAFT' : status);
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  const currentImages = await rows(connection,'SELECT listing_id, image_url FROM listing_images WHERE listing_id = ?', [listing.id]);
  if (status === 'ACTIVE' && !files.length && !currentImages.length) throw new ApiError(400, 'Upload at least one image before publishing.');
  await connection.execute('UPDATE listings SET title = ?, description = ?, price = ?, category = ?, item_condition = ?, location = ?, status = ? WHERE id = ?', [data.title, data.description, data.price, data.category, data.condition, data.location, status, listing.id]);
  for (const [index, file] of files.entries()) await connection.execute('INSERT INTO listing_images (id, listing_id, image_url, position) VALUES (?, ?, ?, ?)', [crypto.randomUUID(), listing.id, imageUrl(file.filename), currentImages.length + index]);
  });
  const updated = await query<ListingRow[]>('SELECT l.*, u.name AS seller_name FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.id = ?', [req.params.id]);
  return res.json({ listing: (await addImages(updated))[0] });
}));

router.delete('/:id', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  await transaction(async connection=>{
    const [listing]=await rows(connection,'SELECT * FROM listings WHERE id=? FOR UPDATE',[req.params.id]);
    if(!listing||listing.owner_id!==req.user!.id)throw new ApiError(404,'Listing not found.');
    const orders=await rows(connection,"SELECT id FROM payment_orders WHERE kind='listing' AND reference_id=? AND status IN ('pending','paid')",[listing.id]);
    if(orders.length)throw new ApiError(409,'A reserved or purchased listing cannot be deleted.');
    await connection.execute('DELETE FROM listings WHERE id=?',[listing.id]);
  });
  return res.status(204).send();
}));

export default router;
