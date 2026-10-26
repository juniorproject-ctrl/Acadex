import {createHash} from 'node:crypto';
import bcrypt from 'bcrypt';
import type {PoolConnection} from 'mysql2/promise';
import {ApiError} from './errors';
import {rows} from './community/shared';

export const demoDefinitions=[
 ['admin','admin','Sample Administrator'],['student','student','Sample Student'],['leader','leader','Sample Group Leader'],
 ['tutor','tutor','Sample Algorithms Tutor'],['math-tutor','tutor','Sample Calculus Tutor'],['english-tutor','tutor','Sample English Tutor']
] as const;
export function demoId(key:string){
 const h=createHash('sha256').update('acadex-demo-v1:'+key).digest('hex');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32);
}
export function demoCredentials(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ApiError(400,'Choose the private demo-account JSON file.');
 const record=input as Record<string,any>;
 if(Object.keys(record).length!==demoDefinitions.length||Object.keys(record).some(key=>!demoDefinitions.some(([name])=>name===key)))throw new ApiError(400,'The file must contain only the six predefined demo accounts.');
 return demoDefinitions.map(([key,role,name])=>{
  const account=record[key],email=key+'@acadex.example';
  if(!account||account.email!==email||typeof account.password!=='string'||account.password.length<20||Buffer.byteLength(account.password,'utf8')>72)throw new ApiError(400,'Each predefined demo account needs its expected email and a private password of 20 to 72 bytes.');
  return {id:demoId(key),key,email,password:account.password,role,name};
 });
}
export async function syncDemoAccounts(connection:PoolConnection,input:unknown){
 const accounts=demoCredentials(input),result:{email:string;role:string;status:string}[]=[];
 for(const account of accounts){
  const records=await rows(connection,'SELECT * FROM users WHERE id=? OR email=? FOR UPDATE',[account.id,account.email]);
  if(records.some(user=>user.id!==account.id||user.email!==account.email))throw new ApiError(409,'A demo identity conflicts with another account. No accounts were changed.');
  const user=records[0];
  if(user&&(user.deleted_at||user.is_suspended))throw new ApiError(409,'A demo account is closed or suspended. An administrator must review it before it can be used.');
  if(!user){
   await connection.execute('INSERT INTO users (id,name,email,password_hash,role,is_verified,verified_at) VALUES (?,?,?,?,?,TRUE,UTC_TIMESTAMP())',[account.id,account.name,account.email,await bcrypt.hash(account.password,12),account.role]);
   result.push({email:account.email,role:account.role,status:'created'});
  }else{
   const matches=user.password_hash&&await bcrypt.compare(account.password,user.password_hash);
   const changed=!matches||user.role!==account.role||!user.is_verified;
   if(changed)await connection.execute('UPDATE users SET password_hash=?,role=?,is_verified=TRUE,verified_at=COALESCE(verified_at,UTC_TIMESTAMP()),session_version=session_version+1 WHERE id=?',[matches?user.password_hash:await bcrypt.hash(account.password,12),account.role,account.id]);
   result.push({email:account.email,role:account.role,status:changed?'updated':'ready'});
  }
 }
 return result;
}
export async function checkDemoAccounts(connection:PoolConnection,input:unknown){
 const accounts=demoCredentials(input),result:{key:string;email:string;role:string;status:string;passwordMatches:boolean;loginReady:boolean}[]=[];
 for(const account of accounts){
  const [user]=await rows(connection,'SELECT * FROM users WHERE email=?',[account.email]);
  const passwordMatches=!!user?.password_hash&&await bcrypt.compare(account.password,user.password_hash);
  const status=!user?'Not created':user.deleted_at?'Closed':user.is_suspended?'Disabled':!user.is_verified?'Email unverified':!passwordMatches?'Password differs from selected file':user.id!==account.id||user.role!==account.role?'Account identity or role differs':'Password verified';
  result.push({key:account.key,email:account.email,role:user?.role||account.role,status,passwordMatches,loginReady:status==='Password verified'});
 }
 return result;
}
