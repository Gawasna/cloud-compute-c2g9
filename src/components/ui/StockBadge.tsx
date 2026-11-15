import React from 'react';

export interface StockBadgeProps {
  stock: number;
  minimum: number;
  lang?: 'en' | 'vi';
  className?: string;
}

export function getStockStatus(stock: number, minimum: number, lang: 'en' | 'vi' = 'en'): {
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

export default function StockBadge({ stock, minimum, lang = 'en', className = '' }: StockBadgeProps) {
  const { label, variant } = getStockStatus(stock, minimum, lang);
  return (
    <span className={`tag ${variant} ${className}`.trim()}>
      {label}
    </span>
  );
}
