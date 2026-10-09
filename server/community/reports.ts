import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db';
import { ApiError,asyncHandler } from '../errors';
import { requireAuth,type AuthRequest } from '../middleware/auth';
import { text,userId,verified,transaction,rows,notify } from './shared';
const router=Router();
router.use(requireAuth,verified);
router.post('/',rateLimit({windowMs:3600000,limit:20}),asyncHandler(async(req,res)=>{
 const subject=text(req.body.subject,'Subject',3),details=text(req.body.details,'Details',10,5000);
 await transaction(async c=>{
  await c.execute('INSERT INTO reports (id,reporter_id,subject,details) VALUES (?,?,?,?)',[randomUUID(),userId(req),subject,details]);
  for(const a of await rows(c,"SELECT id FROM users WHERE role='admin' AND is_verified=TRUE"))await notify(c,a.id,'A new complaint needs review.','/dashboard');
 });res.status(201).json({ok:true});
}));
router.get('/',asyncHandler(async(req:AuthRequest,res)=>{
 if(req.user?.role!=='admin')throw new ApiError(403,'Administrator access required.');
 res.json({items:await query("SELECT r.*,u.name AS reporter FROM reports r JOIN users u ON u.id=r.reporter_id ORDER BY r.created_at DESC LIMIT 100")});
}));
router.patch('/:id',asyncHandler(async(req:AuthRequest,res)=>{
 if(req.user?.role!=='admin')throw new ApiError(403,'Administrator access required.');
 if(!['open','resolved','dismissed'].includes(req.body.status))throw new ApiError(400,'Choose a report status.');
 const resolution=text(req.body.resolution,'Review notes',5,2000);
 await transaction(async c=>{
  const [report]=await rows(c,'SELECT reporter_id FROM reports WHERE id=? FOR UPDATE',[req.params.id]);
  if(!report)throw new ApiError(404,'Report not found.');
  await c.execute('UPDATE reports SET status=?,resolution=?,reviewer_id=? WHERE id=?',[req.body.status,resolution,userId(req),req.params.id]);
  await notify(c,report.reporter_id,'Your complaint was reviewed: '+req.body.status,'/notifications');
 });res.json({ok:true});
}));
export default router;
