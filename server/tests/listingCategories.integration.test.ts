import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import {config} from '../config';
import {pool,query} from '../db';
import {createAccessToken} from '../auth';
import {errorHandler} from '../errors';
import {publicBrowsing} from '../middleware/publicBrowsing';
import listings from '../routes/listings';

const localDatabase=['localhost','127.0.0.1','[::1]'].includes(new URL(config.databaseUrl()).hostname);
test('new categories can be drafted, published, filtered and edited through the real API', {skip:process.env.CATEGORY_INTEGRATION!=='1'||!localDatabase}, async()=>{
  const user={id:randomUUID(),name:'Category QA',email:randomUUID()+'@example.test',role:'student'};
  const marker=randomUUID(),token=createAccessToken(user);
  const app=express();app.use(express.json());app.use('/api/listings',publicBrowsing,listings);app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+(server.address() as any).port;
  const call=async(path:string,status:number,body?:unknown,method=body?'POST':'GET')=>{
    const response=await fetch(base+'/api/listings'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;
  };
  try{
    await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[user.id,user.name,user.email,'disabled-test-login',user.role]);
    for(const category of ['Sports & Fitness','Art & Design','Musical Instruments','Clothing & Accessories','Home Essentials']){
      const created=await call('',201,{status:'draft',title:marker,description:'A temporary category test listing that is removed after verification.',price:25,category,condition:'New',location:'Sharjah',pickupAvailable:true});
      const id=created.listing.id;assert.equal(created.listing.category,category);
      await query('INSERT INTO listing_images (id,listing_id,image_url,position) VALUES (?,?,?,0)',[randomUUID(),id,'/assets/acadex-logo.png']);
      const published=await call('/'+id,200,{status:'active'},'PATCH');assert.equal(published.listing.category,category);
      const found=await call('?'+new URLSearchParams({category,search:marker}),200);assert.equal(found.total,1);assert.equal(found.listings[0].id,id);
      await call('/'+id,400,{category:'Unsupported QA category'},'PATCH');
      assert.equal((await call('/'+id,200)).listing.category,category);
    }
  }finally{
    await query('DELETE FROM listings WHERE owner_id=?',[user.id]);await query('DELETE FROM users WHERE id=?',[user.id]);
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await pool.end();
  }
});
