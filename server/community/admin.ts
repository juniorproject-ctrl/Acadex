import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {query} from '../db';
import {ApiError,asyncHandler} from '../errors';
import {requireAuth,type AuthRequest} from '../middleware/auth';
import {notify,rows,text,transaction,userId,verified} from './shared';
import {sendEmail} from '../email';

export function createAdminRouter(sender=sendEmail){
const router=Router();
router.use(requireAuth,verified,(req:AuthRequest,_res,next)=>req.user?.role==='admin'?next():next(new ApiError(403,'Administrator access required.')));
router.use(rateLimit({windowMs:60000,limit:60}));
async function audit(c:any,req:any,action:string,target:string,reason:string){
  await c.execute('INSERT INTO admin_audit (id,actor_id,action,target_id,reason) VALUES (?,?,?,?,?)',[randomUUID(),userId(req),action,target,reason]);
}
router.get('/listings',asyncHandler(async(req,res)=>{
  const search=typeof req.query.q==='string'?req.query.q.trim().slice(0,160):'';
  res.json({items:await query('SELECT l.id,l.title,l.price,l.status,l.is_hidden AS hidden,u.name AS seller FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.title LIKE ? ORDER BY l.created_at DESC LIMIT 100',['%'+search+'%'])});
}));
router.patch('/listings/:id',asyncHandler(async(req,res)=>{
  if(typeof req.body.hidden!=='boolean')throw new ApiError(400,'Choose hidden or visible.');
  const reason=text(req.body.reason,'Moderation reason',5,2000);
  await transaction(async c=>{
    const [listing]=await rows(c,'SELECT id,owner_id FROM listings WHERE id=? FOR UPDATE',[req.params.id]);
    if(!listing)throw new ApiError(404,'Listing not found.');
    await c.execute('UPDATE listings SET is_hidden=? WHERE id=?',[req.body.hidden,listing.id]);
    await audit(c,req,req.body.hidden?'hide_listing':'restore_listing',listing.id,reason);
    await notify(c,listing.owner_id,'Your listing was '+(req.body.hidden?'hidden':'restored')+': '+reason,'/my-listings');
  });res.json({ok:true});
}));
router.delete('/listings/:id',asyncHandler(async(req,res)=>{
  const reason=text(req.body.reason,'Deletion reason',5,2000);
  await transaction(async c=>{
    const [listing]=await rows(c,'SELECT id,owner_id FROM listings WHERE id=? FOR UPDATE',[req.params.id]);
    if(!listing)throw new ApiError(404,'Listing not found.');
    const orders=await rows(c,"SELECT id FROM payment_orders WHERE kind='listing' AND reference_id=? AND status IN ('pending','paid','review_required')",[listing.id]);
    if(orders.length)throw new ApiError(409,'This listing has payment records requiring attention. Hide it instead of deleting it.');
    await c.execute('DELETE FROM listings WHERE id=?',[listing.id]);
    await audit(c,req,'delete_listing',listing.id,reason);
    await notify(c,listing.owner_id,'Your listing was removed: '+reason,'/my-listings');
  });res.json({ok:true});
}));
router.get('/users',asyncHandler(async(req,res)=>{
  const search=typeof req.query.q==='string'?req.query.q.trim().slice(0,160):'';
  res.json({items:await query('SELECT id,name,email,role,is_verified AS verified,is_suspended AS suspended FROM users WHERE deleted_at IS NULL AND (name LIKE ? OR email LIKE ?) ORDER BY created_at DESC LIMIT 100',['%'+search+'%','%'+search+'%'])});
}));
router.patch('/users/:id',asyncHandler(async(req,res)=>{
  const reason=text(req.body.reason,'Reason',5,2000);
  if(!['student','tutor','leader','admin'].includes(req.body.role)||typeof req.body.suspended!=='boolean')throw new ApiError(400,'Choose a valid role and account status.');
  await transaction(async c=>{
    const admins=await rows(c,"SELECT id FROM users WHERE role='admin' AND deleted_at IS NULL AND is_suspended=FALSE AND is_verified=TRUE ORDER BY id FOR UPDATE");
    const [actor]=await rows(c,'SELECT password_hash FROM users WHERE id=?',[userId(req)]);
    if(typeof req.body.currentPassword!=='string'||!await bcrypt.compare(req.body.currentPassword,actor.password_hash))throw new ApiError(400,'Your current password is incorrect.');
    const [target]=await rows(c,'SELECT * FROM users WHERE id=? AND deleted_at IS NULL FOR UPDATE',[req.params.id]);
    if(!target)throw new ApiError(404,'Account not found.');
    if(target.id===userId(req)&&(req.body.suspended||req.body.role!=='admin'))throw new ApiError(400,'Another administrator must change your administrator access.');
    if(req.body.role==='admin'&&!target.is_verified)throw new ApiError(400,'The account must verify its email before becoming an administrator.');
    if(target.role==='admin'&&admins.length<=1&&(req.body.suspended||req.body.role!=='admin'))throw new ApiError(409,'The last active administrator cannot be removed.');
    await c.execute('UPDATE users SET role=?,is_suspended=?,session_version=session_version+1 WHERE id=?',[req.body.role,req.body.suspended,target.id]);
    await audit(c,req,'update_user_access',target.id,reason);
  });res.json({ok:true});
}));
router.get('/audit',asyncHandler(async(_req,res)=>{
  res.json({items:await query('SELECT a.id,a.action,a.target_id AS targetId,a.reason,a.created_at AS createdAt,u.name AS actor FROM admin_audit a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100')});
}));
router.get('/content/:kind',asyncHandler(async(req,res)=>{
  const choices:Record<string,string>={
    groups:'SELECT g.id,g.title,u.name AS owner FROM study_groups g JOIN users u ON u.id=g.owner_id ORDER BY g.created_at DESC LIMIT 100',
    events:'SELECT g.id,g.title,u.name AS owner FROM campus_events g JOIN users u ON u.id=g.owner_id ORDER BY g.starts_at DESC LIMIT 100',
    papers:'SELECT g.id,g.title,u.name AS owner FROM past_papers g JOIN users u ON u.id=g.owner_id ORDER BY g.created_at DESC LIMIT 100'
  };
  if(!choices[req.params.kind])throw new ApiError(400,'Choose groups, events or papers.');
  res.json({items:await query(choices[req.params.kind])});
}));
router.delete('/content/:kind/:id',asyncHandler(async(req,res)=>{
  const table={groups:'study_groups',events:'campus_events',papers:'past_papers'}[req.params.kind];
  if(!table)throw new ApiError(400,'Choose groups, events or papers.');
  const reason=text(req.body.reason,'Moderation reason',5,2000);
  await transaction(async c=>{
    const [item]=await rows(c,'SELECT id,owner_id FROM '+table+' WHERE id=? FOR UPDATE',[req.params.id]);
    if(!item)throw new ApiError(404,'Content not found.');
    await c.execute('DELETE FROM '+table+' WHERE id=?',[item.id]);
    await audit(c,req,'remove_'+req.params.kind,item.id,reason);
    await notify(c,item.owner_id,'Content removed by the Acadex team: '+reason,'/my-reports');
  });res.json({ok:true});
}));
router.post('/groups/:id/transfer',asyncHandler(async(req,res)=>{
  const targetId=text(req.body.ownerId,'New owner ID',36,36),reason=text(req.body.reason,'Reason',5,2000);
  await transaction(async c=>{
    const [group]=await rows(c,'SELECT id,owner_id FROM study_groups WHERE id=? FOR UPDATE',[req.params.id]);
    if(!group)throw new ApiError(404,'Group not found.');
    const [user]=await rows(c,'SELECT id FROM users WHERE id=? AND deleted_at IS NULL AND is_suspended=FALSE AND is_verified=TRUE',[targetId]);
    if(!user)throw new ApiError(400,'Choose a verified, active account.');
    await c.execute('INSERT IGNORE INTO group_members (group_id,user_id) VALUES (?,?)',[group.id,user.id]);
    await c.execute('DELETE FROM group_bans WHERE group_id=? AND user_id=?',[group.id,user.id]);
    await c.execute('UPDATE study_groups SET owner_id=? WHERE id=?',[user.id,group.id]);
    await audit(c,req,'transfer_group',group.id,reason);
    await notify(c,user.id,'You are now the administrator of a study group.','/study-groups/'+group.id);
  });res.json({ok:true});
}));
router.get('/support',asyncHandler(async(_req,res)=>{
  res.json({items:await query('SELECT * FROM support_messages ORDER BY created_at DESC LIMIT 100')});
}));
router.post('/support/:id/reply',asyncHandler(async(req,res)=>{
  const body=text(req.body.body,'Reply',5,2000);
  const [message]=await query<any[]>('SELECT * FROM support_messages WHERE id=?',[req.params.id]);
  if(!message)throw new ApiError(404,'Contact request not found.');
  await sender(message.email,'Acadex support: '+message.subject,body);
  await transaction(async c=>{
    await c.execute("UPDATE support_messages SET reply=?,status='resolved' WHERE id=?",[body,message.id]);
    await audit(c,req,'reply_to_support',message.id,'Email reply sent.');
  });res.json({ok:true});
}));
return router;
}
export default createAdminRouter();
