import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireAuth } from '../middleware/auth';
import { filters, httpsUrl, page, teaching, text, timeRange, university, userId, verified } from './shared';
const router = Router();
const select = 'SELECT e.id,e.owner_id AS ownerId,e.title,e.description,e.location,e.starts_at AS startsAt,e.ends_at AS endsAt,e.source_url AS sourceUrl,e.image_key AS imageKey,e.cancelled,u.name AS university,e.university_id AS universityId';
const from = 'FROM campus_events e JOIN universities u ON u.id=e.university_id';
router.get('/', asyncHandler(async (req,res) => {
  const {clauses,values} = filters(req,'e.university_id',['e.title','e.description','e.location']);
  if (req.query.period !== 'all') clauses.push(req.query.period === 'past' ? 'e.ends_at<UTC_TIMESTAMP()' : 'e.ends_at>=UTC_TIMESTAMP()');
  res.json(await page(req,select,from,clauses,values,req.query.period === 'past' ? 'e.starts_at DESC,e.id' : 'e.starts_at,e.id'));
}));
router.get('/:id', asyncHandler(async (req,res) => {
  const [event] = await query<any[]>(select+' '+from+' WHERE e.id=?',[req.params.id]);
  if (!event) throw new ApiError(404,'Event not found.');
  res.json(event);
}));
router.use(requireAuth,verified);
async function eventInput(body:any) {
  const [start,end] = timeRange(body,false,24*30);
  const imageKey = ['campus','global-day','career-day','dental-symposium'].includes(body.imageKey) ? body.imageKey : 'campus';
  return [await university(body.universityId),text(body.title,'Event title'),text(body.description,'Description',20,5000),text(body.location,'Location',3,300),start,end,httpsUrl(body.sourceUrl,'Event source',true)||null,imageKey];
}
router.post('/', asyncHandler(async (req,res) => {
  teaching(req);
  const fields = await eventInput(req.body), id = randomUUID();
  await query('INSERT INTO campus_events (id,owner_id,university_id,title,description,location,starts_at,ends_at,source_url,image_key) VALUES (?,?,?,?,?,?,?,?,?,?)',[id,userId(req),...fields]);
  res.status(201).json({id});
}));
router.patch('/:id', asyncHandler(async (req,res) => {
  teaching(req);
  const [event] = await query<any[]>('SELECT id FROM campus_events WHERE id=? AND owner_id=?',[req.params.id,userId(req)]);
  if (!event) throw new ApiError(403,'Only the event publisher can edit it.');
  if (typeof req.body.cancelled === 'boolean') await query('UPDATE campus_events SET cancelled=? WHERE id=?',[req.body.cancelled,event.id]);
  else await query('UPDATE campus_events SET university_id=?,title=?,description=?,location=?,starts_at=?,ends_at=?,source_url=?,image_key=? WHERE id=?',[...await eventInput(req.body),event.id]);
  res.json({ok:true});
}));
export default router;
