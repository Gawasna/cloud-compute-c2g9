import React from 'react';

export interface StockBadgeProps {
  stock: number;
  minimum: number;
  className?: string;
}

export function getStockStatus(stock: number, minimum: number): {
  label: string;
  variant: 'danger' | 'warning' | 'success';
} {
  if (stock === 0) {
    return { label: 'Hết hàng', variant: 'danger' };
  }
  if (stock < minimum) {
    return { label: 'Sắp hết', variant: 'warning' };
  }
  return { label: 'Còn hàng', variant: 'success' };
}

export default function StockBadge({ stock, minimum, className = '' }: StockBadgeProps) {
  const { label, variant } = getStockStatus(stock, minimum);
  return (
    <span className={`tag ${variant} ${className}`.trim()}>
      {label}
    </span>
  );
}
