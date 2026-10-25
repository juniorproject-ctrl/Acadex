import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import express from 'express';
import {query,pool} from '../db';
import {createAccessToken} from '../auth';
import account from '../community/account';
import auth from '../routes/auth';
import reports from '../community/reports';
import support from '../community/support';
import listings from '../routes/listings';
import {createAdminRouter} from '../community/admin';
import {errorHandler} from '../errors';
import {bootstrapAdmin} from '../bootstrapAdmin';

test('account security, private admin access and support',{skip:process.env.ACCOUNT_ADMIN_INTEGRATION!=='1'},async t=>{
 const password='OriginalPassword1!',newPassword='ChangedPassword2!';
 const users=['admin','admin','student','student','student'].map(role=>({id:randomUUID(),name:'Account integration',email:randomUUID()+'@example.test',role}));
 const tokens=users.map(createAccessToken),listing=randomUUID(),pendingOrder=randomUUID(),contactIds:string[]=[],reportIds:string[]=[];
 const app=express();app.use(express.json());
 const deliveries:{email:string;subject:string;body:string}[]=[];
 app.use('/admin',createAdminRouter(async(email,subject,body)=>{deliveries.push({email,subject,body});}));app.use('/account',account);app.use('/auth',auth);app.use('/reports',reports);app.use('/support',support);app.use('/listings',listings);app.use(errorHandler);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+(server.address() as any).port;
 const call=async(route:string,status:number,who:number|null,body?:any,method=body===undefined?'GET':'POST')=>{
  const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(who===null?{}:{Authorization:'Bearer '+tokens[who]})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json();assert.equal(r.status,status,JSON.stringify({route,data}));return data;
 };
 let bootId='',groupId='';
 const oldNotification=process.env.ADMIN_NOTIFICATION_EMAIL;delete process.env.ADMIN_NOTIFICATION_EMAIL;
 try{
  for(const u of users)await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[u.id,u.name,u.email,await bcrypt.hash(password,12),u.role]);
  await t.test('ordinary users cannot access administrator endpoints',async()=>{
   await call('/admin/users',401,null);await call('/admin/users',403,2);await call('/admin/listings',403,2);
   await call('/admin/users/'+users[2].id,403,2,{role:'admin',suspended:false,currentPassword:password,reason:'Attempt to escalate'},'PATCH');
  });
  await t.test('password changes require the current password and revoke old tokens',async()=>{
   await call('/account/security/password',400,2,{currentPassword:'wrong',password:newPassword});
   await call('/account/security/password',400,2,{currentPassword:password,password:'short'});
   await call('/account/security/password',200,2,{currentPassword:password,password:newPassword});
   await call('/account/dashboard',401,2);
   await call('/auth/login',401,null,{email:users[2].email,password});
   const signed=await call('/auth/login',200,null,{email:users[2].email,password:newPassword});tokens[2]=signed.token;
   await call('/account/dashboard',200,2);
   await call('/account/security/sign-out-all',200,2,{currentPassword:newPassword});await call('/account/dashboard',401,2);
   tokens[2]=(await call('/auth/login',200,null,{email:users[2].email,password:newPassword})).token;
  });
  await t.test('admins can moderate listings with reasons and an audit trail',async()=>{
   await query("INSERT INTO listings (id,owner_id,title,description,price,category,item_condition,location,status) VALUES (?,?,'Admin integration listing','Testing moderation and payment protections',50,'Textbooks','Good','Sharjah','ACTIVE')",[listing,users[2].id]);
   await call('/admin/listings/'+listing,200,0,{hidden:true,reason:'Misleading content reported'},'PATCH');
   await call('/listings/'+listing,404,2);
   await call('/admin/listings/'+listing,200,0,{hidden:false,reason:'Content reviewed and corrected'},'PATCH');
   await call('/listings/'+listing,200,2);
   await query("INSERT INTO payment_orders (id,buyer_id,seller_id,kind,reference_id,title,amount_minor,expires_at) VALUES (?,?,?,'listing',?,'Test order',5000,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))",[pendingOrder,users[4].id,users[2].id,listing]);
   await call('/admin/listings/'+listing,409,0,{reason:'Cannot erase a pending order'},'DELETE');
  });
  await t.test('suspension revokes access and administrative changes need a password',async()=>{
   await call('/admin/users/'+users[3].id,400,0,{role:'student',suspended:true,currentPassword:'wrong',reason:'Reported misconduct'},'PATCH');
   await call('/admin/users/'+users[3].id,200,0,{role:'student',suspended:true,currentPassword:password,reason:'Reported misconduct'},'PATCH');
   await call('/account/dashboard',401,3);await call('/auth/login',403,null,{email:users[3].email,password});
   await call('/admin/users/'+users[3].id,200,0,{role:'student',suspended:false,currentPassword:password,reason:'Review completed'},'PATCH');
   tokens[3]=(await call('/auth/login',200,null,{email:users[3].email,password})).token;
   await call('/admin/users/'+users[0].id,400,0,{role:'student',suspended:true,currentPassword:password,reason:'Do not remove own admin access'},'PATCH');
  });
  await t.test('report replies reach only the reporting account',async()=>{
   await call('/reports',201,2,{subject:'Account integration report',details:'Testing administrator reply visibility.'});
   const [r]=await query<any[]>('SELECT id FROM reports WHERE reporter_id=?',[users[2].id]);reportIds.push(r.id);
   await call('/reports/'+r.id+'/reply',403,3,{body:'An unauthorised reply'});
   await call('/reports/'+r.id+'/reply',201,0,{body:'We have reviewed your report. Thank you.'});
   const mine=await call('/reports/mine',200,2);assert.equal(mine.items[0].replies.length,1);
   const other=await call('/reports/mine',200,3);assert.equal(other.items.length,0);
  });
  await t.test('anonymous contact requests are private and admin replies use stored email',async()=>{
   const email=randomUUID()+'@example.test';
   await call('/support',400,null,{name:'Test',email:'invalid',subject:'Help please',message:'A support request with an invalid email.'});
   await call('/support',201,null,{name:'Test',email,subject:'Contact integration',message:'Please help with signing into my account.'});
   const [item]=await query<any[]>('SELECT id FROM support_messages WHERE email=?',[email]);contactIds.push(item.id);
   await call('/admin/support',403,2);
   await call('/admin/support/'+item.id+'/reply',200,0,{body:'Please try the password reset page.',email:'ignore@example.test'});
   assert.equal(deliveries[0].email,email);assert.ok(deliveries[0].body.includes('password reset'));
  });
  await t.test('deletion blocks pending payments then removes credentials and profile identifiers',async()=>{
   await call('/account/security',409,4,{currentPassword:password,confirmation:'DELETE'},'DELETE');
   await query('DELETE FROM payment_orders WHERE id=?',[pendingOrder]);
   await call('/account/security',400,4,{currentPassword:password,confirmation:'delete'},'DELETE');
   await call('/account/security',400,4,{currentPassword:'wrong',confirmation:'DELETE'},'DELETE');
   await call('/account/security',200,4,{currentPassword:password,confirmation:'DELETE'},'DELETE');
   const [deleted]=await query<any[]>('SELECT * FROM users WHERE id=?',[users[4].id]);
   assert.equal(deleted.password_hash,null);assert.equal(deleted.name,'Deleted user');assert.notEqual(deleted.email,users[4].email);assert.ok(deleted.deleted_at);
   await call('/account/dashboard',401,4);await call('/auth/login',401,null,{email:users[4].email,password});
  });
  await t.test('administrators can transfer and remove study groups with an audit trail',async()=>{
   const [course]=await query<any[]>("SELECT id FROM courses WHERE university_id='uos' LIMIT 1");
   assert.ok(course);
   groupId=randomUUID();
   await query("INSERT INTO study_groups (id,owner_id,university_id,course_id,title,description) VALUES (?,?,'uos',?,'Admin transfer test','Testing group ownership moderation.')",[groupId,users[2].id,course.id]);
   await query('INSERT INTO group_members (group_id,user_id) VALUES (?,?)',[groupId,users[2].id]);
   await call('/admin/groups/'+groupId+'/transfer',403,2,{ownerId:users[3].id,reason:'Testing denied transfer'});
   await call('/admin/groups/'+groupId+'/transfer',200,0,{ownerId:users[3].id,reason:'Owner requested group transfer'});
   const [group]=await query<any[]>('SELECT owner_id FROM study_groups WHERE id=?',[groupId]);assert.equal(group.owner_id,users[3].id);
   const items=await call('/admin/content/groups',200,0);assert.ok(items.items.some((item:any)=>item.id===groupId));
   await call('/admin/content/groups/'+groupId,200,0,{reason:'Testing content removal'},'DELETE');
   assert.equal((await query<any[]>('SELECT id FROM study_groups WHERE id=?',[groupId])).length,0);groupId='';
  });
  await t.test('private bootstrap is one-time and does not bypass email verification',async sub=>{
   const [existing]=await query<any[]>("SELECT * FROM app_settings WHERE setting_key='primary_admin'");
   if(existing){sub.skip('A main admin is already configured.');return;}
   const oldEmail=process.env.ADMIN_BOOTSTRAP_EMAIL,oldPassword=process.env.ADMIN_BOOTSTRAP_PASSWORD;
   try{
    process.env.ADMIN_BOOTSTRAP_EMAIL=randomUUID()+'@example.test';process.env.ADMIN_BOOTSTRAP_PASSWORD='BootstrapPassword!123';
    let sent=0;await bootstrapAdmin(async()=>{sent++;});await bootstrapAdmin(async()=>{sent++;});
    assert.equal(sent,1);const [created]=await query<any[]>('SELECT * FROM users WHERE email=?',[process.env.ADMIN_BOOTSTRAP_EMAIL]);bootId=created.id;
    assert.equal(created.role,'admin');assert.equal(created.is_verified,0);assert.ok(await bcrypt.compare(process.env.ADMIN_BOOTSTRAP_PASSWORD,created.password_hash));
   }finally{
    if(oldEmail===undefined)delete process.env.ADMIN_BOOTSTRAP_EMAIL;else process.env.ADMIN_BOOTSTRAP_EMAIL=oldEmail;
    if(oldPassword===undefined)delete process.env.ADMIN_BOOTSTRAP_PASSWORD;else process.env.ADMIN_BOOTSTRAP_PASSWORD=oldPassword;
   }
  });
 }finally{
  if(groupId)await query('DELETE FROM study_groups WHERE id=?',[groupId]);
  for(const id of contactIds)await query('DELETE FROM support_messages WHERE id=?',[id]);
  for(const id of reportIds)await query('DELETE FROM reports WHERE id=?',[id]);
  await query('DELETE FROM payment_orders WHERE id=?',[pendingOrder]);
  await query('DELETE FROM listings WHERE id=?',[listing]);
  for(const u of users){await query('DELETE FROM admin_audit WHERE actor_id=?',[u.id]);await query('DELETE FROM users WHERE id=?',[u.id]);}
  if(bootId){await query("DELETE FROM app_settings WHERE setting_key='primary_admin' AND setting_value=?",[bootId]);await query('DELETE FROM users WHERE id=?',[bootId]);}
  if(oldNotification===undefined)delete process.env.ADMIN_NOTIFICATION_EMAIL;else process.env.ADMIN_NOTIFICATION_EMAIL=oldNotification;
  await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();
 }
});
