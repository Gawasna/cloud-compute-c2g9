import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  title?: string;
  children: ReactNode;
}

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label?: string;
  error?: string;
}

export { default as StockBadge, getStockStatus } from './StockBadge';
export type { StockBadgeProps } from './StockBadge';

export { default as MetricCard } from './MetricCard';
export type { MetricCardProps } from './MetricCard';

export { default as Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { default as EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { default as Toast } from './Toast';
export type { ToastProps } from './Toast';

export { default as Modal } from './Modal';
export type { ModalProps } from './Modal';
