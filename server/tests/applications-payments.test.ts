import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import Stripe from 'stripe';
import { query,pool } from '../db';
import { createAccessToken } from '../auth';
import { errorHandler } from '../errors';
import applications from '../community/applications';
import account from '../community/account';
import listings from '../routes/listings';
import { createPaymentRouter,paymentWebhook,refundBooking } from '../community/payments';
import { transaction } from '../community/shared';

test('private tutor applications and test-payment lifecycle',{skip:process.env.COMMERCE_INTEGRATION!=='1'},async t=>{
  const users=['student','student','admin','tutor'].map(role=>({id:randomUUID(),name:'Test '+role,email:randomUUID()+'@example.test',role}));
  const tokens=users.map(createAccessToken),listing=randomUUID(),listing2=randomUUID(),slot=randomUUID(),booking=randomUUID();
  let applicationId='';const documents:string[]=[],events:string[]=[];
  const stripe=new Stripe('sk_test_fake'),sessions=new Map<string,any>(),refunds=new Set<string>();
  const fake={webhooks:stripe.webhooks,checkout:{sessions:{
    create:async(body:any,options:any)=>{const existing=[...sessions.values()].find(s=>s.metadata.orderId===options.idempotencyKey);if(existing)return existing;const id='cs_test_'+randomUUID(),session={id,url:'https://checkout.stripe.com/c/pay/'+id,metadata:body.metadata,livemode:false,status:'open',payment_status:'unpaid',currency:'aed',amount_total:body.line_items[0].price_data.unit_amount,payment_intent:'pi_'+randomUUID()};sessions.set(id,session);return session;},
    retrieve:async(id:string)=>sessions.get(id),
    expire:async(id:string)=>{const session=sessions.get(id);session.status='expired';return session;},
  }},refunds:{create:async(_body:any,options:any)=>{refunds.add(options.idempotencyKey);return {id:'re_test',status:'succeeded'};}}} as unknown as Stripe;
  const previousSecret=process.env.STRIPE_WEBHOOK_SECRET;process.env.STRIPE_WEBHOOK_SECRET='whsec_integration_test';
  const app=express();app.post('/api/payments/webhook',express.raw({type:'application/json'}),paymentWebhook(()=>fake));app.use(express.json());app.use('/api/tutor-applications',applications);app.use('/api/payments',createPaymentRouter(()=>fake));app.use('/api/account',account);app.use('/api/listings',listings);app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+(server.address() as any).port+'/api';
  async function call(route:string,who:number|null,body?:any,method=body===undefined?'GET':'POST'){
    const response=await fetch(base+route,{method,headers:{...(who!==null?{Authorization:'Bearer '+tokens[who]}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
    const data=response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text();return {status:response.status,data};
  }
  const expect=async(route:string,who:number|null,status:number,body?:any,method?:string)=>{const result=await call(route,who,body,method);assert.equal(result.status,status,JSON.stringify(result));return result.data;};
  const form=()=>({universityId:'uos',subjects:'Algorithms',experience:'Teaching algorithms and exam preparation for university students.',applicantType:'senior_student',teachingMode:'online',academicTitle:'Final-year student',consent:'true'});
  async function webhook(session:any,type='checkout.session.completed',id='evt_'+randomUUID(),valid=true){
    events.push(id);const payload=JSON.stringify({id,type,livemode:false,data:{object:session}}),signature=stripe.webhooks.generateTestHeaderString({payload,secret:valid?'whsec_integration_test':'wrong'});
    return fetch(base+'/payments/webhook',{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':signature},body:payload});
  }
  try{
    for(const user of users)await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[user.id,user.name,user.email,'disabled-test-account',user.role]);
    await t.test('academic applications require no documents and enforce reviewer access',async()=>{
      await expect('/tutor-applications',null,401,form());
      await expect('/tutor-applications',0,400,{...form(),academicTitle:''});
      await expect('/tutor-applications',0,201,form());
      const mine=await expect('/tutor-applications/mine',0,200);applicationId=mine.application.id;
      assert.equal(mine.application.status,'pending');assert.equal(mine.application.permit_file,undefined);
      await expect('/tutor-applications',0,409,form());
      await expect('/tutor-applications',0,403);
      await expect(`/tutor-applications/${applicationId}/review`,0,403,{decision:'approved',reason:'Cannot self approve',confirmed:true},'PATCH');
      await expect(`/tutor-applications/${applicationId}/review`,2,400,{decision:'approved',reason:'Reviewed background'},'PATCH');
    });
    await t.test('decline, resubmission and approval are durable and cannot be repeated',async()=>{
      await expect(`/tutor-applications/${applicationId}/review`,2,200,{decision:'declined',reason:'Please describe your academic background.',confirmed:true},'PATCH');
      let [user]=await query<any[]>('SELECT role FROM users WHERE id=?',[users[0].id]);assert.equal(user.role,'student');
      await expect('/tutor-applications',0,201,form());
      await expect(`/tutor-applications/${applicationId}/review`,2,200,{decision:'approved',reason:'Academic background reviewed; test only.',confirmed:true},'PATCH');
      [user]=await query<any[]>('SELECT role FROM users WHERE id=?',[users[0].id]);assert.equal(user.role,'tutor');
      await expect(`/tutor-applications/${applicationId}/review`,2,409,{decision:'declined',reason:'Second review',confirmed:true},'PATCH');
      const notifications=await expect('/account/notifications',0,200);assert.ok(notifications.items.some((n:any)=>n.title.includes('approved')));
    });
    await t.test('withdrawal preserves application history',async()=>{
      await expect('/tutor-applications',1,201,form());
      await expect('/tutor-applications/mine',1,200,undefined,'DELETE');
      const mine=await expect('/tutor-applications/mine',1,200);assert.equal(mine.application.status,'withdrawn');
    });
    for(const id of [listing,listing2])await query("INSERT INTO listings (id,owner_id,title,description,price,category,item_condition,location,status) VALUES (?,?,?,?,100.50,'Textbooks','Good','Sharjah','ACTIVE')",[id,users[3].id,'Test listing','A test item for payment integrity.']);
    await t.test('server prices, reservations, signatures and duplicate events',async()=>{
      await expect('/payments/checkout',null,401,{kind:'listing',reference:listing});
      await expect('/payments/checkout',3,400,{kind:'listing',reference:listing});
      const checkout=await expect('/payments/checkout',0,200,{kind:'listing',reference:listing,amount:1});
      const again=await expect('/payments/checkout',0,200,{kind:'listing',reference:listing});assert.equal(checkout.orderId,again.orderId);assert.equal(sessions.size,1);
      await expect('/payments/checkout',1,409,{kind:'listing',reference:listing});
      await expect('/listings/'+listing,3,409,{},'PATCH');
      await expect('/listings/'+listing,3,409,undefined,'DELETE');
      await expect('/payments/orders/'+checkout.orderId+'/refresh',1,404,{});
      const session=[...sessions.values()][0];assert.equal(session.amount_total,10050);session.status='complete';session.payment_status='paid';
      const refundEvent='evt_'+randomUUID(),charge={payment_intent:session.payment_intent,refunded:true};
      assert.equal((await webhook(charge,'charge.refunded',refundEvent)).status,409);
      assert.equal((await webhook(session,undefined,undefined,false)).status,400);
      assert.equal((await webhook({...session,amount_total:1})).status,400);
      const eventId='evt_'+randomUUID();assert.equal((await webhook(session,undefined,eventId)).status,200);assert.equal((await webhook(session,undefined,eventId)).status,200);
      assert.equal((await webhook({...session,status:'expired',payment_status:'unpaid'},'checkout.session.expired')).status,200);
      const [order]=await query<any[]>('SELECT * FROM payment_orders WHERE id=?',[checkout.orderId]);assert.equal(order.status,'paid');
      const [item]=await query<any[]>('SELECT status FROM listings WHERE id=?',[listing]);assert.equal(item.status,'SOLD');
      assert.equal((await webhook(charge,'charge.refunded',refundEvent)).status,200);
      const [refunded]=await query<any[]>('SELECT status FROM payment_orders WHERE id=?',[checkout.orderId]);assert.equal(refunded.status,'refunded');
      const other=await expect('/payments/orders',1,200);assert.equal(other.items.length,0);
    });
    await t.test('cancelling checkout releases its reservation',async()=>{
      const checkout=await expect('/payments/checkout',0,200,{kind:'listing',reference:listing2});
      await expect('/payments/orders/'+checkout.orderId+'/cancel',1,409,{});
      await expect('/payments/orders/'+checkout.orderId+'/cancel',0,200,{});
      const next=await expect('/payments/checkout',1,200,{kind:'listing',reference:listing2});assert.notEqual(next.orderId,checkout.orderId);
      await expect('/payments/orders/'+next.orderId+'/cancel',1,200,{});
    });
    await query("INSERT INTO tutor_profiles (user_id,university_id,subjects,bio,hourly_rate) VALUES (?,'uos','Algorithms','Test tutor biography for payments',100)",[users[3].id]);
    await query('INSERT INTO tutor_slots (id,tutor_id,starts_at,ends_at,price) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 2 DAY),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 49 HOUR),100)',[slot,users[3].id]);
    await query("INSERT INTO tutor_bookings (id,slot_id,student_id,status,note,meeting_url) VALUES (?,?,?,'accepted','','https://example.com/test-meeting')",[booking,slot,users[0].id]);
    await t.test('meeting unlocks only after verified payment and cancellation refunds once',async()=>{
      let dashboard=await expect('/account/dashboard',0,200);assert.equal(dashboard.bookings[0].meetingUrl,null);
      await expect('/payments/checkout',1,404,{kind:'booking',reference:booking});
      const checkout=await expect('/payments/checkout',0,200,{kind:'booking',reference:booking});
      const session=[...sessions.values()].find(s=>s.metadata.orderId===checkout.orderId);session.status='complete';session.payment_status='paid';
      await expect('/payments/orders/'+checkout.orderId+'/refresh',0,200,{});
      dashboard=await expect('/account/dashboard',0,200);assert.equal(dashboard.bookings[0].meetingUrl,'https://example.com/test-meeting');
      await transaction(c=>refundBooking(c,booking,()=>fake));await transaction(c=>refundBooking(c,booking,()=>fake));assert.equal(refunds.size,1);
      dashboard=await expect('/account/dashboard',0,200);assert.equal(dashboard.bookings[0].meetingUrl,null);assert.equal(dashboard.bookings[0].paymentStatus,'refunded');
    });
  }finally{
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    for(const event of events)await query('DELETE FROM payment_webhook_events WHERE id=?',[event]);
    for(const user of users)await query('DELETE FROM payment_orders WHERE buyer_id=? OR seller_id=?',[user.id,user.id]);
    await query('DELETE FROM tutor_bookings WHERE id=?',[booking]);await query('DELETE FROM tutor_slots WHERE id=?',[slot]);await query('DELETE FROM tutor_profiles WHERE user_id=?',[users[3].id]);
    for(const id of [listing,listing2])await query('DELETE FROM listings WHERE id=?',[id]);
    for(const user of users)await query('DELETE FROM tutor_applications WHERE user_id=?',[user.id]);
    for(const user of users)await query('DELETE FROM users WHERE id=?',[user.id]);
    for(const file of documents)await fs.unlink(path.resolve('private-tutor-documents',file)).catch(()=>{});
    if(previousSecret===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;else process.env.STRIPE_WEBHOOK_SECRET=previousSecret;
    await pool.end();
  }
});
