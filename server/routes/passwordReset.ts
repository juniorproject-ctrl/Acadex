import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {ApiError,asyncHandler} from '../errors';
import {transaction,rows} from '../community/shared';
import {validatePassword} from '../validation';
type Sender=(name:string,email:string,code:string)=>Promise<void>;
const message='If a verified account exists for that email, a password reset code will be sent.';
const emailOf=(value:unknown)=>{
 if(typeof value!=='string'||value.length>255||!/^\S+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw new ApiError(400,'Enter a valid email address.');
 return value.trim().toLowerCase();
};
export function createPasswordResetRouter(send:Sender){
 const router=Router();
 router.post('/forgot-password',rateLimit({windowMs:900000,limit:5,message:{error:'Too many reset requests. Please try again later.'}}),asyncHandler(async(req,res)=>{
  const email=emailOf(req.body?.email);
  await transaction(async c=>{
   const [user]=await rows(c,'SELECT id,name FROM users WHERE email=? AND is_verified=TRUE FOR UPDATE',[email]);
   if(!user)return;
   const [existing]=await rows(c,'SELECT created_at FROM password_resets WHERE user_id=?',[user.id]);
   if(existing&&Date.now()-new Date(existing.created_at).getTime()<60000)return;
   const code=crypto.randomInt(100000,1000000).toString(),hash=await bcrypt.hash(code,12);
   await c.execute('INSERT INTO password_resets (user_id,code_hash,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE)) ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash),expires_at=VALUES(expires_at),attempts=0,created_at=UTC_TIMESTAMP()',[user.id,hash]);
   await send(user.name,email,code);
  });res.json({message});
 }));
 router.post('/reset-password',rateLimit({windowMs:900000,limit:15,message:{error:'Too many reset attempts. Please try again later.'}}),asyncHandler(async(req,res)=>{
  const email=emailOf(req.body?.email),password=validatePassword(req.body?.password),code=req.body?.code;
  if(typeof code!=='string'||!/^\d{6}$/.test(code))throw new ApiError(400,'Enter your six-digit reset code.');
  const result=await transaction(async c=>{
   const [user]=await rows(c,'SELECT id FROM users WHERE email=? AND is_verified=TRUE FOR UPDATE',[email]);
   if(!user)return false;
   const [reset]=await rows(c,'SELECT * FROM password_resets WHERE user_id=? FOR UPDATE',[user.id]);
   if(!reset||new Date(reset.expires_at).getTime()<=Date.now()||reset.attempts>=5)return false;
   if(!await bcrypt.compare(code,reset.code_hash)){await c.execute('UPDATE password_resets SET attempts=attempts+1 WHERE user_id=?',[user.id]);return false;}
   await c.execute('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?',[await bcrypt.hash(password,12),user.id]);
   await c.execute('DELETE FROM password_resets WHERE user_id=?',[user.id]);return true;
  });
  if(!result)throw new ApiError(400,'Invalid or expired reset code. Request a new code if needed.');
  res.json({message:'Password updated. Sign in with your new password.'});
 }));
 return router;
}
