'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';

export interface StockBadgeProps {
  stock: number;
  minimum: number;
  lang?: 'en' | 'vi';
  className?: string;
}

export function getStockStatus(stock: number, minimum: number, lang: 'en' | 'vi' = 'vi'): {
  label: string;
  variant: 'danger' | 'warning' | 'success';
} {
  // Backward-compatible localization: support both English (Issue #19) and Vietnamese ('Hết hàng', 'Sắp hết', 'Còn hàng')
  if (stock === 0) {
    return { label: lang === 'vi' ? 'Hết hàng' : 'Out of Stock', variant: 'danger' };
  }
  if (stock < minimum) {
    return { label: lang === 'vi' ? 'Sắp hết' : 'Low Stock', variant: 'warning' };
  }
  return { label: lang === 'vi' ? 'Còn hàng' : 'In Stock', variant: 'success' };
}

export default function StockBadge({ stock, minimum, lang, className = '' }: StockBadgeProps) {
  const { locale } = useI18n();
  const effectiveLang = lang || locale || 'vi';
  const { label, variant } = getStockStatus(stock, minimum, effectiveLang);

  return (
    <span className={`tag ${variant} ${className}`.trim()}>
      {label}
    </span>
  );
}
