import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import {query} from './db';
import {rows,transaction} from './community/shared';
import {validatePassword} from './validation';
import {issueOtp} from './routes/auth';

export async function bootstrapAdmin(sendCode:(user:any)=>Promise<void>=issueOtp){
  const email=process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase(),password=process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if(!email||!password)return;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('ADMIN_BOOTSTRAP_EMAIL must be a real email address.');
  validatePassword(password);
  if(password.length<16)throw new Error('Use at least 16 characters for ADMIN_BOOTSTRAP_PASSWORD.');
  const id=await transaction(async c=>{
    const [done]=await rows(c,"SELECT setting_value FROM app_settings WHERE setting_key='primary_admin' FOR UPDATE");
    if(done)return null;
    const [existing]=await rows(c,'SELECT * FROM users WHERE email=? FOR UPDATE',[email]);
    if(existing&&existing.role!=='admin')throw new Error('Admin setup email already belongs to a non-admin account. Ask an existing administrator to grant access instead.');
    const id=existing?.id||randomUUID();
    if(!existing)await c.execute("INSERT INTO users (id,name,email,password_hash,role) VALUES (?,?,?,?,'admin')",[id,'Acadex Administrator',email,await bcrypt.hash(password,12)]);
    await c.execute("INSERT INTO app_settings (setting_key,setting_value) VALUES ('primary_admin',?)",[id]);
    return id;
  });
  if(id){
    const [user]=await query<any[]>('SELECT * FROM users WHERE id=?',[id]);
    if(!user.is_verified)try{await sendCode(user);}catch{console.error('Admin account created, but its email could not be sent. Sign in and use Resend Code to verify the mailbox.');}
    console.log('Main administrator provisioned. Remove ADMIN_BOOTSTRAP_PASSWORD after verifying the mailbox.');
  }
}
