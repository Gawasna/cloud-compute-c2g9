import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import BrandSplashScreen from '@/components/ui/BrandSplashScreen';
import { ACCESS_COOKIE } from '@/lib/auth/session-cookies';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!token) {
    redirect('/login');
  }

  return (
    <Suspense
      fallback={
        <BrandSplashScreen message="Đang chuẩn bị không gian làm việc CloudStock…" />
      }
    >
      <AuthGate />
    </Suspense>
  );
}
