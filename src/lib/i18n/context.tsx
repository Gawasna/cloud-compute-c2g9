'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { Locale, Dictionary } from './types';
import vi from './dictionaries/vi';
import en from './dictionaries/en';
import {
  formatNumber as fn,
  formatCurrency as fc,
  formatDate as fd,
  formatWeekday as fw,
  interpolate,
} from './formatters';

export const LOCALE_COOKIE = 'cloudstock_locale';
export const LOCALE_STORAGE_KEY = 'cloudstock_locale';
export const DEFAULT_LOCALE: Locale = 'vi';

export const DICTIONARIES: Record<Locale, Dictionary> = {
  vi,
  en,
};

export interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  t: Dictionary;
  formatNumber: (value: number) => string;
  formatCurrency: (value: number) => string;
  formatDate: (date: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatWeekday: (date: string | number | Date) => string;
  interpolate: (template: string, params: Record<string, string | number>) => string;
}

const defaultContextValue: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  toggleLocale: () => {},
  t: vi,
  formatNumber: (v: number) => fn(v, DEFAULT_LOCALE),
  formatCurrency: (v: number) => fc(v, DEFAULT_LOCALE),
  formatDate: (d, opt) => fd(d, DEFAULT_LOCALE, opt),
  formatWeekday: (d) => fw(d, DEFAULT_LOCALE),
  interpolate,
};

const I18nContext = createContext<I18nContextValue>(defaultContextValue);

function getClientInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  try {
    const stored = window.localStorage?.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'vi' || stored === 'en') return stored;

    const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
    if (cookieMatch && (cookieMatch[1] === 'vi' || cookieMatch[1] === 'en')) {
      return cookieMatch[1] as Locale;
    }
  } catch {
    // Storage access forbidden or unavailable
  }

  return DEFAULT_LOCALE;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale || getClientInitialLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(LOCALE_STORAGE_KEY, next);
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
        document.documentElement.lang = next;
      } catch {
        // Storage failure ignored
      }
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'vi' ? 'en' : 'vi');
  }, [locale, setLocale]);

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
    return {
      locale,
      setLocale,
      toggleLocale,
      t: dict,
      formatNumber: (v: number) => fn(v, locale),
      formatCurrency: (v: number) => fc(v, locale),
      formatDate: (d, opt) => fd(d, locale, opt),
      formatWeekday: (d) => fw(d, locale),
      interpolate,
    };
  }, [locale, setLocale, toggleLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, toggleLocale } = useI18n();

  return (
    <button
      type="button"
      className={`lang-switcher-btn ${className}`.trim()}
      onClick={toggleLocale}
      title={locale === 'vi' ? 'Chuyển sang Tiếng Anh (EN)' : 'Switch to Vietnamese (VI)'}
      aria-label={locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '5px 10px',
        fontSize: '12px',
        fontWeight: 600,
        borderRadius: '6px',
        border: '1px solid var(--border, #313543)',
        background: 'var(--surface, #1e222d)',
        color: 'var(--text, #f0f2f7)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{ opacity: locale === 'vi' ? 1 : 0.45 }}>VI</span>
      <span style={{ opacity: 0.35 }}>/</span>
      <span style={{ opacity: locale === 'en' ? 1 : 0.45 }}>EN</span>
    </button>
  );
}
