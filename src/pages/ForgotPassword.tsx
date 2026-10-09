import {useState} from 'react';
import {Link} from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import {request} from '../lib/api';
import {clearSession} from '../lib/auth';
export default function ForgotPassword(){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[stage,setStage]=useState<'email'|'reset'|'done'>('email'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function send(){
  setBusy(true);setError('');
  try{const result=await request<{message:string}>('/auth/forgot-password',{method:'POST',body:JSON.stringify({email})});setMessage(result.message);setStage('reset');}
  catch(e){setError(e instanceof Error?e.message:'Unable to request a reset.');}finally{setBusy(false);}
 }
 async function reset(){
  setError('');if(password!==confirm){setError('The passwords do not match.');return;}
  setBusy(true);
  try{const result=await request<{message:string}>('/auth/reset-password',{method:'POST',body:JSON.stringify({email,code,password})});clearSession();setMessage(result.message);setStage('done');}
  catch(e){setError(e instanceof Error?e.message:'Unable to reset your password.');}finally{setBusy(false);}
 }
 return <div className="min-h-screen flex flex-col items-center justify-center p-4"><div className="mb-6"><BrandLogo size="lg"/></div><div className="auth-container"><h1 className="text-brand-cream text-3xl font-bold text-center mb-6">Reset Password</h1>{error&&<p role="alert" className="bg-red-100 text-red-600 p-3 rounded-lg mb-4">{error}</p>}{message&&<p role="status" className="text-brand-cream mb-6">{message}</p>}{stage!=='done'&&<form className="space-y-6" onSubmit={e=>{e.preventDefault();void(stage==='email'?send():reset());}}><label className="text-brand-cream block">Email<input className="input-field mt-2" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required disabled={busy||stage==='reset'}/></label>{stage==='reset'&&<><label className="text-brand-cream block">Reset code<input className="input-field mt-2" value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy}/></label><label className="text-brand-cream block">New password<input className="input-field mt-2" type="password" autoComplete="new-password" minLength={8} required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label><p className="text-brand-cream text-sm">At least 8 characters, including a number and a special character.</p><label className="text-brand-cream block">Confirm password<input className="input-field mt-2" type="password" autoComplete="new-password" required disabled={busy} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label></>}<button className="w-full btn-primary" disabled={busy}>{busy?'Please wait...':stage==='email'?'Send reset code':'Update password'}</button>{stage==='reset'&&<div className="flex flex-wrap gap-4 text-brand-cream"><button type="button" className="underline" disabled={busy} onClick={()=>void send()}>Resend code</button><button type="button" className="underline" disabled={busy} onClick={()=>{setStage('email');setMessage('');setCode('');}}>Change email</button></div>}</form>}<p className="text-center text-brand-cream mt-6"><Link to="/" className="underline font-bold">Back to sign in</Link></p></div></div>;
}
