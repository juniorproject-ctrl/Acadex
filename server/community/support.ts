import {randomUUID} from 'node:crypto';
import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {query} from '../db';
import {ApiError,asyncHandler} from '../errors';
import {text} from './shared';
import {notifyAdminEmail} from '../email';
const router=Router();
router.post('/',rateLimit({windowMs:3600000,limit:5,message:{error:'Too many contact requests. Please try again later.'}}),asyncHandler(async(req,res)=>{
  const name=text(req.body.name,'Name',2,100),email=text(req.body.email,'Email',5,255).toLowerCase(),subject=text(req.body.subject,'Subject',3,160),message=text(req.body.message,'Message',10,5000);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError(400,'Enter a valid email address.');
  await query('INSERT INTO support_messages (id,name,email,subject,message) VALUES (?,?,?,?,?)',[randomUUID(),name,email,subject,message]);
  await notifyAdminEmail('New contact request');
  res.status(201).json({ok:true});
}));
export default router;
