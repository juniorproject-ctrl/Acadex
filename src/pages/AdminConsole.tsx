import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Trash2,EyeOff,Eye,Send,Save} from 'lucide-react';
import {getCurrentUser} from '../lib/auth';
import DemoAccountSetup from '../components/DemoAccountSetup';
import {formValues,mutate,useResource,dateTime} from '../lib/community';
import {ActionStatus,CommunityPage,Empty,ErrorBox,Field,useAction} from '../components/CommunityUI';

function ListingRow({item,reload}:{item:any;reload:()=>void}){
  const action=useAction(),[reason,setReason]=useState('');
  const change=(remove=false)=>void action.run(async()=>{
    if(remove&&!confirm('Permanently delete this listing?'))return;
    await mutate('/admin/listings/'+item.id,remove?{reason}:{hidden:!item.hidden,reason},remove?'DELETE':'PATCH');reload();
  },'Moderation saved.');
  return <article className="detail-section"><h2>{item.title}</h2><p>{item.seller} | AED {Number(item.price||0).toFixed(2)} | {item.status}{item.hidden?' | Hidden':''}</p>
    <Field label="Moderation reason"><input minLength={5} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></Field>
    <div className="flex flex-wrap gap-3 mt-3"><button className="secondary-button" disabled={action.busy||reason.trim().length<5} onClick={()=>change()}>{item.hidden?<Eye size={16}/>:<EyeOff size={16}/>} {item.hidden?'Restore':'Hide'}</button><button className="secondary-button" disabled={action.busy||reason.trim().length<5} onClick={()=>change(true)}><Trash2 size={16}/>Delete</button></div><ActionStatus action={action}/>
  </article>;
}
function UserRow({item,reload}:{item:any;reload:()=>void}){
  const action=useAction();
  return <article className="detail-section"><h2>{item.name}</h2><p>{item.email} | {item.verified?'Verified':'Unverified'}</p><form className="editor-form" onSubmit={e=>{
    e.preventDefault();const form=e.currentTarget,body=formValues(form);void action.run(async()=>{await mutate('/admin/users/'+item.id,{...body,suspended:new FormData(form).has('suspended')},'PATCH');form.querySelector<HTMLInputElement>('input[type=password]')!.value='';reload();},'Account access updated.');
  }}><Field label="Account ID"><input readOnly value={item.id}/></Field><div className="form-grid"><Field label="Role"><select name="role" defaultValue={item.role}><option value="student">Student</option><option value="tutor">Tutor</option><option value="leader">Study group leader</option><option value="admin">Administrator</option></select></Field><Field label="Your admin password"><input type="password" name="currentPassword" required autoComplete="current-password"/></Field></div><label className="checkbox-label"><input type="checkbox" name="suspended" defaultChecked={!!item.suspended}/>Suspend account</label><Field label="Reason for access change"><input name="reason" required minLength={5} maxLength={2000}/></Field><button className="action-button" disabled={action.busy}><Save size={16}/>Save access</button><ActionStatus action={action}/></form></article>;
}
function ContactRow({item,reload}:{item:any;reload:()=>void}){
  const action=useAction();
  return <article className="detail-section"><h2>{item.subject}</h2><p>{item.name} | {item.email} | {item.status}</p><p className="preserve-lines my-4">{item.message}</p>{item.reply&&<p className="preserve-lines">Last reply: {item.reply}</p>}<form className="editor-form" onSubmit={e=>{
    e.preventDefault();const form=e.currentTarget,body=formValues(form);void action.run(async()=>{await mutate('/admin/support/'+item.id+'/reply',body);form.reset();reload();},'Reply emailed successfully.');
  }}><Field label="Email reply"><textarea name="body" rows={4} required minLength={5} maxLength={2000}/></Field><button className="action-button" disabled={action.busy}><Send size={16}/>Send email reply</button><ActionStatus action={action}/></form></article>;
}
function ContentRow({item,kind,reload}:{item:any;kind:string;reload:()=>void}){
 const action=useAction(),[reason,setReason]=useState(''),[ownerId,setOwnerId]=useState('');
 return <article className="detail-section"><h2>{item.title}</h2><p>{item.owner}</p><Field label="Reason"><input value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></Field>
 {kind==='groups'&&<><Field label="New group owner account ID"><input value={ownerId} onChange={e=>setOwnerId(e.target.value)} maxLength={36}/></Field><button className="secondary-button mt-3" disabled={action.busy||reason.trim().length<5||ownerId.length!==36} onClick={()=>void action.run(async()=>{await mutate('/admin/groups/'+item.id+'/transfer',{ownerId,reason});reload();},'Group owner updated.')}>Transfer group</button></>}
 <button className="secondary-button mt-3" disabled={action.busy||reason.trim().length<5} onClick={()=>{if(confirm('Remove this content? Group removal also deletes its sessions and chat.'))void action.run(async()=>{await mutate('/admin/content/'+kind+'/'+item.id,{reason},'DELETE');reload();},'Content removed.');}}><Trash2 size={16}/>Remove</button><ActionStatus action={action}/></article>;
}
export default function AdminConsole(){
  const [tab,setTab]=useState('listings'),[query,setQuery]=useState(''),[draft,setDraft]=useState('');
  const admin=getCurrentUser()?.role==='admin';
  const result=useResource<{items:any[]}>(admin?'/admin/'+(['groups','events','papers'].includes(tab)?'content/':'')+tab+'?'+new URLSearchParams({q:query}):null,15000);
  if(!admin)return <CommunityPage title="Administration" showTabs={false}><Empty>Administrator access required.</Empty></CommunityPage>;
  return <CommunityPage title="Website management" showTabs={false} action={<Link className="text-link" to="/dashboard">Reports and tutor applications</Link>}>
    <div className="community-tabs" role="tablist" aria-label="Administration sections">{[['listings','Listings'],['users','Accounts'],['groups','Study groups'],['events','Events'],['papers','Past papers'],['support','Contact requests'],['demo-accounts','Test accounts'],['audit','Activity log']].map(([id,label])=><button role="tab" aria-selected={tab===id} key={id} onClick={()=>{setTab(id);setQuery('');setDraft('');}}>{label}</button>)}</div>
    {['listings','users'].includes(tab)&&<form className="filter-bar" onSubmit={e=>{e.preventDefault();setQuery(draft);}}><Field label="Search"><input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={160}/></Field><button className="secondary-button">Search</button></form>}
    <ErrorBox error={result.error}/>{tab==='demo-accounts'?<DemoAccountSetup items={(result.data?.items||[]).filter(item=>typeof item.email==='string'&&item.email.endsWith('@acadex.example'))} reload={result.reload}/>:result.loading?<Empty>Loading...</Empty>:result.data?.items.length?result.data.items.map(item=>tab==='listings'?<ListingRow key={item.id} item={item} reload={result.reload}/>:tab==='users'?<UserRow key={item.id} item={item} reload={result.reload}/>:tab==='support'?<ContactRow key={item.id} item={item} reload={result.reload}/>:['groups','events','papers'].includes(tab)?<ContentRow key={item.id} item={item} kind={tab} reload={result.reload}/>:<article className="detail-row" key={item.id}><div><strong>{item.action.replaceAll('_',' ')}</strong><p>{item.actor} | {dateTime(item.createdAt)}</p><p className="preserve-lines">{item.reason}</p><p className="muted">{item.targetId}</p></div></article>):!result.error&&<Empty>No records found.</Empty>}
  </CommunityPage>;
}
