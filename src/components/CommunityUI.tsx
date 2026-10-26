import SearchableSelect from './SearchableSelect';
import { simpleAcademicOptions } from '../lib/academicTopics';
import { cloneElement, isValidElement, useEffect, useId, useState, type ReactElement, type ReactNode } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useResource, type Catalog } from '../lib/community';

export function CommunityPage({title,children,action,showTabs=true}:{title:string;children:ReactNode;action?:ReactNode;showTabs?:boolean}) {
  return <div className="community-page"><header className="community-heading"><div><Link to="/community" className="muted">Community</Link><h1>{title}</h1></div>{action}</header>{showTabs&&<nav className="community-tabs" aria-label="Community sections">{[['Past papers','/past-papers'],['Study groups','/study-groups'],['Tutors','/tutors'],['Campus events','/events']].map(([label,path])=><NavLink key={path} to={path}>{label}</NavLink>)}</nav>}{children}</div>;
}
export function ErrorBox({error}:{error?:string}) {return error ? <p role="alert" className="error-box">{error}</p> : null;}
export function Empty({children}:{children:ReactNode}) {return <p className="empty-state">{children}</p>;}
export function Field({label,children}:{label:string;children:ReactNode}) {
  const id=useId();
  return <label className="community-field"><span id={id}>{label}</span>{isValidElement(children)?cloneElement(children as ReactElement<Record<string,unknown>>,{'aria-labelledby':id}):children}</label>;
}
export function External({href,children}:{href:string;children:ReactNode}) {return <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={15}/></a>;}
export function Submit({busy,children}:{busy:boolean;children:ReactNode}) {return <button disabled={busy} className="action-button" type="submit">{busy?'Saving...':children}</button>;}
export function useAction() {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const run = async (action:()=>Promise<unknown>,message='Saved.') => {
    if(busy)return false;
    setBusy(true);setError('');setSuccess('');
    try {await action();setSuccess(message);return true;}
    catch(error){setError(error instanceof Error?error.message:'Unable to save.');return false;}
    finally{setBusy(false);}
  };
  return {busy,error,success,run};
}
export function ActionStatus({action}:{action:ReturnType<typeof useAction>}) {return <><ErrorBox error={action.error}/>{action.success&&<p className="success-box" role="status">{action.success}</p>}</>;}
export function CatalogSelect({onCourse,initialUniversity='',required=true}:{onCourse?:(value:string)=>void;initialUniversity?:string;required?:boolean}) {
  const {data,error}=useResource<Catalog>('/catalog');
  const [uni,setUni]=useState(initialUniversity),[major,setMajor]=useState(''),[selected,setSelected]=useState('');
  const options=simpleAcademicOptions(data||{majors:[],courses:[]},uni,major);
  const hasCourses=options.courses.some(course=>course.ids.length>0);
  return <><ErrorBox error={error}/><Field label="University"><SearchableSelect name="universityId" required={required} value={uni} onChange={e=>{setUni(e.target.value);setMajor('');setSelected('');onCourse?.('');}}><option value="">Select university</option>{data?.universities.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</SearchableSelect></Field>{onCourse&&<>
    <Field label="Major"><SearchableSelect value={major} onChange={e=>{setMajor(e.target.value);setSelected('');onCourse('');}}><option value="">All majors</option>{options.majors.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</SearchableSelect></Field>
    <Field label="Course"><SearchableSelect name="courseId" required disabled={!data||!hasCourses} value={selected} onChange={e=>{setSelected(e.target.value);const chosen=data?.courses.find(c=>c.id===e.target.value);if(chosen)setUni(chosen.universityId);onCourse(e.target.value);}}><option value="">{data?'Select course':'Loading courses...'}</option>{options.courses.filter(c=>c.ids.length).map(c=><option key={c.id} value={c.ids[0]}>{c.name}</option>)}</SearchableSelect></Field>
    {data&&!hasCourses&&<ErrorBox error="Courses are temporarily unavailable for this selection. Please try again later."/>}
  </>}</>;
}
export function SearchFilters({academic=false,events=false}:{academic?:boolean;events?:boolean}) {
  const [params,setParams]=useSearchParams();
  const {data,error}=useResource<Catalog>('/catalog');
  const [draft,setDraft]=useState(params.get('q')||'');
  const query=params.get('q')||'';
  useEffect(()=>{setDraft(query);},[query]);
  const university=params.get('university')||'',major=params.get('major')||'',course=params.get('course')||'';
  const options=simpleAcademicOptions(data||{majors:[],courses:[]},university,major);
  const chosenMajor=options.majors.find(m=>m.id===major||m.ids.includes(major))?.id||'';
  const chosenCourse=options.courses.find(c=>c.id===course||c.ids.includes(course))?.id||'';
  const change=(key:string,value:string)=>{const next=new URLSearchParams(params);value?next.set(key,value):next.delete(key);next.delete('page');if(key==='university'){next.delete('major');next.delete('course');}if(key==='major')next.delete('course');setParams(next);};
  return <><form className="filter-bar" onSubmit={e=>{e.preventDefault();change('q',draft);}}>
    <Field label="Search"><div className="search-control"><input type="search" placeholder={academic?'Course name or paper title':'Search'} value={draft} onChange={e=>setDraft(e.target.value)}/><button title="Search" aria-label="Search"><Search size={19}/></button></div></Field>
    <Field label="University"><SearchableSelect value={university} onChange={e=>change('university',e.target.value)}><option value="">All universities</option>{data?.universities.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</SearchableSelect></Field>
    {academic&&<><Field label="Major"><SearchableSelect value={chosenMajor} onChange={e=>change('major',e.target.value)}><option value="">All majors</option>{options.majors.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</SearchableSelect></Field>
    <Field label="Course"><SearchableSelect value={chosenCourse} onChange={e=>change('course',e.target.value)}><option value="">All courses</option>{options.courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</SearchableSelect></Field></>}
    {events&&<Field label="When"><select value={params.get('period')||'upcoming'} onChange={e=>change('period',e.target.value)}><option value="upcoming">Upcoming</option><option value="past">Past events</option><option value="all">All dates</option></select></Field>}
  </form><ErrorBox error={error}/></>;
}
export function Pagination({page,pages,total}:{page:number;pages:number;total:number}) {
  const [params,setParams]=useSearchParams();
  const go=(n:number)=>{const next=new URLSearchParams(params);next.set('page',String(n));setParams(next);};
  return <div className="community-pagination"><span>{total} results</span><button title="Previous page" disabled={page<=1} onClick={()=>go(page-1)}><ChevronLeft size={20}/></button><span>Page {page} of {pages}</span><button title="Next page" disabled={page>=pages} onClick={()=>go(page+1)}><ChevronRight size={20}/></button></div>;
}
