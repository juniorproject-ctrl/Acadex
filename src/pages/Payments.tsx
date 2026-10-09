import { useEffect } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { CreditCard,RefreshCw } from 'lucide-react';
import { ActionStatus,CommunityPage,Empty,ErrorBox,useAction } from '../components/CommunityUI';
import { dateTime,mutate,useResource } from '../lib/community';
import { getCurrentUser } from '../lib/auth';

type Config={configured:boolean;mode:string;methods:string[]};
type Order={id:string;buyerId:string;sellerId:string;kind:string;referenceId:string;title:string;amountMinor:number;currency:string;status:string;createdAt:string};
export function Checkout(){
  const [params]=useSearchParams(),kind=params.get('kind')||'',reference=params.get('reference')||'',action=useAction();
  const offer=useResource<{title:string;amount:number;currency:string}>('/payments/offer?'+new URLSearchParams({kind,reference})),config=useResource<Config>('/payments/config');
  return <CommunityPage title="Checkout" showTabs={false}>
    <p className="success-box">Test mode only. No real purchases or payouts.</p><ErrorBox error={offer.error||config.error}/><ActionStatus action={action}/>
    {offer.loading?<Empty>Loading order...</Empty>:offer.data&&<section className="detail-intro"><h2>{offer.data.title}</h2><p className="text-2xl font-bold">AED {Number(offer.data.amount).toFixed(2)}</p><p><CreditCard size={23}/> Visa and Mastercard. Apple Pay and Google Pay appear on eligible devices through Stripe.</p><p className="muted">Card details are handled by Stripe, not stored by Acadex. Cash is not accepted.</p>{config.data&&!config.data.configured&&<p className="error-box">Test checkout is awaiting administrator setup. No payment can be taken yet.</p>}<button className="action-button" disabled={action.busy||!config.data?.configured} onClick={()=>void action.run(async()=>{const result=await mutate<{url:string}>('/payments/checkout',{kind,reference});window.location.assign(result.url);},'Opening secure test checkout...')}>Continue to test checkout</button><Link to="/payments" className="text-link">My payments</Link></section>}
  </CommunityPage>;
}
function OrderRow({order:o,onChange}:{order:Order;onChange:()=>void}){
  const action=useAction(),buyer=o.buyerId===getCurrentUser()?.id;
  return <article className="detail-row"><div><h2>{o.title}</h2><p>AED {(o.amountMinor/100).toFixed(2)} · {buyer?'Purchase':'Sale'} · <span className="status-badge">{o.status.replaceAll('_',' ')}</span></p><p className="muted">{dateTime(o.createdAt)} · Test transaction</p>{o.kind==='booking'&&<Link to="/dashboard" className="text-link">View booking</Link>}<ActionStatus action={action}/></div>{o.status==='pending'&&<div className="flex flex-col gap-2"><button title="Refresh payment status" className="secondary-button" disabled={action.busy} onClick={()=>void action.run(async()=>{await mutate(`/payments/orders/${o.id}/refresh`,{});onChange();},'Status refreshed.')}><RefreshCw size={16}/>Refresh</button>{buyer&&<><Link className="text-link" to={'/checkout?'+new URLSearchParams({kind:o.kind,reference:o.referenceId})}>Resume checkout</Link><button className="secondary-button" disabled={action.busy} onClick={()=>void action.run(async()=>{await mutate(`/payments/orders/${o.id}/cancel`,{});onChange();},'Checkout status updated.')}>Cancel checkout</button></>}</div>}</article>;
}
export default function Payments(){
  const [params]=useSearchParams(),order=params.get('order'),result=useResource<{items:Order[]}>('/payments/orders',10000),action=useAction();
  useEffect(()=>{if(order)void action.run(async()=>{await mutate(`/payments/orders/${order}/refresh`,{});result.reload();},'Payment status checked with Stripe.');},[order]);
  return <CommunityPage title="My Payments" showTabs={false}><p className="success-box">Test transactions only. No funds are paid to sellers or tutors.</p><ErrorBox error={result.error}/><ActionStatus action={action}/>{result.loading?<Empty>Loading payments...</Empty>:result.data?.items.length?result.data.items.map(o=><OrderRow key={o.id} order={o} onChange={result.reload}/>):!result.error&&<Empty>No payments yet.</Empty>}</CommunityPage>;
}
