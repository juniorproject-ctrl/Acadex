import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import BrandLogo from '../components/BrandLogo';
import { api } from '../lib/api';
import { getAllowedUniversityEmailMessage, getPasswordMessage, isAllowedUniversityEmail, isStrongPassword } from '../lib/emailValidation';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isAllowedUniversityEmail(email)) return setError(getAllowedUniversityEmailMessage());
    if (!isStrongPassword(password)) return setError(getPasswordMessage());

    setLoading(true);
    try {
      const result = await api.register({ name: name.trim(), email: email.trim(), password, role: 'student' });
      sessionStorage.setItem('acadex_pending_verification_email', result.email);
      navigate('/verify', { state: { email: result.email } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create the account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="mb-6"><BrandLogo size="lg" /></div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="auth-container">
        <h2 className="text-brand-cream text-3xl font-bold text-center mb-2">Sign Up</h2>
        <p className="text-brand-cream text-center opacity-80 mb-8">Please enter your details to sign up.</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-100 text-red-600 p-3 rounded-lg text-xs font-bold text-center">{error}</div>}
          <div className="space-y-2"><label className="text-brand-cream font-medium block">Name</label><input type="text" placeholder="Enter your name" className="input-field" value={name} onChange={(event) => setName(event.target.value)} required disabled={loading} /></div>
          <div className="space-y-2"><label className="text-brand-cream font-medium block">Email</label><input type="email" placeholder="Enter your university email" className="input-field" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} /></div>
          <div className="space-y-2"><label className="text-brand-cream font-medium block">Password</label><input type="password" placeholder="At least 8 characters, number and symbol" className="input-field" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} /></div>
          <button type="submit" disabled={loading} className="w-full btn-primary mt-6">{loading ? 'Sending code...' : 'Sign up'}</button>
          <p className="text-center text-brand-cream text-sm mt-8">Already have an account? <Link to="/" className="font-bold underline">Log in</Link></p>
        </form>
      </motion.div>
    </div>
  );
}
