import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireAuth } from '../middleware/auth';
import { course, filters, page, text, userId, verified } from './shared';

const router = Router();
const directory = config.paperDirectory;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
router.get('/', asyncHandler(async (req, res) => {
  const { clauses, values } = filters(req, 'c.university_id', ['p.title','c.code','c.name']);
  if (req.query.course) { clauses.push('c.id = ?'); values.push(String(req.query.course)); }
  if (req.query.major === 'shared') clauses.push('c.is_shared = TRUE');
  else if (req.query.major) { clauses.push('EXISTS (SELECT 1 FROM course_majors cm WHERE cm.course_id = c.id AND cm.major_id = ?)'); values.push(String(req.query.major)); }
  res.json(await page(req, 'SELECT p.id,p.owner_id AS ownerId,p.title,p.academic_year AS academicYear,p.exam_type AS examType,p.created_at AS createdAt,c.name AS course,c.code,u.name AS university', 'FROM past_papers p JOIN courses c ON c.id=p.course_id JOIN universities u ON u.id=c.university_id', clauses, values, 'p.created_at DESC,p.id'));
}));
router.get('/:id/download', asyncHandler(async (req, res) => {
  const [paper] = await query<any[]>('SELECT file_name,title FROM past_papers WHERE id=?', [req.params.id]);
  if (!paper) throw new ApiError(404, 'Paper not found.');
  const file = path.join(directory, path.basename(paper.file_name));
  try { await fs.access(file); } catch { throw new ApiError(404, 'The PDF is no longer available.'); }
  res.setHeader('X-Content-Type-Options','nosniff');
  res.download(file, paper.title.replace(/[^a-z0-9 -]/gi,'').slice(0,100) + '.pdf');
}));
router.post('/', requireAuth, verified, rateLimit({ windowMs: 3600_000, limit: 20, message: { error: 'Upload limit reached. Try again later.' } }), upload.single('file'), asyncHandler(async (req, res) => {
  const title = text(req.body.title,'Title');
  const courseId = await course(req.body.courseId);
  const academicYear = Number(req.body.academicYear);
  if (!Number.isInteger(academicYear) || academicYear < 1990 || academicYear > new Date().getFullYear()+1) throw new ApiError(400,'Enter a valid academic year.');
  if (!['Midterm','Final','Quiz','Practice'].includes(req.body.examType)) throw new ApiError(400,'Choose an assessment type.');
  if (req.body.permission !== 'true') throw new ApiError(400,'Confirm that you have permission to share this paper.');
  if (!req.file || req.file.mimetype !== 'application/pdf' || req.file.buffer.subarray(0,5).toString() !== '%PDF-' || !req.file.buffer.subarray(-1024).includes(Buffer.from('%%EOF'))) throw new ApiError(400,'Upload a valid PDF, up to 10 MB.');
  const id = randomUUID(), fileName = id + '.pdf';
  await fs.mkdir(directory, { recursive:true });
  await fs.writeFile(path.join(directory,fileName), req.file.buffer, { flag:'wx' });
  try { await query('INSERT INTO past_papers (id,owner_id,course_id,title,academic_year,exam_type,file_name) VALUES (?,?,?,?,?,?,?)', [id,userId(req),courseId,title,academicYear,req.body.examType,fileName]); }
  catch (error) { await fs.unlink(path.join(directory,fileName)); throw error; }
  res.status(201).json({ id });
}));
router.delete('/:id', requireAuth, verified, asyncHandler(async (req,res) => {
  const [paper] = await query<any[]>('SELECT * FROM past_papers WHERE id=? AND owner_id=?',[req.params.id,userId(req)]);
  if (!paper) throw new ApiError(404,'Paper not found.');
  await query('DELETE FROM past_papers WHERE id=?',[paper.id]);
  await fs.unlink(path.join(directory,path.basename(paper.file_name))).catch(() => {});
  res.json({ ok:true });
}));
export default router;
