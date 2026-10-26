import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import express from 'express';
import bcrypt from 'bcrypt';
import {demoDefinitions,demoCredentials,demoId,syncDemoAccounts,checkDemoAccounts} from '../demoAccounts';
import {pool,query} from '../db';
import {createAccessToken} from '../auth';
import auth from '../routes/auth';
import {createAdminRouter} from '../community/admin';
import {errorHandler} from '../errors';

const sample=()=>Object.fromEntries(demoDefinitions.map(([key,role,name])=>[key,{email:key+'@acadex.example',password:randomBytes(24).toString('base64url'),role,name}]));
test('demo imports are restricted to predefined identities and strong private credentials',()=>{
 const accounts=sample();assert.equal(demoCredentials(accounts).length,6);
 assert.throws(()=>demoCredentials({...accounts,extra:{email:'someone@gmail.com',password:'DoNotPromoteThisUser!'}}));
 assert.throws(()=>demoCredentials({...accounts,student:{...accounts.student,email:'someone@gmail.com'}}));
 assert.throws(()=>demoCredentials({...accounts,student:{...accounts.student,password:'weak'}}));
 assert.equal(demoCredentials({...accounts,student:{...accounts.student,role:'admin'}}).find(a=>a.key==='student')?.role,'student');
});
test('demo synchronization and private administrator import',{skip:process.env.DEMO_ACCOUNT_INTEGRATION!=='1'},async t=>{
 const actor={id:randomUUID(),name:'Demo setup test administrator',email:randomUUID()+'@example.test',role:'admin'};
 const student={...actor,id:randomUUID(),email:randomUUID()+'@example.test',role:'student'};
 const password='IntegrationAdminPassword!123';
 const app=express();app.use(express.json());app.use('/auth',auth);app.use('/admin',createAdminRouter(async()=>{}));app.use(errorHandler);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+(server.address() as any).port;
 const call=async(route:string,status:number,token?:string,body?:unknown)=>{
  const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;
 };
 try{
  for(const u of [actor,student])await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[u.id,u.name,u.email,await bcrypt.hash(password,12),u.role]);
  await t.test('synchronization repairs hashes, is repeatable, and does not revive suspended accounts',async()=>{
   const c=await pool.getConnection();await c.beginTransaction();
   try{
    const accounts=sample();const first=await syncDemoAccounts(c,accounts);assert.equal(first.length,6);
    const second=await syncDemoAccounts(c,accounts);assert.ok(second.every(a=>a.status==='ready'));
    assert.ok((await checkDemoAccounts(c,accounts)).every(a=>a.loginReady&&a.passwordMatches));
    const mismatched=sample();mismatched.student=accounts.student;
    const checked=await checkDemoAccounts(c,mismatched);
    assert.deepEqual(checked.filter(a=>a.loginReady).map(a=>a.key),['student']);
    await syncDemoAccounts(c,mismatched);
    assert.ok((await checkDemoAccounts(c,mismatched)).every(a=>a.loginReady));
    await syncDemoAccounts(c,accounts);
    const [records]=await c.query<any[]>('SELECT password_hash,is_verified,role FROM users WHERE id=?',[demoId('student')]);
    assert.ok(await bcrypt.compare(accounts.student.password,records[0].password_hash));assert.equal(records[0].is_verified,1);assert.equal(records[0].role,'student');
    await c.execute('UPDATE users SET is_suspended=TRUE WHERE id=?',[demoId('student')]);
    await assert.rejects(()=>syncDemoAccounts(c,accounts),/closed or suspended/);
   }finally{await c.rollback();c.release();}
  });
  await t.test('anonymous users, students and incorrect admin passwords cannot import accounts',async()=>{
   const input={accounts:sample(),currentPassword:password,confirmed:true};
   await call('/admin/demo-accounts',401,undefined,input);
   await call('/admin/demo-accounts',403,createAccessToken(student),input);
   await call('/admin/demo-accounts',400,createAccessToken(actor),{...input,currentPassword:'wrong'});
   await call('/admin/demo-accounts/disable',400,createAccessToken(actor),{currentPassword:'wrong'});
   await call('/admin/demo-accounts/check',401,undefined,input);
   await call('/admin/demo-accounts/check',403,createAccessToken(student),input);
   await call('/admin/demo-accounts/check',400,createAccessToken(actor),{...input,currentPassword:'wrong'});
  });
  await t.test('the existing private file works through import and all six normal logins',async sub=>{
   let accounts:any;
   try{accounts=JSON.parse(await fs.readFile('.demo-accounts.local.json','utf8'));}catch{ sub.skip('Private local credential file is not available.');return;}
   const imported=await call('/admin/demo-accounts',200,createAccessToken(actor),{accounts,currentPassword:password,confirmed:true});
   assert.equal(imported.accounts.length,6);assert.ok(imported.accounts.every((a:any)=>!('password' in a)));
   assert.ok(imported.accounts.every((a:any)=>a.loginReady&&a.passwordMatches));
   const checked=await call('/admin/demo-accounts/check',200,createAccessToken(actor),{accounts,currentPassword:password});
   assert.ok(checked.accounts.every((a:any)=>a.loginReady));
   assert.ok(!Object.values(accounts).some((a:any)=>JSON.stringify(checked).includes(a.password)),'Credential-check responses must not include passwords.');
   for(const [key,role] of demoDefinitions){const result=await call('/auth/login',200,undefined,{email:accounts[key].email,password:accounts[key].password});assert.equal(result.user.role,role);}
  });
 }finally{
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await query('DELETE FROM admin_audit WHERE actor_id=?',[actor.id]);
  for(const u of [actor,student])await query('DELETE FROM users WHERE id=?',[u.id]);
  await pool.end();
 }
});
