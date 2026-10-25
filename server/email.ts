import nodemailer from 'nodemailer';
import {config} from './config';
import {ApiError} from './errors';

export async function sendEmail(to:string,subject:string,text:string){
  const replyTo=process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  const safeReplyTo=replyTo&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)?replyTo:undefined;
  if(process.env.RESEND_API_KEY){
    if(!process.env.MAIL_FROM)throw new ApiError(503,'Configure MAIL_FROM with your verified sender.');
    const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM,to:[to],subject,text,...(safeReplyTo?{reply_to:safeReplyTo}:{})})});
    if(!response.ok)throw new ApiError(503,'The email provider could not send this message. Check the sender configuration.');
    return;
  }
  const {host,port,user,pass,from}=config.smtp;
  if(!host||!user||!pass||!from)throw new ApiError(503,'Email delivery is not configured.');
  await nodemailer.createTransport({host,port,secure:port===465,auth:{user,pass},connectionTimeout:10000,greetingTimeout:10000}).sendMail({from,to,subject,text,replyTo:safeReplyTo});
}
export async function notifyAdminEmail(subject:string){
  const email=process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if(!email)return;
  try{
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Invalid notification recipient.');
    const origin=config.frontendOrigin.split(',')[0].trim();
    await sendEmail(email,'Acadex: '+subject,'A new item needs your attention in the administrator dashboard. Sign in at '+origin+'/dashboard . Do not share your password or verification codes.');
  }catch{console.error('An admin email notification could not be sent. The submission remains in the dashboard.');}
}
