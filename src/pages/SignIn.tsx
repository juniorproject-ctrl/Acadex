import React, { useEffect,useState } from 'react';
import { Link, useLocation,useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { setSession } from '../lib/auth';
import {consumeReturnTo,rememberReturnTo} from '../lib/loginRedirect';
import PasswordInput from '../components/PasswordInput';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location=useLocation();
  useEffect(()=>{rememberReturnTo(new URLSearchParams(location.search).get('returnTo'));},[location.search]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.login(email, password);
      setSession(result.token, result.user);
      navigate(consumeReturnTo(),{replace:true});
    } catch (requestError) {
      if(requestError instanceof Error&&/verify your email before signing in/i.test(requestError.message)){
        sessionStorage.setItem('acadex_pending_verification_email',email);
        navigate('/verify',{state:{email}});
        return;
      }
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="auth-container">
        <h2 className="text-brand-cream text-3xl font-bold text-center mb-2">Welcome Back!</h2>
        <p className="text-brand-cream text-center opacity-80 mb-8">Please enter your details to sign in.</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-100 text-red-600 p-3 rounded-lg text-xs font-bold text-center">{error}</div>}
          <div className="space-y-2">
            <label htmlFor="login-email" className="text-brand-cream font-medium block">Email</label>
            <input id="login-email" type="email" autoComplete="email" placeholder="Enter your university email" className="input-field" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
          </div>
          <div className="space-y-2">
            <label htmlFor="login-password" className="text-brand-cream font-medium block">Password</label>
            <PasswordInput id="login-password" autoComplete="current-password" placeholder="Enter your password" className="input-field" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} />
          </div>
          <button type="submit" disabled={loading} className="w-full btn-primary mt-4">{loading ? 'Signing in...' : 'Sign In'}</button>
          <p className="text-center text-brand-cream text-sm"><Link to="/forgot-password" className="font-bold underline">Forgot password?</Link></p>
          <p className="text-center text-brand-cream text-sm mt-8">Don&apos;t have an account yet? <Link to="/signup" className="font-bold underline">Create Account</Link></p>
        </form>
      </div>
  );
}
