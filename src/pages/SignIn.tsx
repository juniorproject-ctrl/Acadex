import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import BrandLogo from '../components/BrandLogo';
import { api } from '../lib/api';
import { setSession } from '../lib/auth';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.login(email, password);
      setSession(result.token, result.user);
      navigate('/home');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="mb-6"><BrandLogo size="lg" /></div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="auth-container">
        <h2 className="text-brand-cream text-3xl font-bold text-center mb-2">Welcome Back!</h2>
        <p className="text-brand-cream text-center opacity-80 mb-8">Please enter your details to sign in.</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-100 text-red-600 p-3 rounded-lg text-xs font-bold text-center">{error}</div>}
          <div className="space-y-2">
            <label className="text-brand-cream font-medium block">Email</label>
            <input type="email" placeholder="Enter your university email" className="input-field" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
          </div>
          <div className="space-y-2">
            <label className="text-brand-cream font-medium block">Password</label>
            <input type="password" placeholder="Enter your password" className="input-field" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} />
          </div>
          <button type="submit" disabled={loading} className="w-full btn-primary mt-4">{loading ? 'Signing in...' : 'Sign In'}</button>
          <p className="text-center text-brand-cream text-sm"><Link to="/forgot-password" className="font-bold underline">Forgot password?</Link></p>
          <p className="text-center text-brand-cream text-sm mt-8">Don&apos;t have an account yet? <Link to="/signup" className="font-bold underline">Create Account</Link></p>
        </form>
      </motion.div>
      <Link to="/feedback" className="text-link mt-6">Share feedback</Link>
    </div>
  );
}
