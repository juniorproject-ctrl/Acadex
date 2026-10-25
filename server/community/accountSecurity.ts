import bcrypt from 'bcrypt';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ApiError, asyncHandler } from '../errors';
import { validatePassword } from '../validation';
import { rows, transaction, userId } from './shared';

const router=Router();
router.use(rateLimit({windowMs:900000,limit:10,message:{error:'Too many account-security attempts. Try again later.'}}));
async function passwordUser(connection:any,id:string,password:unknown) {
  const [user]=await rows(connection,'SELECT * FROM users WHERE id=? AND deleted_at IS NULL FOR UPDATE',[id]);
  if(!user||typeof password!=='string'||password.length>200||!user.password_hash||!await bcrypt.compare(password,user.password_hash))throw new ApiError(400,'Your current password is incorrect.');
  return user;
}
router.post('/password',asyncHandler(async(req,res)=>{
  const password=validatePassword(req.body.password);
  await transaction(async c=>{
    const user=await passwordUser(c,userId(req),req.body.currentPassword);
    if(await bcrypt.compare(password,user.password_hash))throw new ApiError(400,'Choose a different new password.');
    await c.execute('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?',[await bcrypt.hash(password,12),user.id]);
    await c.execute('DELETE FROM password_resets WHERE user_id=?',[user.id]);
  });
  res.json({ok:true});
}));
router.post('/sign-out-all',asyncHandler(async(req,res)=>{
  await transaction(async c=>{
    const user=await passwordUser(c,userId(req),req.body.currentPassword);
    await c.execute('UPDATE users SET session_version=session_version+1 WHERE id=?',[user.id]);
  });res.json({ok:true});
}));
router.delete('/',asyncHandler(async(req,res)=>{
  if(req.body.confirmation!=='DELETE')throw new ApiError(400,'Type DELETE to confirm account deletion.');
  await transaction(async c=>{
    // Lock active admins consistently before locking an account to protect the last administrator.
    const admins=await rows(c,"SELECT id FROM users WHERE role='admin' AND deleted_at IS NULL AND is_suspended=FALSE AND is_verified=TRUE ORDER BY id FOR UPDATE");
    const user=await passwordUser(c,userId(req),req.body.currentPassword);
    if(user.role==='admin'&&admins.length<=1)throw new ApiError(409,'Add and verify another administrator before deleting the last admin account.');
    const orders=await rows(c,"SELECT id FROM payment_orders WHERE (buyer_id=? OR seller_id=?) AND status IN ('pending','review_required')",[user.id,user.id]);
    if(orders.length)throw new ApiError(409,'Resolve or cancel your pending checkouts before deleting your account.');
    const bookings=await rows(c,"SELECT b.id FROM tutor_bookings b JOIN tutor_slots s ON s.id=b.slot_id WHERE (b.student_id=? OR s.tutor_id=?) AND b.status IN ('pending','accepted') AND s.ends_at>UTC_TIMESTAMP()",[user.id,user.id]);
    if(bookings.length)throw new ApiError(409,'Cancel or complete your upcoming tutoring bookings before deleting your account.');
    const groups=await rows(c,'SELECT id FROM study_groups WHERE owner_id=?',[user.id]);
    if(groups.length)throw new ApiError(409,'Contact support to close or transfer your study groups before deleting your account.');
    await c.execute('DELETE FROM verification_otps WHERE user_id=?',[user.id]);
    await c.execute('DELETE FROM password_resets WHERE user_id=?',[user.id]);
    await c.execute('DELETE FROM notifications WHERE user_id=?',[user.id]);
    await c.execute('DELETE FROM group_members WHERE user_id=?',[user.id]);
    await c.execute('DELETE FROM group_bans WHERE user_id=?',[user.id]);
    await c.execute("UPDATE listings SET status='DRAFT',is_hidden=TRUE,title='Removed listing',description='',location='' WHERE owner_id=?",[user.id]);
    await c.execute('DELETE i FROM listing_images i JOIN listings l ON l.id=i.listing_id WHERE l.owner_id=?',[user.id]);
    await c.execute('UPDATE tutor_slots SET cancelled=TRUE WHERE tutor_id=?',[user.id]);
    await c.execute("UPDATE tutor_profiles SET subjects='',bio='',hourly_rate=0 WHERE user_id=?",[user.id]);
    await c.execute("UPDATE tutor_applications SET subjects='',experience='',academic_title='',status='withdrawn',permit_reference='',permit_file='',qualification_file='',employment_status='' WHERE user_id=?",[user.id]);
    await c.execute("UPDATE campus_events SET cancelled=TRUE WHERE owner_id=?",[user.id]);
    await c.execute('UPDATE users SET name=?,email=?,password_hash=NULL,is_verified=FALSE,role=\'student\',last_otp_sent_at=NULL,session_version=session_version+1,deleted_at=UTC_TIMESTAMP() WHERE id=?',['Deleted user','deleted-'+user.id+'@deleted.invalid',user.id]);
  });
  res.json({ok:true});
}));
export default router;
