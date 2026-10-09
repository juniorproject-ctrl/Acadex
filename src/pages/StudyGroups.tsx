import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { getCurrentUser } from '../lib/auth';
import { formValues,mutate,useResource,type Group,type PageData } from '../lib/community';
import { ActionStatus,CatalogSelect,CommunityPage,Empty,ErrorBox,Field,Pagination,SearchFilters,Submit,useAction } from '../components/CommunityUI';

export function GroupCard({group:g}:{group:Group}) {return <article className="community-card"><Users size={26}/><h2><Link to={'/study-groups/'+g.id}>{g.title}</Link></h2><p>{g.course}</p><p className="muted">{g.university}</p><p className="clamp-description">{g.description}</p><div className="card-bottom"><span className="muted">{g.leader} · {g.members} members</span><Link className="text-link" to={'/study-groups/'+g.id}>View group</Link></div></article>;}
export default function StudyGroups() {
  const [params]=useSearchParams(), navigate=useNavigate();
  const result=useResource<PageData<Group>>('/groups?'+params.toString());
  const [create,setCreate]=useState(false),[,setCourse]=useState('');
  const user=getCurrentUser(),action=useAction();
  return <CommunityPage title="Study Groups" action={user&&<button className="action-button" onClick={()=>setCreate(!create)}><Plus size={18}/>{create?'Close form':'Create group'}</button>}>
    {create&&<form className="editor-form" onSubmit={e=>{e.preventDefault();const body=formValues(e.currentTarget);void action.run(async()=>{const result=await mutate<{id:string}>('/groups',body);navigate('/study-groups/'+result.id);});}}><h2>New study group</h2><div className="form-grid"><CatalogSelect onCourse={setCourse}/><Field label="Group name"><input name="title" minLength={3} maxLength={160} required/></Field></div><Field label="Course topics and group description"><textarea name="description" minLength={20} maxLength={5000} rows={4} required/></Field><Submit busy={action.busy}>Create group</Submit></form>}
    <ActionStatus action={action}/><SearchFilters/><ErrorBox error={result.error}/>{result.loading?<Empty>Loading groups...</Empty>:result.data?.items.length?<div className="community-grid">{result.data.items.map(g=><GroupCard key={g.id} group={g}/>)}</div>:!result.error&&<Empty>No study groups match these filters yet.</Empty>}{result.data&&<Pagination {...result.data}/>}
  </CommunityPage>;
}
