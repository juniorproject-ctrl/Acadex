import {useRef,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {motion} from 'motion/react';
import BrandLogo from '../components/BrandLogo';
import {api} from '../lib/api';
import {setSession} from '../lib/auth';

export default function VerifyOTP(){
  const location=useLocation(),navigate=useNavigate();
  const [email,setEmail]=useState<string>(()=>location.state?.email||sessionStorage.getItem('acadex_pending_verification_email')||'');
  const [code,setCode]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const emailInput=useRef<HTMLInputElement>(null);
  const validEmail=()=>emailInput.current?.reportValidity()&&!!email.trim();
  const send=async()=>{
    if(loading||!validEmail())return;
    setLoading(true);setError('');setSuccess('');
    try{
      const address=email.trim().toLowerCase();
      const result=await api.resendOtp(address);
      sessionStorage.setItem('acadex_pending_verification_email',address);
      setCode('');setSuccess(result.message);
    }catch(error){setError(error instanceof Error?error.message:'Unable to send the code.');}
    finally{setLoading(false);}
  };
  const verify=async()=>{
    if(loading||!validEmail())return;
    if(!/^\d{6}$/.test(code)){setError('Enter the six-digit verification code.');return;}
    setLoading(true);setError('');setSuccess('');
    try{
      const result=await api.verifyOtp(email.trim().toLowerCase(),code);
      setSession(result.token,result.user);
      sessionStorage.removeItem('acadex_pending_verification_email');
      navigate(result.user.role==='admin'?'/dashboard':'/home',{replace:true});
    }catch(error){setError(error instanceof Error?error.message:'Unable to verify this code.');}
    finally{setLoading(false);}
  };
  return <div className="min-h-screen flex flex-col items-center justify-center p-4">
    <div className="mb-6"><BrandLogo size="lg"/></div>
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} className="auth-container">
      <h1 className="text-brand-cream text-2xl text-center mb-3">Verify your email</h1>
      <p className="text-brand-cream text-sm mb-6">Enter the code from your email, or request a new code below.</p>
      <form className="space-y-5" onSubmit={e=>{e.preventDefault();void verify();}}>
        <label className="block text-brand-cream">Email
          <input ref={emailInput} name="email" type="email" required autoComplete="email" className="input-field mt-2" value={email} disabled={loading} onChange={e=>{setEmail(e.target.value);setCode('');setError('');setSuccess('');}}/>
        </label>
        <button type="button" onClick={()=>void send()} disabled={loading||!email.trim()} className="font-bold underline text-brand-cream disabled:opacity-50">Send / resend code</button>
        <label className="block text-brand-cream">Verification code
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="input-field mt-2 text-center text-2xl" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} disabled={loading}/>
        </label>
        {error&&<p role="alert" className="bg-red-100 text-red-700 p-3 rounded text-sm">{error}</p>}
        {success&&<p role="status" className="bg-green-100 text-green-800 p-3 rounded text-sm">{success}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading?'Please wait...':'Verify email'}</button>
        <p className="text-center"><Link to="/" className="underline text-brand-cream">Back to sign in</Link></p>
      </form>
    </motion.div>
  </div>;
}
