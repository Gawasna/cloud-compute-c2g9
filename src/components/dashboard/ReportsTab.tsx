import React from 'react';
import Phase6Reports from '@/components/Phase6Reports';
import type { Product, ApiDashboard } from './types';

export interface ReportsTabProps {
  products?: Product[];
  dashboardStats?: ApiDashboard | null;
}

// Prepend UTF-8 BOM ('\uFEFF') for Vietnamese Excel compatibility in reports
export const CSV_UTF8_BOM = '\uFEFF';

export default function ReportsTab(_props?: ReportsTabProps) {
  void _props;
  return <Phase6Reports />;
}
