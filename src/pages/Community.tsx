import { Link,useSearchParams } from 'react-router-dom';
import { ArrowRight,FileText } from 'lucide-react';
import { useResource,type PageData,type Paper,type Group,type Tutor,type CampusEvent } from '../lib/community';
import { api,type ApiListing } from '../lib/api';
import { CommunityPage,Empty,ErrorBox } from '../components/CommunityUI';
import { GroupCard } from './StudyGroups';
import { TutorCard } from './Tutors';
import { EventCard } from './Events';
import { useEffect,useState,type ReactNode } from 'react';

function Preview<T>({title,path,apiPath,render}:{title:string;path:string;apiPath:string;render:(item:T)=>ReactNode}) {
  const result=useResource<PageData<T>>(apiPath);
  return <section className="hub-section"><div className="section-heading"><h2>{title}</h2><Link className="text-link" to={path}>View all<ArrowRight size={17}/></Link></div><ErrorBox error={result.error}/>{result.loading?<Empty>Loading...</Empty>:result.data?.items.length?<div className="community-grid">{result.data.items.map(render)}</div>:!result.error&&<Empty>No {title.toLowerCase()} found.</Empty>}</section>;
}
export default function Community({search=false}:{search?:boolean}) {
  const [params]=useSearchParams(),q=params.get('q')||'';
  const query=search?'&q='+encodeURIComponent(q):'';
  const suffix=search?'?q='+encodeURIComponent(q):'';
  const [listings,setListings]=useState<ApiListing[]>([]),[error,setError]=useState('');
  useEffect(()=>{if(!search)return;let active=true;api.listings(new URLSearchParams({search:q,limit:'4'})).then(r=>{if(active){setListings(r.listings);setError('');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[q,search]);
  return <CommunityPage showTabs={false} title={search?`Search: ${q}`:'Community Hub'} action={<Link className="text-link" to="/dashboard">My learning</Link>}>
    {search&&<section className="hub-section"><div className="section-heading"><h2>Listings</h2><Link className="text-link" to={'/browse?search='+encodeURIComponent(q)}>View all<ArrowRight size={17}/></Link></div><ErrorBox error={error}/>{listings.length?<div className="community-grid">{listings.map(l=><article className="community-card event-card" key={l.id}>{l.image&&<img src={l.image} alt={l.title}/>}<div><h3>{l.title}</h3><p>AED {l.price}</p><Link className="text-link" to={'/browse?search='+encodeURIComponent(l.title)}>View listing</Link></div></article>)}</div>:!error&&<Empty>No listings found.</Empty>}</section>}
    <Preview<Paper> title="Past Papers" path={'/past-papers'+suffix} apiPath={'/papers?limit=3'+query} render={p=><article className="community-card" key={p.id}><FileText size={25}/><h3>{p.title}</h3><p>{p.code} - {p.course}</p><p className="muted">{p.university} · {p.academicYear}</p><a className="text-link" href={`/api/papers/${p.id}/download`}>Download PDF</a></article>}/>
    <Preview<Group> title="Study Groups" path={'/study-groups'+suffix} apiPath={'/groups?limit=3'+query} render={g=><GroupCard key={g.id} group={g}/>}/>
    <Preview<Tutor> title="Tutors" path={'/tutors'+suffix} apiPath={'/tutors?limit=3'+query} render={t=><TutorCard key={t.id} tutor={t}/>}/>
    <Preview<CampusEvent> title="Campus Events" path={'/events'+suffix+(search?'&period=all':'')} apiPath={'/events?limit=3'+query+(search?'&period=all':'')} render={e=><EventCard key={e.id} event={e}/>}/>
  </CommunityPage>;
}
