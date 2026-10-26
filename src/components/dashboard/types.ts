import type { ApiProduct, ApiMovement, ApiDashboard, ApiCategory, ApiUnit } from '@/lib/api/cloudstock';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  minimum: number;
}

export interface MovementTx {
  id: string;
  type: 'IN' | 'OUT';
  sku: string;
  quantity: number;
  actor: string;
  date: string;
  note: string;
}

export const formatMoney = (v: number): string =>
  new Intl.NumberFormat('vi-VN').format(v) + ' ₫';

export const formatDate = (v: string): string =>
  new Date(v).toLocaleString('vi-VN');

export const mapProductFromApi = (p: ApiProduct): Product => ({
  id: p.id,
  name: p.name,
  sku: p.sku,
  category: p.category_name,
  unit: p.unit_symbol,
  price: Number(p.cost_price),
  stock: Number(p.stock_quantity),
  minimum: Number(p.minimum_stock),
});

export const mapMovementFromApi = (
  t: ApiMovement,
  roleNames: Record<string, string>
): MovementTx => ({
  id: t.id,
  type: t.type,
  sku: t.sku,
  quantity: t.quantity,
  actor: (t.actor_role && roleNames[t.actor_role]) || 'Chưa xác định',
  date: t.created_at,
  note: t.note || '',
});

export type { ApiProduct, ApiMovement, ApiDashboard, ApiCategory, ApiUnit };
