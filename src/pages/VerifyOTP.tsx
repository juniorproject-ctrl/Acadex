import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import BrandLogo from '../components/BrandLogo';
import { api } from '../lib/api';
import { setSession } from '../lib/auth';

export default function VerifyOTP() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const inputRefs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));
  const email = (location.state?.email || sessionStorage.getItem('acadex_pending_verification_email') || '') as string;

  useEffect(() => {
    if (!email) navigate('/signup', { replace: true });
  }, [email, navigate]);

  useEffect(() => { inputRefs[0].current?.focus(); }, []);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < inputRefs.length - 1) inputRefs[index + 1].current?.focus();
  };

  const verify = async () => {
    const code = otp.join('');
    if (code.length !== 6) return setError('Please enter the full 6-digit code.');
    setLoading(true); setError(''); setSuccess('');
    try {
      const result = await api.verifyOtp(email, code);
      setSession(result.token, result.user);
      sessionStorage.removeItem('acadex_pending_verification_email');
      setSuccess('Email verified successfully. Redirecting...');
      window.setTimeout(() => navigate('/home'), 700);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'That code did not work.');
    } finally { setLoading(false); }
  };

  const resend = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const result = await api.resendOtp(email);
      setSuccess(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to resend the code.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="mb-6"><BrandLogo size="lg" /></div>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="auth-container">
        <h2 className="text-brand-cream text-2xl font-bold text-center mb-2">Enter your code</h2>
        <p className="text-brand-cream text-center opacity-80 mb-8 font-medium">We sent a code to {email}</p>
        {error && <div className="bg-red-100 text-red-600 p-3 rounded-lg text-xs font-bold text-center mb-6">{error}</div>}
        {success && <div className="bg-green-100 text-green-600 p-3 rounded-lg text-xs font-bold text-center mb-6">{success}</div>}
        <div className="flex justify-center gap-2 mb-8">
          {otp.map((digit, index) => <input key={index} ref={inputRefs[index]} inputMode="numeric" maxLength={1} value={digit} onChange={(event) => handleChange(index, event.target.value)} onKeyDown={(event) => { if (event.key === 'Backspace' && !otp[index] && index > 0) inputRefs[index - 1].current?.focus(); }} disabled={loading} className="w-11 h-16 text-2xl font-bold text-center bg-background-soft rounded-lg text-brand-navy outline-none focus:ring-2 focus:ring-brand-gold disabled:opacity-50" />)}
        </div>
        <p className="text-center text-brand-cream text-sm mb-10">Didn&apos;t get the code? <button onClick={resend} disabled={loading} className="font-bold underline disabled:opacity-50">Resend Code</button></p>
        <div className="flex space-x-4"><button onClick={() => navigate('/signup')} disabled={loading} className="flex-1 border border-brand-cream text-brand-cream font-bold py-3 px-6 rounded-lg hover:bg-brand-cream hover:text-brand-navy transition-all disabled:opacity-50">Cancel</button><button onClick={verify} disabled={loading} className="flex-1 btn-primary">{loading ? 'Verifying...' : 'Verify'}</button></div>
      </motion.div>
    </div>
  );
}
