import { useState, useContext, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { AuthContext } from '../context/AuthContext';
import { BookOpen, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

// Animated background orbs
function FloatingOrbs() {
  const orbs = useMemo(() => [
    { w: 300, h: 300, l: '10%',  t: '10%',  color: 'rgba(124,58,237,0.12)' },
    { w: 200, h: 200, l: '60%',  t: '60%',  color: 'rgba(6,182,212,0.08)' },
    { w: 150, h: 150, l: '80%',  t: '20%',  color: 'rgba(245,158,11,0.06)' },
  ], []);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{ width: o.w, height: o.h, left: o.l, top: o.t, background: o.color }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 6 + i * 2, repeat: Infinity, ease: 'easeInOut', delay: i * 1.5 }}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, loginWithGoogle, error, setError, sessionExpired, setSessionExpired } = useContext(AuthContext);
  const navigate  = useNavigate();
  const location  = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  // Clear session expired message once user starts typing
  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    if (sessionExpired) setSessionExpired(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const status  = err.response?.status;
      const message = err.response?.data?.message || 'Login failed. Please try again.';
      setError(status === 403 && message?.toLowerCase().includes('banned')
        ? '🚫 Your account has been banned. Please contact support.'
        : message);
    } finally { setSubmitting(false); }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    const credential = credentialResponse?.credential;
    if (!credential) { setError('Google login failed. Please try again.'); return; }
    setSubmitting(true); setError(null);
    try {
      await loginWithGoogle(credential);
      navigate(from, { replace: true });
    } catch (err) {
      const status  = err.response?.status;
      const message = err.response?.data?.message || 'Google login failed.';
      setError(status === 403 && message?.toLowerCase().includes('banned') ? '🚫 Account banned.' : message);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-nx-gradient flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <FloatingOrbs />

      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.4)] group-hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] transition-shadow">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Nexus<span className="text-violet-400">Read</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="glass-card-static p-8 shadow-2xl shadow-black/50">
          <div className="mb-7">
            <h1 className="text-2xl font-extrabold text-white mb-1">Welcome back</h1>
            <p className="text-slate-500 text-sm">Sign in to your reading universe</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Session expired banner */}
            {sessionExpired && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                Your session has expired. Please sign in again.
              </motion.div>
            )}
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  id="email" type="email" value={email}
                  onChange={handleInputChange(setEmail)}
                  required autoComplete="email"
                  placeholder="you@example.com "
                  className="nx-input pl-10 "
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  id="password" type="password" value={password}
                  onChange={handleInputChange(setPassword)}
                  required autoComplete="current-password"
                  placeholder="••••••••"
                  className="nx-input pl-10"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white font-semibold text-sm transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs text-slate-600 bg-[#12122a]">or continue with</span>
            </div>
          </div>

          {/* Google */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google login failed. Please try again.')}
              useOneTap={false}
              theme="filled_black"
              shape="pill"
              size="large"
            />
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-slate-600 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Sign up free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
