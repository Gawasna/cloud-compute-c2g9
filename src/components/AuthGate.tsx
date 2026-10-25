'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import { getIdentity, type Identity } from '@/lib/auth/client';
export default function AuthGate() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    getIdentity().then(user => {
      if (!alive) return;
      if (!user) router.replace('/login'); else setIdentity(user);
    }).catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Lỗi xác thực.'); });
    return () => { alive = false; };
  }, [router]);
  if (error) return <div className="auth-screen"><div className="auth-card"><h1>Không thể xác thực</h1><p role="alert">{error}</p><button className="auth-submit" onClick={() => window.location.reload()}>Thử lại</button><a href="/login">Quay về đăng nhập</a></div></div>;
  if (!identity) return <div className="auth-screen"><div className="auth-card"><p>Đang xác minh phiên đăng nhập và vai trò…</p></div></div>;
  return <Dashboard identity={identity} />;
}
