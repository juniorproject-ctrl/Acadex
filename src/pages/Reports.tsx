import { useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { ActionStatus,CommunityPage,Empty,ErrorBox,Field,Submit,useAction } from '../components/CommunityUI';
import { formValues,mutate,useResource } from '../lib/community';
import { useCurrentUser } from '../lib/auth';
type Report={id:string;subject:string;details:string;reporter:string;status:string;resolution:string};
function Review({report:r,reload}:{report:Report;reload:()=>void}){
 const action=useAction();
 return <article className="detail-section"><h2>{r.subject}</h2><p>{r.reporter} · {r.status}</p><p className="preserve-lines">{r.details}</p><form className="editor-form" onSubmit={e=>{e.preventDefault();const body=formValues(e.currentTarget);void action.run(async()=>{await mutate('/reports/'+r.id,body,'PATCH');reload();},'Review saved.');}}><Field label="Status"><select name="status" defaultValue={r.status}><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></Field><Field label="Review notes"><textarea name="resolution" defaultValue={r.resolution} required minLength={5} maxLength={2000}/></Field><Submit busy={action.busy}>Save review</Submit><ActionStatus action={action}/></form></article>;
}
export function AdminDashboard(){
 const user=useCurrentUser(),reports=useResource<{items:Report[]}>(user?.role==='admin'?'/reports':null,15000),applications=useResource<{items:unknown[]}>(user?.role==='admin'?'/tutor-applications?status=pending':null,15000);
 const [filter,setFilter]=useState('open');
 if(user?.role!=='admin')return <CommunityPage title="Administration" showTabs={false}><Empty>Administrator access required.</Empty></CommunityPage>;
 return <CommunityPage title="Admin Dashboard" showTabs={false}><section className="detail-section"><h2>Tutor applications</h2><p>{applications.data?.items.length??0} awaiting review</p><Link className="text-link" to="/admin/tutor-applications">Review applications</Link></section><section className="detail-section"><h2>Complaints and reports</h2><Field label="Report status"><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="all">All</option></select></Field><ErrorBox error={reports.error}/>{reports.loading?<Empty>Loading reports...</Empty>:reports.data?.items.filter(r=>filter==='all'||r.status===filter).map(r=><Review key={r.id} report={r} reload={reports.reload}/>)}{reports.data&&!reports.data.items.some(r=>filter==='all'||r.status===filter)&&<Empty>No reports in this status.</Empty>}</section></CommunityPage>;
}
export default function ReportForm(){
 const action=useAction(),[params]=useSearchParams();
 return <CommunityPage title="Report a Problem" showTabs={false}><form className="editor-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,body=formValues(form);void action.run(async()=>{await mutate('/reports',body);form.reset();},'Your report has been sent to the administrator.');}}><Field label="Subject"><input name="subject" defaultValue={params.get('subject')||''} required minLength={3} maxLength={160}/></Field><Field label="Details"><textarea name="details" defaultValue={params.get('context')||''} required minLength={10} maxLength={5000} rows={5}/></Field><Submit busy={action.busy}>Send report</Submit><ActionStatus action={action}/></form></CommunityPage>;
}
