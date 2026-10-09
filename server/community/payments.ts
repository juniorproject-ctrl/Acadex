import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import Stripe from 'stripe';
import type { PoolConnection } from 'mysql2/promise';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { query } from '../db';
import { ApiError,asyncHandler } from '../errors';
import { requireAuth } from '../middleware/auth';
import { notify,rows,transaction,userId,verified } from './shared';

export function paymentClient(){
  const key=process.env.STRIPE_SECRET_KEY;
  if(!key?.startsWith('sk_test_')||!process.env.STRIPE_WEBHOOK_SECRET)return null;
  return new Stripe(key,{timeout:10000,maxNetworkRetries:1});
}
function requiredClient(provider:()=>Stripe|null){const client=provider();if(!client)throw new ApiError(503,'Test payments are not configured. An administrator must add Stripe test keys and a webhook. No payment was taken.');return client;}
async function offer(connection:PoolConnection,kind:string,reference:string){
  if(kind==='listing'){
    const [item]=await rows(connection,'SELECT * FROM listings WHERE id=? FOR UPDATE',[reference]);
    if(!item)throw new ApiError(404,'Listing not found.');
    return {title:item.title,price:Number(item.price),seller:item.owner_id,available:item.status==='ACTIVE',buyer:null};
  }
  if(kind==='booking'){
    const [ref]=await rows(connection,'SELECT slot_id FROM tutor_bookings WHERE id=?',[reference]);
    if(!ref)throw new ApiError(404,'Booking not found.');
    const [slot]=await rows(connection,'SELECT * FROM tutor_slots WHERE id=? FOR UPDATE',[ref.slot_id]);
    const [booking]=await rows(connection,'SELECT * FROM tutor_bookings WHERE id=? FOR UPDATE',[reference]);
    return {title:'Tutoring session - '+new Date(slot.starts_at).toISOString(),price:Number(slot.price),seller:slot.tutor_id,buyer:booking.student_id,available:booking.status==='accepted'&&!slot.cancelled&&new Date(slot.starts_at)>new Date()};
  }
  throw new ApiError(400,'Choose a listing or accepted tutoring booking.');
}
function checkOffer(item:Awaited<ReturnType<typeof offer>>,buyer:string){
  if(item.buyer&&item.buyer!==buyer)throw new ApiError(404,'Booking not found.');
  if(item.seller===buyer)throw new ApiError(400,'You cannot pay yourself.');
  if(!item.available)throw new ApiError(409,'This item or booking is no longer available for payment.');
  if(!Number.isFinite(item.price)||item.price<2||item.price>100000)throw new ApiError(400,'Online checkout supports prices from AED 2 to AED 100,000.');
}
export async function reconcileSession(session:Stripe.Checkout.Session,client:Stripe){
  if(session.livemode)throw new ApiError(400,'Live payments are disabled.');
  const orderId=session.metadata?.orderId;if(!orderId)return;
  await transaction(async connection=>{
    const [ref]=await rows(connection,'SELECT * FROM payment_orders WHERE id=?',[orderId]);if(!ref)return;
    const item=await offer(connection,ref.kind,ref.reference_id).catch(error=>{if(error instanceof ApiError&&error.status===404)return {available:false};throw error;});
    const [order]=await rows(connection,'SELECT * FROM payment_orders WHERE id=? FOR UPDATE',[orderId]);
    if(order.checkout_session_id!==session.id)throw new ApiError(409,'Checkout session is not linked yet; retry.');
    if(order.status!=='pending')return;
    if(session.payment_status==='paid'){
      if(session.amount_total!==order.amount_minor||session.currency!==order.currency)throw new ApiError(400,'Payment amount or currency mismatch.');
      const intent=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
      if(!intent)throw new ApiError(400,'Payment intent is missing.');
      if(!item.available){
        await client.refunds.create({payment_intent:intent},{idempotencyKey:'unavailable-'+order.id});
        await connection.execute("UPDATE payment_orders SET status='refunded',payment_intent_id=? WHERE id=?",[intent,order.id]);
        await notify(connection,order.buyer_id,'Test payment refunded because the item/session became unavailable.','/payments');return;
      }
      await connection.execute("UPDATE payment_orders SET status='paid',payment_intent_id=? WHERE id=?",[intent,order.id]);
      if(order.kind==='listing')await connection.execute("UPDATE listings SET status='SOLD' WHERE id=?",[order.reference_id]);
      await notify(connection,order.buyer_id,'Test payment confirmed: '+order.title,'/payments');
      await notify(connection,order.seller_id,'Test payment received: '+order.title,'/payments');
    }else if(session.status==='expired')await connection.execute("UPDATE payment_orders SET status='expired' WHERE id=?",[order.id]);
  });
}
export async function refundBooking(connection:PoolConnection,bookingId:string,provider=paymentClient){
  const orders=await rows(connection,"SELECT * FROM payment_orders WHERE kind='booking' AND reference_id=? AND status='paid' FOR UPDATE",[bookingId]);
  for(const order of orders){
    await requiredClient(provider).refunds.create({payment_intent:order.payment_intent_id},{idempotencyKey:'cancel-booking-'+order.id});
    await connection.execute("UPDATE payment_orders SET status='refunded' WHERE id=?",[order.id]);
    await notify(connection,order.buyer_id,'Cancelled tutoring session: test payment refunded.','/payments');
  }
}
export function paymentWebhook(provider=paymentClient){return asyncHandler(async(req,res)=>{
  const client=requiredClient(provider);let event:Stripe.Event;
  try{event=client.webhooks.constructEvent(req.body,req.headers['stripe-signature'] as string,process.env.STRIPE_WEBHOOK_SECRET!);}catch{throw new ApiError(400,'Invalid webhook signature.');}
  if(event.livemode)throw new ApiError(400,'Live events are disabled.');
  if((await query<any[]>('SELECT id FROM payment_webhook_events WHERE id=?',[event.id])).length){res.json({received:true});return;}
  if(['checkout.session.completed','checkout.session.expired','checkout.session.async_payment_succeeded'].includes(event.type))await reconcileSession(event.data.object as Stripe.Checkout.Session,client);
  if(event.type==='charge.refunded'){
    const charge=event.data.object as Stripe.Charge;
    if(charge.refunded){
      const intent=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id;
      const linked=await query<any[]>('SELECT id FROM payment_orders WHERE payment_intent_id=?',[intent||'']);
      // Stripe may deliver a refund before checkout completion; retry after the order is linked.
      if(!linked.length)throw new ApiError(409,'Refund arrived before its checkout confirmation; retry.');
      await query("UPDATE payment_orders SET status='refunded' WHERE payment_intent_id=? AND status IN ('pending','paid')",[intent]);
    }
  }
  await query('INSERT IGNORE INTO payment_webhook_events (id) VALUES (?)',[event.id]);res.json({received:true});
});}
export function createPaymentRouter(provider=paymentClient){
  const router=Router();
  router.get('/config',(_req,res)=>res.json({configured:!!provider(),mode:'test',methods:['Visa','Mastercard','Apple Pay','Google Pay']}));
  router.use(requireAuth,verified);
  router.get('/offer',asyncHandler(async(req,res)=>{
    const item=await transaction(connection=>offer(connection,String(req.query.kind),String(req.query.reference)));checkOffer(item,userId(req));res.json({title:item.title,amount:item.price,currency:'AED'});
  }));
  router.get('/orders',asyncHandler(async(req,res)=>{
    const items=await query<any[]>('SELECT id,buyer_id AS buyerId,seller_id AS sellerId,kind,reference_id AS referenceId,title,amount_minor AS amountMinor,currency,status,created_at AS createdAt FROM payment_orders WHERE buyer_id=? OR seller_id=? ORDER BY created_at DESC LIMIT 100',[userId(req),userId(req)]);res.json({items});
  }));
  router.post('/checkout',rateLimit({windowMs:60000,limit:10}),asyncHandler(async(req,res)=>{
    const client=requiredClient(provider),kind=String(req.body.kind),reference=String(req.body.reference);
    const order=await transaction(async connection=>{
      const item=await offer(connection,kind,reference);checkOffer(item,userId(req));
      const active=await rows(connection,"SELECT * FROM payment_orders WHERE kind=? AND reference_id=? AND status IN ('pending','paid') FOR UPDATE",[kind,reference]);
      if(active.length){if(active[0].buyer_id===userId(req)&&active[0].status==='pending')return active[0];throw new ApiError(409,'This item is already paid for or reserved by another checkout.');}
      const id=randomUUID(),expires=new Date(Date.now()+31*60000),amount=Math.round(item.price*100);
      await connection.execute('INSERT INTO payment_orders (id,buyer_id,seller_id,kind,reference_id,title,amount_minor,expires_at) VALUES (?,?,?,?,?,?,?,?)',[id,userId(req),item.seller,kind,reference,item.title,amount,expires]);
      return {id,title:item.title,amount_minor:amount,expires_at:expires,checkout_session_id:null};
    });
    const origin=config.frontendOrigin.split(',')[0].trim();
    let session:Stripe.Checkout.Session;
    if(order.checkout_session_id)session=await client.checkout.sessions.retrieve(order.checkout_session_id);
    else{
      // A retry uses the same order and Stripe idempotency key, even after a network timeout.
      try{
        session=await client.checkout.sessions.create({mode:'payment',payment_method_types:['card'],metadata:{orderId:order.id},client_reference_id:order.id,line_items:[{price_data:{currency:'aed',unit_amount:order.amount_minor,product_data:{name:order.title}},quantity:1}],success_url:origin+'/payments?order='+order.id,cancel_url:origin+'/payments?order='+order.id,expires_at:Math.floor(new Date(order.expires_at).getTime()/1000)},{idempotencyKey:order.id});
      }catch(error){
        if(error instanceof Stripe.errors.StripeInvalidRequestError&&error.param==='expires_at')await query("UPDATE payment_orders SET status='expired' WHERE id=? AND checkout_session_id IS NULL",[order.id]);
        throw error;
      }
      await query('UPDATE payment_orders SET checkout_session_id=? WHERE id=?',[session.id,order.id]);
    }
    if(session.status!=='open'){await reconcileSession(session,client);throw new ApiError(409,'Checkout has completed or expired. Check your payments and start again if needed.');}
    if(!session.url?.startsWith('https://checkout.stripe.com/'))throw new ApiError(502,'The payment provider did not return a valid checkout link.');
    res.json({url:session.url,orderId:order.id});
  }));
  router.post('/orders/:id/refresh',asyncHandler(async(req,res)=>{
    const [order]=await query<any[]>('SELECT * FROM payment_orders WHERE id=? AND (buyer_id=? OR seller_id=?)',[req.params.id,userId(req),userId(req)]);
    if(!order)throw new ApiError(404,'Order not found.');
    if(order.checkout_session_id&&order.status==='pending'){const client=requiredClient(provider);await reconcileSession(await client.checkout.sessions.retrieve(order.checkout_session_id),client);}
    res.json({ok:true});
  }));
  router.post('/orders/:id/cancel',asyncHandler(async(req,res)=>{
    const [order]=await query<any[]>('SELECT * FROM payment_orders WHERE id=? AND buyer_id=?',[req.params.id,userId(req)]);
    if(!order||order.status!=='pending')throw new ApiError(409,'Only your pending checkout can be cancelled.');
    if(!order.checkout_session_id)throw new ApiError(409,'Retry checkout first so the provider can confirm its status.');
    const client=requiredClient(provider),session=await client.checkout.sessions.retrieve(order.checkout_session_id);
    await reconcileSession(session.status==='open'?await client.checkout.sessions.expire(session.id):session,client);res.json({ok:true});
  }));
  return router;
}
export default createPaymentRouter();
