import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db';
import { ApiError,asyncHandler } from '../errors';
import { requireAuth,type AuthRequest } from '../middleware/auth';
import { text,userId,verified,transaction,rows,notify } from './shared';
import {notifyAdminEmail} from '../email';
const router=Router();
router.use(requireAuth,verified);
router.post('/',rateLimit({windowMs:3600000,limit:20}),asyncHandler(async(req,res)=>{
 const subject=text(req.body.subject,'Subject',3),details=text(req.body.details,'Details',10,5000);
 const targetType=req.body.targetType||null,targetId=req.body.targetId||null;
 const targets:Record<string,{table:string;owner:string}>={listing:{table:'listings',owner:'owner_id'},group:{table:'study_groups',owner:'owner_id'},tutor:{table:'tutor_profiles',owner:'user_id'},event:{table:'campus_events',owner:'owner_id'},paper:{table:'past_papers',owner:'owner_id'}};
 if((targetType||targetId)&&(typeof targetType!=='string'||!Object.hasOwn(targets,targetType)||typeof targetId!=='string'||!targetId.trim()||targetId.length>120))throw new ApiError(400,'Choose valid content to report.');
 await transaction(async c=>{
  if(targetType){
   const target=targets[targetType],column=targetType==='tutor'?'user_id':'id';
   const [item]=await rows(c,'SELECT '+target.owner+' AS ownerId FROM '+target.table+' WHERE '+column+'=?',[targetId]);
   if(!item)throw new ApiError(404,'The reported content could not be found.');
   if(item.ownerId===userId(req))throw new ApiError(400,'You cannot report your own content.');
  }
  await c.execute('INSERT INTO reports (id,reporter_id,subject,details,target_type,target_id) VALUES (?,?,?,?,?,?)',[randomUUID(),userId(req),subject,details,targetType,targetId]);
  for(const a of await rows(c,"SELECT id FROM users WHERE role='admin' AND is_verified=TRUE"))await notify(c,a.id,'A new complaint needs review.','/dashboard');
 });await notifyAdminEmail('New report');res.status(201).json({ok:true});
}));
router.get('/',asyncHandler(async(req:AuthRequest,res)=>{
 if(req.user?.role!=='admin')throw new ApiError(403,'Administrator access required.');
 res.json({items:await query("SELECT r.*,u.name AS reporter FROM reports r JOIN users u ON u.id=r.reporter_id ORDER BY r.created_at DESC LIMIT 100")});
}));
router.get('/mine',asyncHandler(async(req,res)=>{
 const items=await query<any[]>('SELECT id,subject,details,status,created_at AS createdAt FROM reports WHERE reporter_id=? ORDER BY created_at DESC LIMIT 100',[userId(req)]);
 const replies=await query<any[]>('SELECT rr.id,rr.report_id AS reportId,rr.body,rr.created_at AS createdAt,u.name AS author FROM report_replies rr JOIN reports r ON r.id=rr.report_id JOIN users u ON u.id=rr.author_id WHERE r.reporter_id=? ORDER BY rr.created_at',[userId(req)]);
 res.json({items:items.map(item=>({...item,replies:replies.filter(reply=>reply.reportId===item.id)}))});
}));
router.post('/:id/reply',asyncHandler(async(req:AuthRequest,res)=>{
 if(req.user?.role!=='admin')throw new ApiError(403,'Administrator access required.');
 const body=text(req.body.body,'Reply',5,2000);
 await transaction(async c=>{
  const [report]=await rows(c,'SELECT reporter_id FROM reports WHERE id=? FOR UPDATE',[req.params.id]);
  if(!report)throw new ApiError(404,'Report not found.');
  await c.execute('INSERT INTO report_replies (id,report_id,author_id,body) VALUES (?,?,?,?)',[randomUUID(),req.params.id,userId(req),body]);
  await notify(c,report.reporter_id,'An administrator replied to your report.','/my-reports');
 });res.status(201).json({ok:true});
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
