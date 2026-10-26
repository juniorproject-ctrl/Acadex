import {useEffect,useRef,useState} from 'react';
import {ShieldCheck,Lock,Copy,Check} from 'lucide-react';
import {ActionStatus,Field,useAction} from './CommunityUI';
import {mutate} from '../lib/community';
type Status={key:string;email:string;role:string;status:string;passwordMatches:boolean;loginReady:boolean};
export default function DemoAccountSetup({items,reload}:{items:{id:string;email:string;role:string;status:string}[];reload:()=>void}){
 const action=useAction(),fileInput=useRef<HTMLInputElement>(null);
 const [accounts,setAccounts]=useState<unknown>(null),[password,setPassword]=useState(''),[confirmed,setConfirmed]=useState(false),[fileError,setFileError]=useState(''),[checks,setChecks]=useState<Status[]>([]),[copied,setCopied]=useState('');
 const clearFile=()=>{setAccounts(null);setChecks([]);setCopied('');setPassword('');if(fileInput.current)fileInput.current.value='';};
 useEffect(()=>{
  if(!accounts)return;
  const timer=setTimeout(()=>{setAccounts(null);setChecks([]);setPassword('');if(fileInput.current)fileInput.current.value='';},5*60*1000);
  return()=>clearTimeout(timer);
 },[accounts]);
 const copy=(email:string,value:string,kind:string)=>void action.run(async()=>{
  if(!navigator.clipboard?.writeText)throw new Error('Open the HTTPS website to copy credentials securely, or copy them from your private file.');
  await navigator.clipboard.writeText(value);setCopied(kind+' copied for '+email+'.');
 },'');
 return <section className="detail-section">
  <h2>Private test accounts</h2>
  <p className="muted">Owner testing only. This file includes an administrator account. Keep it private and disable test access when finished. Each account has its own password.</p>
  <form className="editor-form settings-form" onSubmit={e=>{e.preventDefault();void action.run(async()=>{
   const result=await mutate<{accounts:Status[]}>('/admin/demo-accounts',{accounts,currentPassword:password,confirmed});
   setChecks(result.accounts);setPassword('');reload();
  },'Test accounts synchronized. Sign in using the emails and passwords in your private file.');}}>
   <Field label="Private demo-account JSON file"><input ref={fileInput} type="file" accept=".json,application/json" required onChange={async e=>{
    const file=e.target.files?.[0];setAccounts(null);setChecks([]);setCopied('');setFileError('');
    if(!file)return;
    if(file.size>65536){setFileError('Choose the small private demo-account JSON file.');e.target.value='';return;}
    try{setAccounts(JSON.parse(await file.text()));}catch{setFileError('This is not a valid JSON file.');}
   }}/></Field>
   {fileError&&<p role="alert" className="error-box">{fileError}</p>}
   <Field label="Your real administrator password"><input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
   <label className="checkbox-label"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm these accounts are for private testing and their passwords and roles may be reset.</label>
   <button className="action-button" disabled={action.busy||!accounts||!confirmed}><ShieldCheck size={17}/>Synchronize test accounts</button>
   <button type="button" className="secondary-button" disabled={action.busy||!accounts||!password} onClick={()=>void action.run(async()=>{
    const result=await mutate<{accounts:Status[]}>('/admin/demo-accounts/check',{accounts,currentPassword:password});setChecks(result.accounts);setPassword('');
   },'Passwords checked against this website without changing them.')}><Check size={17}/>Check login credentials</button>
   <button type="button" className="secondary-button" disabled={action.busy||!password} onClick={()=>{if(confirm('Disable all six demo accounts and revoke their sessions?'))void action.run(async()=>{await mutate('/admin/demo-accounts/disable',{currentPassword:password});setPassword('');setChecks([]);reload();},'Test accounts disabled.');}}><Lock size={17}/>Disable test access</button>
   {accounts!==null&&<button type="button" className="text-link" onClick={clearFile}>Clear private file</button>}
   <ActionStatus action={action}/>
  </form>
  {checks.length>0&&<p className="muted">Password results are checked against the selected file. Private file contents stay in this page only and clear after five minutes.</p>}
  {copied&&<p role="status" className="success-box">{copied}</p>}
  {items.map(item=>{
   const check=checks.find(row=>row.email===item.email);
   const credential=accounts&&typeof accounts==='object'?(accounts as Record<string,any>)[item.id]:null;
   return <div className="detail-row flex-wrap" key={item.id}><div><strong>{item.email}</strong><p>{item.role}</p><span className={'status-badge '+(check&&!check.loginReady?'declined':'')}>{check?.status||item.status}</span></div>
    {credential?.email===item.email&&typeof credential.password==='string'&&<div className="flex flex-wrap gap-2">
     <button type="button" className="secondary-button" title={'Copy email for '+item.email} aria-label={'Copy email for '+item.email} onClick={()=>copy(item.email,item.email,'Email')}><Copy size={16}/>Email</button>
     <button type="button" className="secondary-button" disabled={action.busy||!check?.loginReady} title={'Copy password for '+item.email} aria-label={'Copy password for '+item.email} onClick={()=>copy(item.email,credential.password,'Password')}><Copy size={16}/>Password</button>
    </div>}
   </div>;
  })}
 </section>;
}
