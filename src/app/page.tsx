import { Suspense } from 'react';
import AuthGate from '@/components/AuthGate';

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="auth-screen">
          <div className="auth-card">
            <p>Đang chuẩn bị không gian làm việc CloudStock…</p>
          </div>
        </div>
      }
    >
      <AuthGate />
    </Suspense>
  );
}
