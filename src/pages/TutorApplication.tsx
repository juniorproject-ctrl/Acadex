import { Link } from 'react-router-dom';
import { useEffect,useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { ActionStatus,CatalogSelect,CommunityPage,Empty,ErrorBox,Field,Submit,useAction } from '../components/CommunityUI';
import { mutate,useResource } from '../lib/community';
import { api } from '../lib/api';
import { getCurrentUser,updateSessionUser,useCurrentUser } from '../lib/auth';

type Application={id:string;name?:string;email?:string;university?:string;subjects:string;experience:string;applicant_type:string;teaching_mode:string;academic_title:string;status:string;decision_reason:string};
export default function TutorApplication(){
  const result=useResource<{application:Application|null}>('/tutor-applications/mine',15000),action=useAction(),user=useCurrentUser();
  const a=result.data?.application,eligible=['student','leader','tutor'].includes(user?.role||'');
  useEffect(()=>{if(a?.status==='approved')void api.me().then(({user})=>updateSessionUser(user)).catch(()=>{});},[a?.status]);
  return <CommunityPage title="Apply to Tutor" showTabs={false}>
    <ErrorBox error={result.error}/><ActionStatus action={action}/>
    <section className="detail-intro"><GraduationCap size={32}/><p>University faculty and senior students can apply to tutor. Tell us your academic position, subjects and teaching experience.</p></section>
    {result.loading?<Empty>Loading application...</Empty>:a&&<section className="detail-section"><h2>Application status: <span className={'status-badge '+a.status}>{a.status}</span></h2>{a.decision_reason&&<p className="preserve-lines">{a.decision_reason}</p>}{a.status==='approved'&&<p><Link className="text-link" to="/dashboard">Open your tutor dashboard</Link></p>} {['pending','declined'].includes(a.status)&&<button className="secondary-button" disabled={action.busy} onClick={()=>{if(confirm('Withdraw this application?'))void action.run(async()=>{await mutate('/tutor-applications/mine',undefined,'DELETE');result.reload();},'Application withdrawn.');}}>Withdraw application</button>}</section>}
    {!result.loading&&!result.error&&eligible&&(!a||['declined','withdrawn'].includes(a.status))&&<form className="editor-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,body=Object.fromEntries(new FormData(form));void action.run(async()=>{await mutate('/tutor-applications',body);result.reload();},'Application submitted for review.');}}>
      <div className="form-grid"><CatalogSelect/><Field label="Subjects / course codes"><input name="subjects" required minLength={3} maxLength={500}/></Field><Field label="Academic role"><select name="applicantType" required><option value="faculty">University faculty</option><option value="senior_student">Senior student</option></select></Field><Field label="Teaching mode"><select name="teachingMode"><option value="online">Online</option><option value="in_person">In person</option><option value="both">Both</option></select></Field><Field label="Academic position / study year"><input name="academicTitle" required minLength={3} maxLength={100}/></Field></div>
      <Field label="Qualifications and teaching experience"><textarea name="experience" rows={4} required minLength={20} maxLength={5000}/></Field><label className="checkbox-label"><input name="consent" value="true" type="checkbox" required/>I confirm my academic information is accurate and consent to review by Acadex administrators.</label><Submit busy={action.busy}>Submit application</Submit>
    </form>}
    {!eligible&&!a&&!result.loading&&<p>Your existing account has tutor access. <Link to="/dashboard" className="text-link">Open dashboard</Link></p>}
  </CommunityPage>;
}
function Review({application:a,onReviewed}:{application:Application;onReviewed:()=>void}){
  const action=useAction();
  return <section className="detail-section"><div className="section-heading"><h2>{a.name}</h2><span className="status-badge">{a.status}</span></div><p>{a.email} · {a.university}</p><p>{a.subjects} · {a.applicant_type.replaceAll('_',' ')} · {a.teaching_mode.replaceAll('_',' ')}</p><p className="preserve-lines">{a.experience}</p><p>Academic position / study year: {a.academic_title}</p>
    {a.status==='pending'?<form className="editor-form settings-form" onSubmit={e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget));void action.run(async()=>{await mutate(`/tutor-applications/${a.id}/review`,{...body,confirmed:body.confirmed==='on'},'PATCH');onReviewed();},'Review saved.');}}><Field label="Decision"><select name="decision"><option value="approved">Approve tutor access</option><option value="declined">Decline</option></select></Field><Field label="Review notes for applicant"><textarea name="reason" required minLength={5} maxLength={2000} rows={3}/></Field><label className="checkbox-label"><input name="confirmed" type="checkbox" required/>I reviewed the applicant's academic background and teaching experience.</label><Submit busy={action.busy}>Save decision</Submit><ActionStatus action={action}/></form>:<p className="preserve-lines">{a.decision_reason}</p>}
  </section>;
}
export function TutorApplicationReviews(){
  const [status,setStatus]=useState('pending'),result=useResource<{items:Application[]}>('/tutor-applications?status='+status,15000);
  if(getCurrentUser()?.role!=='admin')return <CommunityPage title="Tutor Applications" showTabs={false}><Empty>Administrator access required.</Empty></CommunityPage>;
  return <CommunityPage title="Tutor Applications" showTabs={false}><Field label="Application status"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="declined">Declined</option></select></Field><ErrorBox error={result.error}/>{result.loading?<Empty>Loading applications...</Empty>:result.data?.items.length?result.data.items.map(a=><Review key={a.id} application={a} onReviewed={result.reload}/>):!result.error&&<Empty>No applications in this status.</Empty>}</CommunityPage>;
}
