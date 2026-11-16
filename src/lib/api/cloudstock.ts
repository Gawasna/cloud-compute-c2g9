import { authedFetch } from '@/lib/auth/client';
import { captureLooseError } from '@/lib/observability';

// Cookie-based sessions only work same-origin, so the API base is always the relative /api.
const BASE = '/api';

export interface ApiProduct {
  id: string;
  name: string;
  name_en?: string | null;
  sku: string;
  category_id: string;
  unit_id: string;
  category_name: string;
  category_name_en?: string | null;
  unit_symbol: string;
  unit_symbol_en?: string | null;
  cost_price: string | number;
  stock_quantity: number;
  minimum_stock: number;
  image_url?: string | null;
}

export interface ApiCategory {
  id: string;
  name: string;
  name_en?: string | null;
}

export interface ApiUnit {
  id: string;
  name: string;
  symbol: string;
  name_en?: string | null;
  symbol_en?: string | null;
}

export interface ApiMovement {
  id: string;
  sku: string;
  type: 'IN' | 'OUT';
  quantity: number;
  performed_by: string;
  actor_role?: 'admin' | 'staff' | 'viewer' | null;
  actor_name?: string | null;
  created_at: string;
  note: string | null;
}

export interface ApiDashboard {
  summary: {
    total_products: number;
    total_units: number;
    inventory_value: string;
    low_stock: number;
    out_of_stock: number;
  };
  history: {
    day: string;
    type: 'IN' | 'OUT';
    quantity: number;
  }[];
}

export interface ArchivedProduct {
  id: string;
  name: string;
  name_en: string | null;
  sku: string;
  category_name: string;
  category_name_en: string | null;
  unit_symbol: string;
  unit_symbol_en: string | null;
  stock_quantity: number;
  deleted_at: string;
  image_url?: string | null;
}

export interface ArchivedResponse {
  items: ArchivedProduct[];
  total: number;
  page: number;
  limit: number;
}

export async function apiRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method || 'GET';
  let response: Response;
  try {
    response = await authedFetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch (networkErr) {
    try {
      captureLooseError(networkErr, {
        path,
        method,
        networkError: true,
      });
    } catch {
      // resilient
    }
    throw networkErr;
  }

  if (response.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const raw = payload.message;
    const message = Array.isArray(raw)
      ? raw.join(', ')
      : typeof raw === 'string'
      ? raw
      : `Request failed (${response.status})`;
    const err = new Error(message);

    if (response.status >= 500) {
      try {
        captureLooseError(err, {
          path,
          method,
          status: response.status,
        });
      } catch {
        // resilient
      }
    }

    throw err;
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type ReportPeriod = 'day' | 'week' | 'month';

export interface TrendResponse {
  period: ReportPeriod;
  timezone: string;
  points: {
    period: string;
    inbound: string | number;
    outbound: string | number;
  }[];
}

export interface LowStockItem {
  id: string;
  sku: string;
  name: string;
  stock_quantity: number;
  minimum_stock: number;
  shortage: number;
  status: 'OUT' | 'LOW';
}

export async function downloadReportCsv(kind: 'inventory' | 'low-stock' | 'movements') {
  const path = `/reports/export?kind=${encodeURIComponent(kind)}`;
  let response: Response;
  try {
    response = await authedFetch(`${BASE}${path}`);
  } catch (networkErr) {
    try {
      captureLooseError(networkErr, {
        path,
        method: 'GET',
        kind,
        networkError: true,
      });
    } catch {
      // resilient
    }
    throw networkErr;
  }

  if (response.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || 'Unable to export report';
    const err = new Error(message);

    if (response.status >= 500) {
      try {
        captureLooseError(err, {
          path,
          method: 'GET',
          status: response.status,
          kind,
        });
      } catch {
        // resilient
      }
    }

    throw err;
  }

  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `cloudstock-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 2000);
}
