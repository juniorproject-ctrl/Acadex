import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db';
import { ApiError,asyncHandler } from '../errors';
import { requireAuth,type AuthRequest } from '../middleware/auth';
import { notify,rows,text,transaction,university,userId,verified } from './shared';

const router=Router();
const admin=(req:AuthRequest)=>{if(req.user?.role!=='admin')throw new ApiError(403,'Administrator access required.');};
const safe=(a:any)=>{if(!a)return null;const {permit_file,qualification_file,permit_reference,permit_expires,employment_status,...rest}=a;return rest;};
router.use(requireAuth,verified);
router.get('/mine',asyncHandler(async(req,res)=>{
  const [application]=await query<any[]>('SELECT * FROM tutor_applications WHERE user_id=?',[userId(req)]);res.json({application:safe(application)});
}));
router.get('/',asyncHandler(async(req:AuthRequest,res)=>{
  admin(req);const status=['pending','approved','declined'].includes(String(req.query.status))?String(req.query.status):'pending';
  const items=await query<any[]>('SELECT a.*,u.name,u.email,v.name AS university FROM tutor_applications a JOIN users u ON u.id=a.user_id JOIN universities v ON v.id=a.university_id WHERE a.status=? ORDER BY a.created_at ASC LIMIT 100',[status]);
  res.json({items:items.map(safe)});
}));
router.post('/',rateLimit({windowMs:3600000,limit:10}),asyncHandler(async(req:AuthRequest,res)=>{
  if(!req.body||typeof req.body!=='object')throw new ApiError(400,'Submit your academic application as JSON.');
  if(!['student','leader','tutor'].includes(req.user!.role))throw new ApiError(409,'This account cannot submit a tutor application.');
  const universityId=await university(req.body.universityId),subjects=text(req.body.subjects,'Subjects',3,500),experience=text(req.body.experience,'Teaching experience',20,5000),reference=text(req.body.academicTitle,'Academic position or study year',3,100);
  if(!['faculty','senior_student'].includes(req.body.applicantType)||!['online','in_person','both'].includes(req.body.teachingMode))throw new ApiError(400,'Choose your academic role and teaching mode.');
  if(req.body.consent!=='true')throw new ApiError(400,'Confirm that your academic information is accurate.');
  
  {

    await transaction(async connection=>{
      await rows(connection,'SELECT id FROM users WHERE id=? FOR UPDATE',[userId(req)]);
      const [existing]=await rows(connection,'SELECT * FROM tutor_applications WHERE user_id=? FOR UPDATE',[userId(req)]);
      if(existing&&(existing.status==='pending'||existing.status==='approved'))throw new ApiError(409,'An application is already pending or approved.');
      const id=existing?.id||randomUUID();
      if(existing){await connection.execute("UPDATE tutor_applications SET university_id=?,subjects=?,experience=?,applicant_type=?,teaching_mode=?,academic_title=?,status='pending',decision_reason='',reviewer_id=NULL,reviewed_at=NULL WHERE id=?",[universityId,subjects,experience,req.body.applicantType,req.body.teachingMode,reference,id]);}
      else await connection.execute('INSERT INTO tutor_applications (id,user_id,university_id,subjects,experience,applicant_type,teaching_mode,academic_title) VALUES (?,?,?,?,?,?,?,?)',[id,userId(req),universityId,subjects,experience,req.body.applicantType,req.body.teachingMode,reference]);
      await connection.execute('INSERT INTO tutor_application_audit (id,application_id,actor_id,action) VALUES (?,?,?,?)',[randomUUID(),id,userId(req),'submitted']);
      const admins=await rows(connection,"SELECT id FROM users WHERE role='admin' AND is_verified=TRUE");
      for(const reviewer of admins)await notify(connection,reviewer.id,'A tutor application is ready for review.','/admin/tutor-applications');
      await notify(connection,userId(req),'Your tutor application was submitted.','/apply-tutor');
    });
  }
  res.status(201).json({ok:true});
}));
router.patch('/:id/review',asyncHandler(async(req:AuthRequest,res)=>{
  admin(req);const decision=req.body.decision,reason=text(req.body.reason,'Review notes',5,2000);
  if(!['approved','declined'].includes(decision)||req.body.confirmed!==true)throw new ApiError(400,'Confirm the academic application review and choose a decision.');
  await transaction(async connection=>{
    const [a]=await rows(connection,'SELECT * FROM tutor_applications WHERE id=? FOR UPDATE',[req.params.id]);
    if(!a||a.status!=='pending')throw new ApiError(409,'This application is no longer pending.');
    if(a.user_id===userId(req))throw new ApiError(403,'You cannot review your own application.');
    await connection.execute('UPDATE tutor_applications SET status=?,decision_reason=?,reviewer_id=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?',[decision,reason,userId(req),a.id]);
    if(decision==='approved')await connection.execute("UPDATE users SET role='tutor' WHERE id=?",[a.user_id]);
    await connection.execute('INSERT INTO tutor_application_audit (id,application_id,actor_id,action,note) VALUES (?,?,?,?,?)',[randomUUID(),a.id,userId(req),decision,reason]);
    await notify(connection,a.user_id,`Your tutor application was ${decision}.`,'/apply-tutor');
  });res.json({ok:true});
}));
router.delete('/mine',asyncHandler(async(req,res)=>{

  await transaction(async connection=>{
    const [a]=await rows(connection,'SELECT * FROM tutor_applications WHERE user_id=? FOR UPDATE',[userId(req)]);
    if(!a||!['pending','declined'].includes(a.status))throw new ApiError(409,'Only pending or declined applications can be withdrawn.');

    await connection.execute("UPDATE tutor_applications SET status='withdrawn' WHERE id=?",[a.id]);
    await connection.execute('INSERT INTO tutor_application_audit (id,application_id,actor_id,action) VALUES (?,?,?,?)',[randomUUID(),a.id,userId(req),'withdrawn']);
  });res.json({ok:true});
}));
export default router;
