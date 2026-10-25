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
      if (!identity) throw new Error('Không xác thực được tài khoản.');
      router.replace('/');
    } catch (err) {
      await logout().catch(() => {});
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally { setBusy(false); }
  }
  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><span className="auth-brand-icon">▥</span> Cloud<span>Stock</span></div>
      <div className="auth-eyebrow">HỆ THỐNG QUẢN LÝ KHO</div>
      <h1>Đăng nhập</h1>
      <p>Chào mừng trở lại! Sử dụng tài khoản do quản trị viên cấp để truy cập hệ thống.</p>
      <form onSubmit={submit}>
        <label htmlFor="cloud-email">Địa chỉ email</label>
        <input id="cloud-email" type="email" autoComplete="username" placeholder="ten@congty.com" value={email} onChange={e => setEmail(e.target.value)} required />
        <label htmlFor="cloud-password">Mật khẩu</label>
        <div className="auth-password"><input id="cloud-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={1} placeholder="Nhập mật khẩu" /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? 'Ẩn' : 'Hiện'}</button></div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" type="submit" disabled={busy || checking}>{busy ? 'Đang đăng nhập…' : checking ? 'Đang kiểm tra phiên…' : 'Đăng nhập →'}</button>
      </form>
      <div className="auth-note">Chưa có tài khoản? Vui lòng liên hệ quản trị viên.</div>
    </section>
    <aside className="auth-aside"><div className="auth-aside-mark">▥</div><h2>Kiểm soát kho hàng.<br />Mọi lúc, mọi nơi.</h2><p>Quản lý sản phẩm, theo dõi giao dịch và báo cáo tồn kho trên một nền tảng thống nhất.</p><div className="auth-aside-features"><span>✓ Đăng nhập an toàn</span><span>✓ 3 cấp độ phân quyền</span><span>✓ Bảo mật truy cập</span></div></aside>
  </main>;
}
