import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { query, pool } from '../db';
import { createAccessToken } from '../auth';
import { requireAuth } from '../middleware/auth';
import { verified } from '../community/shared';
import { errorHandler } from '../errors';
import messages from '../community/messages';
import listings from '../routes/listings';
import catalog from '../community/catalog';
import { paymentClient } from '../community/payments';

test('marketplace conversations, handover choices and catalog access', {skip: process.env.MARKETPLACE_INTEGRATION !== '1'}, async t => {
  const users = Array.from({length:3}, () => ({id:randomUUID(),name:'Marketplace test',email:randomUUID()+'@example.test',role:'student'}));
  const tokens = users.map(createAccessToken), listingId=randomUUID();
  const app=express(); app.use(express.json());
  app.use('/messages',messages); app.use(['/listings','/catalog'],requireAuth,verified); app.use('/listings',listings); app.use('/catalog',catalog); app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+(server.address() as any).port;
  const call=async(route:string,status:number,who:number|null=0,body?:unknown,method=body===undefined?'GET':'POST')=>{
    const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(who===null?{}:{Authorization:'Bearer '+tokens[who]})},body:body===undefined?undefined:JSON.stringify(body)});
    const data=response.status===204?null:await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;
  };
  let conversation='';
  try {
    for(const u of users)await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[u.id,u.name,u.email,'disabled-test-login',u.role]);
    await query("INSERT INTO listings (id,owner_id,title,description,price,category,item_condition,location,status) VALUES (?,?,?, ?,50,'Textbooks','Good','Sharjah','ACTIVE')",[listingId,users[1].id,'Marketplace test textbook','A textbook used only for automated testing.']);
    await query('INSERT INTO listing_images (id,listing_id,image_url,position) VALUES (?,?,?,0)',[randomUUID(),listingId,'/test-image.jpg']);
    await t.test('website data requires sign-in',async()=>{await call('/listings',401,null);await call('/catalog',401,null);await call('/messages',401,null);});
    await t.test('all four universities and related starter topics are available',async()=>{
      const data=await call('/catalog',200);
      for(const id of ['uos','aus','hct','cuca']) {
        assert.ok(data.universities.some((u:any)=>u.id===id));
        const major=data.majors.find((m:any)=>m.universityId===id && m.id.includes('-basic-'));assert.ok(major);
        assert.ok(data.courses.some((c:any)=>c.universityId===id && c.majorIds.includes(major.id)));
      }
    });
    await t.test('handover preferences persist and empty active choices are rejected',async()=>{
      await call('/listings/'+listingId,400,1,{pickupAvailable:false,sellerDelivery:false},'PATCH');
      const data=await call('/listings/'+listingId,200,1,{pickupAvailable:false,sellerDelivery:true},'PATCH');
      assert.equal(data.listing.pickupAvailable,false);assert.equal(data.listing.sellerDelivery,true);assert.equal(data.listing.condition,'Good');
    });
    await t.test('seller cannot message self and buyers reuse their own thread',async()=>{
      await call('/messages',400,1,{listingId});
      conversation=(await call('/messages',201,0,{listingId})).id;
      assert.equal((await call('/messages',201,0,{listingId})).id,conversation);
      const other=(await call('/messages',201,2,{listingId})).id;assert.notEqual(other,conversation);
    });
    await t.test('messages are private to the two participants',async()=>{
      await call('/messages/'+conversation,404,2);
      await call('/messages/'+conversation+'/messages',404,2,{body:'Cannot send into another thread'});
      await call('/messages/'+conversation+'/messages',400,0,{body:' '});
      await call('/messages/'+conversation+'/messages',201,0,{body:'Can we meet on campus?'});
      const received=await call('/messages/'+conversation,200,1);assert.equal(received.messages[0].body,'Can we meet on campus?');
      await call('/messages/'+conversation+'/messages',201,1,{body:'Yes, tomorrow afternoon.'});
      const inbox=await call('/messages',200,0);assert.equal(Number(inbox.items.find((c:any)=>c.id===conversation).unread),1);
      const thread=await call('/messages/'+conversation,200,0);
      await call('/messages/'+conversation+'/read',200,0,{lastId:thread.messages.at(-1).id});
      const read=await call('/messages',200,0);assert.equal(Number(read.items.find((c:any)=>c.id===conversation).unread),0);
    });
    await t.test('older messages paginate without losing access after listing deletion',async()=>{
      for(let n=0;n<52;n++)await query('INSERT INTO listing_messages (conversation_id,sender_id,body) VALUES (?,?,?)',[conversation,users[0].id,'History '+n]);
      const recent=await call('/messages/'+conversation,200);assert.equal(recent.messages.length,50);assert.equal(recent.hasMore,true);
      const older=await call('/messages/'+conversation+'?before='+recent.messages[0].id,200);assert.equal(older.messages.length,4);assert.equal(older.hasMore,false);
      await call('/listings/'+listingId,204,1,undefined,'DELETE');
      const preserved=await call('/messages/'+conversation,200);assert.equal(preserved.listingId,null);assert.equal(preserved.title,'Marketplace test textbook');
    });
    await t.test('live Stripe keys remain disabled without an approved payout integration',()=>{
      const key=process.env.STRIPE_SECRET_KEY;try{process.env.STRIPE_SECRET_KEY='sk_live_not_real';assert.equal(paymentClient(),null);}finally{if(key===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=key;}
    });
  } finally {
    for(const u of users)await query('DELETE FROM listing_conversations WHERE buyer_id=? OR seller_id=?',[u.id,u.id]);
    await query('DELETE FROM listings WHERE id=?',[listingId]);
    for(const u of users)await query('DELETE FROM users WHERE id=?',[u.id]);
    await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();
  }
});
