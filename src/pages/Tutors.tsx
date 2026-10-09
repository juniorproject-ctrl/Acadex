import { useState } from 'react';
import { Link,useParams,useSearchParams } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { getCurrentUser } from '../lib/auth';
import { dateTime,mutate,useResource,type Tutor,type PageData,type Slot } from '../lib/community';
import { ActionStatus,CommunityPage,Empty,ErrorBox,Field,Pagination,SearchFilters,Submit,useAction } from '../components/CommunityUI';

export function TutorCard({tutor:t}:{tutor:Tutor}) {return <article className="community-card"><div className="profile-icon"><UserRound size={28}/></div><h2><Link to={'/tutors/'+t.id}>{t.name}</Link></h2><p>{t.subjects}</p><p className="muted">{t.university}</p><p className="clamp-description">{t.bio}</p><div className="card-bottom"><strong>AED {Number(t.hourlyRate).toFixed(2)} / hour</strong><Link className="text-link" to={'/tutors/'+t.id}>View availability</Link></div></article>;}
export default function Tutors() {
  const [params]=useSearchParams(),user=getCurrentUser();
  const result=useResource<PageData<Tutor>>('/tutors?'+params.toString());
  return <CommunityPage title="Tutors" action={['tutor','admin'].includes(user?.role||'')&&<Link className="action-button" to="/dashboard">Manage tutoring</Link>}><SearchFilters/><ErrorBox error={result.error}/>{result.loading?<Empty>Loading tutors...</Empty>:result.data?.items.length?<div className="community-grid">{result.data.items.map(t=><TutorCard key={t.id} tutor={t}/>)}</div>:!result.error&&<Empty>No tutors match these filters yet.</Empty>}{result.data&&<Pagination {...result.data}/>}</CommunityPage>;
}
export function TutorDetail() {
  const {id}=useParams(),result=useResource<Tutor>('/tutors/'+id,15000),user=getCurrentUser(),action=useAction();
  const [selected,setSelected]=useState<Slot|null>(null);
  if(result.loading)return <CommunityPage title="Tutor"><Empty>Loading tutor...</Empty></CommunityPage>;
  if(!result.data)return <CommunityPage title="Tutor"><ErrorBox error={result.error}/></CommunityPage>;
  const t=result.data;
  return <CommunityPage title={t.name}><div className="detail-intro"><div className="profile-icon"><UserRound size={32}/></div><h2>{t.subjects}</h2><p className="muted">{t.university} · AED {Number(t.hourlyRate).toFixed(2)} / hour</p><p className="preserve-lines">{t.bio}</p></div><ActionStatus action={action}/>{action.success&&<Link className="text-link" to="/dashboard">View your bookings</Link>}<section className="detail-section"><h2>Available sessions</h2>{!t.slots.length&&<Empty>No open slots at the moment.</Empty>}<div className="slot-grid">{t.slots.map(s=><button key={s.id} disabled={user?.id===t.id||action.busy} className={'slot-option '+(selected?.id===s.id?'selected':'')} onClick={()=>setSelected(s)}><strong>{dateTime(s.startsAt)}</strong><span>Ends {dateTime(s.endsAt)}</span><strong>AED {Number(s.price).toFixed(2)} total</strong></button>)}</div>{selected&&(user?<form className="editor-form" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void action.run(async()=>{await mutate(`/tutors/slots/${selected.id}/book`,{note:data.get('note')});setSelected(null);result.reload();},'Booking requested. Your tutor will accept or decline it.');}}><h3>{dateTime(selected.startsAt)} · AED {Number(selected.price).toFixed(2)}</h3><Field label="What would you like to cover? (optional)"><textarea name="note" maxLength={1000} rows={3}/></Field><Submit busy={action.busy}>Request booking</Submit></form>:<Link className="action-button" to="/">Sign in to request this slot</Link>)}</section></CommunityPage>;
}
