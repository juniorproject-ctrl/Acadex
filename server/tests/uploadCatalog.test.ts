import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import {query,pool} from '../db';
import {config} from '../config';
import {createAccessToken} from '../auth';
import listings from '../routes/listings';
import {errorHandler} from '../errors';
import {MAX_LISTING_PHOTO_BYTES} from '../../src/lib/listingUploadRules';

test('upload size boundary and catalog baseline',{skip:process.env.UPLOAD_CATALOG_INTEGRATION!=='1'},async t=>{
 const user={id:randomUUID(),name:'Upload boundary test',email:randomUUID()+'@example.test',role:'student'};
 const app=express();app.use('/listings',listings);app.use(errorHandler);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const url='http://127.0.0.1:'+(server.address() as any).port+'/listings',files:string[]=[];
 try{
  await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[user.id,user.name,user.email,'disabled-test-password',user.role]);
  await t.test('server explains 5 MB failures and accepts the stated boundary',async()=>{
   for(const extra of [1,0]){
    const form=new FormData();form.set('status','draft');
    form.append('images',new Blob([Buffer.alloc(MAX_LISTING_PHOTO_BYTES+extra)],{type:'image/png'}),'boundary.png');
    const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+createAccessToken(user)},body:form});
    const data=await response.json();
    if(extra){assert.equal(response.status,400);assert.match(data.error,/5 MB/);}
    else{assert.equal(response.status,201,JSON.stringify(data));files.push(...data.listing.images);}
   }
  });
  await t.test('migration seeds an empty catalog and can repeat safely',async()=>{
   const c=await pool.getConnection();
   try{
    await c.query('CREATE TEMPORARY TABLE universities (id VARCHAR(80) PRIMARY KEY,name VARCHAR(200),website VARCHAR(500))');
    await c.query('CREATE TEMPORARY TABLE majors (id VARCHAR(100) PRIMARY KEY,university_id VARCHAR(80),name VARCHAR(200),source_url VARCHAR(500))');
    await c.query('CREATE TEMPORARY TABLE courses (id VARCHAR(120) PRIMARY KEY,university_id VARCHAR(80),code VARCHAR(30),name VARCHAR(240),source_url VARCHAR(500))');
    await c.query('CREATE TEMPORARY TABLE course_majors (course_id VARCHAR(120),major_id VARCHAR(100),PRIMARY KEY(course_id,major_id))');
    const sql=await fs.readFile('server/migrations/011_basic_upload_courses.sql','utf8');
    const statements=sql.split(/;\s*(?:\r?\n|$)/).map(s=>s.trim()).filter(Boolean);
    for(let run=0;run<2;run++)for(const statement of statements)await c.query(statement);
    const [counts]=await c.query<any[]>('SELECT university_id,COUNT(*) AS count FROM courses GROUP BY university_id');
    assert.equal(counts.length,4);for(const row of counts)assert.ok(row.count>=50);
    const [links]=await c.query<any[]>("SELECT c.id FROM courses c JOIN course_majors cm ON cm.course_id=c.id JOIN majors m ON m.id=cm.major_id WHERE c.name='Programming' AND m.name='Computer Science'");
    assert.equal(links.length,4);
   }finally{
    for(const table of ['course_majors','courses','majors','universities'])await c.query('DROP TEMPORARY TABLE IF EXISTS '+table);
    c.release();
   }
  });
 }finally{
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await query('DELETE FROM listings WHERE owner_id=?',[user.id]);await query('DELETE FROM users WHERE id=?',[user.id]);
  for(const file of files)await fs.unlink(path.join(config.uploadDirectory,path.basename(file))).catch(()=>{});
  await pool.end();
 }
});
