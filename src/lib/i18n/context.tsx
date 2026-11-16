'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
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
  isMounted: boolean;
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
  isMounted: false,
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
  // Always initialize with initialLocale or DEFAULT_LOCALE to ensure deterministic hydration
  const [locale, setLocaleState] = useState<Locale>(initialLocale || DEFAULT_LOCALE);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    // Synchronize client-persisted preference (localStorage/cookie) after hydration completes
    const clientLocale = getClientInitialLocale();
    if (clientLocale && clientLocale !== (initialLocale || DEFAULT_LOCALE)) {
      setLocaleState(clientLocale);
      try {
        document.documentElement.lang = clientLocale;
      } catch {
        // Document manipulation failure ignored
      }
    }
  }, [initialLocale]);

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
      isMounted,
    };
  }, [locale, setLocale, toggleLocale, isMounted]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export function VietnamFlag({ size = 16, className = '' }: { size?: number; className?: string }) {
  const width = size;
  const height = Math.round((size * 2) / 3) || 11;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 30 20"
      className={className}
      style={{ borderRadius: '2px', overflow: 'hidden', flexShrink: 0, display: 'inline-block' }}
      aria-hidden="true"
    >
      <rect width="30" height="20" fill="#da251d" />
      <polygon
        points="15,4 16.545,8.755 21.548,8.755 17.501,11.695 19.046,16.45 15,13.51 10.954,16.45 12.499,11.695 8.452,8.755 13.455,8.755"
        fill="#ffff00"
      />
    </svg>
  );
}

export function UkFlag({ size = 16, className = '' }: { size?: number; className?: string }) {
  const width = size;
  const height = Math.round((size * 2) / 3) || 11;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 30"
      className={className}
      style={{ borderRadius: '2px', overflow: 'hidden', flexShrink: 0, display: 'inline-block' }}
      aria-hidden="true"
    >
      <clipPath id="uk-flag-clip">
        <rect width="60" height="30" />
      </clipPath>
      <g clipPath="url(#uk-flag-clip)">
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#c8102e" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
      </g>
    </svg>
  );
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectLocale = useCallback(
    (next: Locale) => {
      setLocale(next);
      setOpen(false);
    },
    [setLocale]
  );

  return (
    <div ref={containerRef} className={`lang-switcher-wrapper ${className}`.trim()}>
      <button
        type="button"
        className={`lang-switcher-trigger ${open ? 'open' : ''}`.trim()}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          locale === 'vi'
            ? 'Chọn ngôn ngữ (Tiếng Việt đang chọn)'
            : 'Select language (English selected)'
        }
        title={locale === 'vi' ? 'Chuyển đổi ngôn ngữ' : 'Switch language'}
      >
        <span className="lang-trigger-globe">
          <Globe size={15} strokeWidth={1.8} aria-hidden="true" />
        </span>
        {locale === 'vi' ? <VietnamFlag size={18} /> : <UkFlag size={18} />}
        <span className="lang-trigger-code">{locale === 'vi' ? 'VI' : 'EN'}</span>
        <span className={`lang-trigger-arrow ${open ? 'open' : ''}`.trim()}>
          <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className="lang-dropdown-menu" role="listbox" aria-label="Languages">
          <button
            type="button"
            role="option"
            aria-selected={locale === 'vi'}
            className={`lang-dropdown-item ${locale === 'vi' ? 'active' : ''}`.trim()}
            onClick={() => selectLocale('vi')}
          >
            <VietnamFlag size={18} />
            <span className="lang-item-label">
              <span>Tiếng Việt</span>
              <span className="lang-item-code">(VI)</span>
            </span>
            {locale === 'vi' && (
              <span className="lang-item-check">
                <Check size={14} strokeWidth={2.4} aria-hidden="true" />
              </span>
            )}
          </button>

          <button
            type="button"
            role="option"
            aria-selected={locale === 'en'}
            className={`lang-dropdown-item ${locale === 'en' ? 'active' : ''}`.trim()}
            onClick={() => selectLocale('en')}
          >
            <UkFlag size={18} />
            <span className="lang-item-label">
              <span>English</span>
              <span className="lang-item-code">(EN)</span>
            </span>
            {locale === 'en' && (
              <span className="lang-item-check">
                <Check size={14} strokeWidth={2.4} aria-hidden="true" />
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
