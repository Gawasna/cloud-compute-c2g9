'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getIdentity, login, logout } from '@/lib/auth/client';
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getIdentity().then(user => { if (active && user) router.replace('/'); }).catch(() => {}).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      await login(email.trim(), password);
      const identity = await getIdentity();
      if (!identity) throw new Error('Unable to verify account.');
      router.replace('/');
    } catch (err) {
      await logout().catch(() => {});
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally { setBusy(false); }
  }
  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><span className="auth-brand-icon">▥</span> Cloud<span>Stock</span></div>
      <div className="auth-eyebrow">INVENTORY MANAGEMENT SYSTEM</div>
      <h1>Sign in</h1>
      <p>Welcome back! Sign in with your administrator-provided account.</p>
      <form onSubmit={submit}>
        <label htmlFor="cloud-email">Email Address</label>
        <input id="cloud-email" type="email" autoComplete="username" placeholder="ten@congty.com" value={email} onChange={e => setEmail(e.target.value)} required />
        <label htmlFor="cloud-password">Password</label>
        <div className="auth-password"><input id="cloud-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={1} placeholder="Enter password" /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" type="submit" disabled={busy || checking}>{busy ? 'Signing in…' : checking ? 'Checking session…' : 'Sign in →'}</button>
      </form>
      <div className="auth-note">Need an account? Contact your administrator.</div>
    </section>
    <aside className="auth-aside"><div className="auth-aside-mark">▥</div><h2>Control your inventory.<br />Anytime, anywhere.</h2><p>Manage products, track movements, and review inventory reports in one place.</p><div className="auth-aside-features"><span>✓ Secure sign-in</span><span>✓ Three access roles</span><span>✓ Access control</span></div></aside>
  </main>;
}
