import {useRef,useState} from 'react';
import {ShieldCheck,Lock} from 'lucide-react';
import {ActionStatus,Field,useAction} from './CommunityUI';
import {mutate} from '../lib/community';

export default function DemoAccountSetup({items,reload}:{items:{id:string;email:string;role:string;status:string}[];reload:()=>void}){
 const action=useAction(),fileInput=useRef<HTMLInputElement>(null);
 const [accounts,setAccounts]=useState<unknown>(null),[password,setPassword]=useState(''),[confirmed,setConfirmed]=useState(false),[fileError,setFileError]=useState('');
 return <section className="detail-section">
  <h2>Private test accounts</h2>
  <p className="muted">Owner testing only. This file includes an administrator account. Keep it private, do not upload it to GitHub, and disable test access when finished.</p>
  <form className="editor-form settings-form" onSubmit={e=>{e.preventDefault();void action.run(async()=>{
   await mutate('/admin/demo-accounts',{accounts,currentPassword:password,confirmed});
   setPassword('');setAccounts(null);setConfirmed(false);if(fileInput.current)fileInput.current.value='';reload();
  },'Test accounts synchronized. Sign in using the emails and passwords in your private file.');}}>
   <Field label="Private demo-account JSON file"><input ref={fileInput} type="file" accept=".json,application/json" required onChange={async e=>{
    const file=e.target.files?.[0];setAccounts(null);setFileError('');
    if(!file)return;
    if(file.size>65536){setFileError('Choose the small private demo-account JSON file.');e.target.value='';return;}
    try{setAccounts(JSON.parse(await file.text()));}catch{setFileError('This is not a valid JSON file.');}
   }}/></Field>
   {fileError&&<p role="alert" className="error-box">{fileError}</p>}
   <Field label="Your real administrator password"><input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
   <label className="checkbox-label"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm these accounts are for private testing and their passwords and roles may be reset.</label>
   <button className="action-button" disabled={action.busy||!accounts||!confirmed}><ShieldCheck size={17}/>Synchronize test accounts</button>
   <button type="button" className="secondary-button" disabled={action.busy||!password} onClick={()=>{if(confirm('Disable all six demo accounts and revoke their sessions?'))void action.run(async()=>{await mutate('/admin/demo-accounts/disable',{currentPassword:password});setPassword('');reload();},'Test accounts disabled.');}}><Lock size={17}/>Disable test access</button>
   <ActionStatus action={action}/>
  </form>
  {items.map(item=><div className="detail-row" key={item.id}><div><strong>{item.email}</strong><p>{item.role}</p></div><span className="status-badge">{item.status}</span></div>)}
 </section>;
}
