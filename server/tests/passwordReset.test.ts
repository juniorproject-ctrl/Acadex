import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import express from 'express';
import {createPasswordResetRouter} from '../routes/passwordReset';
import {query,pool} from '../db';
import {createAccessToken} from '../auth';
import {requireAuth} from '../middleware/auth';
import {errorHandler} from '../errors';
import authRouter from '../routes/auth';
test('password recovery, rate boundaries, single-use codes and revoked sessions',{skip:process.env.RESET_INTEGRATION!=='1'},async t=>{
 const u={id:crypto.randomUUID(),name:'Reset test',email:crypto.randomUUID()+'@example.test',role:'student'},unknown=crypto.randomUUID()+'@example.test',unverified={...u,id:crypto.randomUUID(),email:crypto.randomUUID()+'@example.test'};
 let delivered='',count=0;
 const app=express();app.use(express.json());
 app.use('/auth',createPasswordResetRouter(async(_name,_email,code)=>{delivered=code;count++;}));
 app.use('/auth',authRouter);app.get('/private',requireAuth,(_req,res)=>res.json({ok:true}));app.use(errorHandler);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+(server.address() as any).port;
 const call=async(path:string,status:number,body?:unknown,token?:string)=>{
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;
 };
 try{
  for(const [person,verified] of [[u,true],[unverified,false]] as const)await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,?)',[person.id,person.name,person.email,await bcrypt.hash('OldPassword1!',12),person.role,verified]);
  const oldToken=createAccessToken(u);await call('/private',200,undefined,oldToken);
  await t.test('unknown and unverified accounts get the same response, without email',async()=>{
   const a=await call('/auth/forgot-password',200,{email:unknown}),b=await call('/auth/forgot-password',200,{email:unverified.email});
   assert.equal(a.message,b.message);assert.equal(count,0);
  });
  await t.test('sends only a hashed code and limits immediate resends',async()=>{
   await call('/auth/forgot-password',200,{email:u.email});assert.match(delivered,/^\d{6}$/);
   const [row]=await query<any[]>('SELECT code_hash FROM password_resets WHERE user_id=?',[u.id]);
   assert.notEqual(row.code_hash,delivered);assert.ok(await bcrypt.compare(delivered,row.code_hash));
   await call('/auth/forgot-password',200,{email:u.email});assert.equal(count,1);
  });
  await t.test('weak passwords and expired codes do not change the password',async()=>{
   await call('/auth/reset-password',400,{email:u.email,code:delivered,password:'short'});
   await query('UPDATE password_resets SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE user_id=?',[u.id]);
   await call('/auth/reset-password',400,{email:u.email,code:delivered,password:'NewPassword1!'});
   await query('UPDATE password_resets SET expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE) WHERE user_id=?',[u.id]);
  });
  await t.test('five incorrect attempts lock the code',async()=>{
   const wrong=delivered==='111111'?'222222':'111111';
   for(let n=0;n<5;n++)await call('/auth/reset-password',400,{email:u.email,code:wrong,password:'NewPassword1!'});
   await call('/auth/reset-password',400,{email:u.email,code:delivered,password:'NewPassword1!'});
   assert.equal((await query<any[]>('SELECT attempts FROM password_resets WHERE user_id=?',[u.id]))[0].attempts,5);
   await query('UPDATE password_resets SET attempts=0 WHERE user_id=?',[u.id]);
  });
  await t.test('successful reset is single-use and revokes existing sessions',async()=>{
   await call('/auth/reset-password',200,{email:u.email,code:delivered,password:'NewPassword1!'});
   await call('/auth/reset-password',400,{email:u.email,code:delivered,password:'OtherPassword2!'});
   await call('/private',401,undefined,oldToken);
   await call('/auth/login',401,{email:u.email,password:'OldPassword1!'});
   const login=await call('/auth/login',200,{email:u.email,password:'NewPassword1!'});
   await call('/private',200,undefined,login.token);
   assert.equal(login.user.role,'student');
  });
 }finally{
  await query('DELETE FROM users WHERE id IN (?,?)',[u.id,unverified.id]);
  await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();
 }
});
