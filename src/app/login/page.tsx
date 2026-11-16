'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getIdentity, login, logout } from '@/lib/auth/client';
import {
  BoxesIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
} from '@/components/ui/Icons';
import { I18nProvider, useI18n, LanguageSwitcher } from '@/lib/i18n';

function LoginForm() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getIdentity()
      .then((user) => {
        if (active && user) router.replace('/');
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      const identity = await getIdentity();
      if (!identity) {
        throw new Error(
          locale === 'vi'
            ? 'Không thể xác thực phiên làm việc của tài khoản.'
            : 'Unable to verify account session.'
        );
      }
      router.replace('/');
    } catch (err) {
      await logout().catch(() => {});
      setError(
        err instanceof Error
          ? err.message
          : locale === 'vi'
          ? 'Đăng nhập không thành công.'
          : 'Sign-in failed.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      <section className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-icon">
            <BoxesIcon size={24} />
          </span>{' '}
          Cloud<span>Stock</span>
        </div>
        <div className="auth-eyebrow">{t.login.eyebrow}</div>
        <h1>{t.login.title}</h1>
        <p>{t.login.welcome}</p>
        <form onSubmit={submit}>
          <label htmlFor="cloud-email">{t.login.email}</label>
          <input
            id="cloud-email"
            type="email"
            autoComplete="username"
            placeholder={t.login.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="cloud-password">{t.login.password}</label>
          <div className="auth-password">
            <input
              id="cloud-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={1}
              placeholder={t.login.passwordPlaceholder}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t.login.hideAria : t.login.showAria}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            </button>
          </div>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <button className="auth-submit" type="submit" disabled={busy || checking}>
            {busy ? (
              t.login.submitting
            ) : checking ? (
              t.login.checking
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span>{t.login.submit}</span>
                <ArrowRightIcon size={16} />
              </span>
            )}
          </button>
        </form>
        <div className="auth-note">{t.login.needAccount}</div>
      </section>
      <aside className="auth-aside">
        <div className="auth-aside-mark">
          <BoxesIcon size={36} />
        </div>
        <h2>
          {locale === 'vi' ? (
            <>
              Kiểm soát tồn kho chặt chẽ.
              <br />
              Mọi lúc, mọi nơi.
            </>
          ) : (
            <>
              Control your inventory.
              <br />
              Anytime, anywhere.
            </>
          )}
        </h2>
        <p>{t.login.asideDesc}</p>
        <div className="auth-aside-features">
          <span>
            <CheckCircle2Icon size={16} /> {t.login.feature1}
          </span>
          <span>
            <CheckCircle2Icon size={16} /> {t.login.feature2}
          </span>
          <span>
            <CheckCircle2Icon size={16} /> {t.login.feature3}
          </span>
        </div>
      </aside>
    </main>
  );
}

export default function LoginPage() {
  return (
    <I18nProvider>
      <LoginForm />
    </I18nProvider>
  );
}
