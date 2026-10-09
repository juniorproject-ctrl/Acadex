import { useEffect,useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ActionStatus,CommunityPage,Field,Submit,useAction } from '../components/CommunityUI';
import { getCurrentUser,updateSessionUser } from '../lib/auth';
import { request,type SessionUser } from '../lib/api';
import { defaults,readAccessibility,saveAccessibility } from '../lib/accessibility';

export default function Settings({accessibilityOnly=false}:{accessibilityOnly?:boolean}) {
  const user=getCurrentUser(),action=useAction(),location=useLocation();
  const [name,setName]=useState(user?.name||'');
  const [preferences,setPreferences]=useState(readAccessibility);
  useEffect(()=>{if(location.hash==='#accessibility')document.getElementById('accessibility')?.focus();},[location.hash]);
  return <CommunityPage title={accessibilityOnly?"Accessibility":"Account Settings"} showTabs={false}>
    {!accessibilityOnly&&<form className="editor-form settings-form" onSubmit={e=>{e.preventDefault();void action.run(async()=>{
      const result=await request<{user:SessionUser}>('/account/profile',{method:'PATCH',body:JSON.stringify({name})});
      updateSessionUser(result.user);
    },'Account updated.');}}>
      <Field label="Name"><input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={100}/></Field>
      <Field label="University email"><input value={user?.email||''} readOnly type="email"/></Field>
      <Field label="Account role"><input value={user?.role==='leader'?'Study group leader':user?.role||''} readOnly/></Field>
      <Submit busy={action.busy}>Save changes</Submit><ActionStatus action={action}/>
    </form>}
    {accessibilityOnly&&<section id="accessibility" className="detail-section settings-form" tabIndex={-1}>
      <h2>Accessibility</h2>
      {([['largeText','Larger text'],['highContrast','High contrast'],['reducedMotion','Reduce motion']] as const).map(([key,label])=><label className="preference-row" key={key}><span>{label}</span><input type="checkbox" checked={preferences[key]} onChange={e=>{const next={...preferences,[key]:e.target.checked};setPreferences(next);saveAccessibility(next);}}/></label>)}
      <p className="muted">Preferences are saved on this browser.</p>
      <button className="secondary-button" type="button" onClick={()=>{setPreferences({...defaults});saveAccessibility(defaults);}}>Reset preferences</button>
    </section>}
  </CommunityPage>;
}
