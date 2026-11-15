import type { Locale } from './types';

export function interpolate(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

export function formatNumber(value: number, locale: Locale = 'vi'): string {
  const code = locale === 'vi' ? 'vi-VN' : 'en-US';
  return new Intl.NumberFormat(code).format(value);
}

export function formatCurrency(value: number, locale: Locale = 'vi'): string {
  const code = locale === 'vi' ? 'vi-VN' : 'en-US';
  const formatted = new Intl.NumberFormat(code).format(value);
  return `${formatted} ₫`;
}

export function formatDate(
  dateInput: string | number | Date,
  locale: Locale = 'vi',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';

  const code = locale === 'vi' ? 'vi-VN' : 'en-US';
  const defaultOptions: Intl.DateTimeFormatOptions = options || {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };

  return new Intl.DateTimeFormat(code, defaultOptions).format(d);
}

export function formatWeekday(
  dateInput: string | number | Date,
  locale: Locale = 'vi'
): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';

  const code = locale === 'vi' ? 'vi-VN' : 'en-US';
  return d.toLocaleDateString(code, { weekday: 'short' });
}
