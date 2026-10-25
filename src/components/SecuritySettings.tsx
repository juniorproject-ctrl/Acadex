import {useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {KeyRound,LogOut,Trash2} from 'lucide-react';
import {clearSession} from '../lib/auth';
import {mutate} from '../lib/community';
import {ActionStatus,Field,useAction} from './CommunityUI';

export default function SecuritySettings(){
  const action=useAction(),navigate=useNavigate();
  const [current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
  const [logoutPassword,setLogoutPassword]=useState(''),[deletePassword,setDeletePassword]=useState(''),[deleteText,setDeleteText]=useState('');
  const signOut=()=>{clearSession();navigate('/',{replace:true});};
  return <div className="settings-form">
    <section className="detail-section"><h2>Security</h2>
      <form className="editor-form" onSubmit={e=>{e.preventDefault();void action.run(async()=>{
        if(password!==confirmation)throw new Error('New passwords do not match.');
        await mutate('/account/security/password',{currentPassword:current,password});signOut();
      });}}>
        <h3>Change password</h3><Field label="Current password"><input type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)}/></Field>
        <Field label="New password"><input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></Field>
        <Field label="Confirm new password"><input type="password" autoComplete="new-password" required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></Field>
        <p className="muted">Use at least 8 characters, including a number and a special character. Changing your password signs out all devices.</p>
        <button className="action-button" disabled={action.busy}><KeyRound size={17}/>Update password</button>
      </form>
      <form className="editor-form" onSubmit={e=>{e.preventDefault();void action.run(async()=>{await mutate('/account/security/sign-out-all',{currentPassword:logoutPassword});signOut();});}}>
        <h3>Sign out all devices</h3><Field label="Confirm your current password"><input type="password" autoComplete="current-password" required value={logoutPassword} onChange={e=>setLogoutPassword(e.target.value)}/></Field>
        <button className="secondary-button" disabled={action.busy}><LogOut size={17}/>Sign out everywhere</button>
      </form>
      <ActionStatus action={action}/>
    </section>
    <section className="detail-section"><h2>Your account</h2><div className="flex flex-wrap gap-4"><Link className="text-link" to="/my-listings">My listings</Link><Link className="text-link" to="/my-reports">My reports and replies</Link><Link className="text-link" to="/accessibility">Accessibility</Link><Link className="text-link" to="/privacy-policy">Privacy policy</Link></div></section>
    <section className="detail-section"><h2>Delete account</h2>
      <p className="muted">This removes your name, email and password from your account, revokes access on every device, and removes your public listings. A non-login record and relevant transaction, conversation and moderation history remain for other participants and support. Uploaded copies or backups are not instantly erased. Contact support for a wider data-removal request.</p>
      <p className="muted mt-3">Resolve pending checkouts and tutoring bookings first. If you lead a study group, contact support to close or transfer it.</p>
      <details className="mt-4"><summary className="text-link cursor-pointer">Delete my account permanently</summary><form className="editor-form" onSubmit={e=>{e.preventDefault();void action.run(async()=>{
        await mutate('/account/security',{currentPassword:deletePassword,confirmation:deleteText},'DELETE');signOut();
      });}}>
        <Field label="Password to delete account"><input type="password" autoComplete="current-password" required value={deletePassword} onChange={e=>setDeletePassword(e.target.value)}/></Field>
        <Field label="Type DELETE to confirm"><input required pattern="DELETE" autoComplete="off" value={deleteText} onChange={e=>setDeleteText(e.target.value)}/></Field>
        <button className="secondary-button text-red-700" disabled={action.busy||deleteText!=='DELETE'}><Trash2 size={17}/>Delete account</button><ActionStatus action={action}/>
      </form></details>
    </section>
  </div>;
}
