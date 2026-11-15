'use client';

import React, { useMemo } from 'react';
import type { Role } from '@/components/layout/Sidebar';
import { MetricCard, StockBadge, Skeleton } from '@/components/ui';
import { MovementTrendChart, StockDistributionChart } from '@/components/charts';
import type { Product, ApiDashboard } from './types';

export interface OverviewTabProps {
  role: Role;
  loading: boolean;
  products: Product[];
  dashboardStats: ApiDashboard | null;
  onNavigateTab: (tab: 'products' | 'reports') => void;
}

export default function OverviewTab({
  role,
  loading,
  products,
  dashboardStats,
  onNavigateTab,
}: OverviewTabProps) {
  const lowCount = products.filter((p) => p.stock > 0 && p.stock < p.minimum).length;
  const outCount = products.filter((p) => p.stock === 0).length;
  const inStockCount = Math.max(0, products.length - lowCount - outCount);
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);

  const recentProducts = products.slice(0, 6);

  const movementTrendPoints = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date();
      day.setDate(day.getDate() - 6 + i);
      const sameDay = (v: string) =>
        new Date(v).toDateString() === day.toDateString();
      const daily = (dashboardStats?.history || []).filter((t) =>
        sameDay(t.day)
      );
      const ins = daily
        .filter((t) => t.type === 'IN')
        .reduce((s, t) => s + Number(t.quantity), 0);
      const outs = daily
        .filter((t) => t.type === 'OUT')
        .reduce((s, t) => s + Number(t.quantity), 0);

      return {
        period: day.toISOString(),
        label: day.toLocaleDateString('en-US', { weekday: 'short' }),
        inbound: ins,
        outbound: outs,
      };
    });
  }, [dashboardStats?.history]);

  const getCategoryIcon = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('electronics') || c.includes('điện tử')) return '⌁';
    if (c.includes('home') || c.includes('gia dụng')) return '▤';
    if (c.includes('fashion') || c.includes('thời trang')) return '◈';
    return '▣';
  };

  return (
    <>
      <div className="metrics">
        {loading ? (
          <>
            <div className="metric"><Skeleton height={24} width="40%" /><div style={{ height: 12 }} /><Skeleton height={36} width="60%" /></div>
            <div className="metric"><Skeleton height={24} width="40%" /><div style={{ height: 12 }} /><Skeleton height={36} width="60%" /></div>
            <div className="metric"><Skeleton height={24} width="40%" /><div style={{ height: 12 }} /><Skeleton height={36} width="60%" /></div>
            <div className="metric"><Skeleton height={24} width="40%" /><div style={{ height: 12 }} /><Skeleton height={36} width="60%" /></div>
          </>
        ) : (
          <>
            <MetricCard
              title="Total Products"
              value={products.length.toLocaleString('en-US')}
              changeText="Managed catalog items"
              changeType="positive"
              icon="◈"
            />
            <MetricCard
              title="Total Stock Units"
              value={totalUnits.toLocaleString('en-US')}
              changeText="Units currently on hand"
              changeType="positive"
              icon="▤"
            />
            <MetricCard
              title="Low Stock Alert"
              value={lowCount}
              changeText="Needs replenishment"
              changeType="negative"
              icon="⚑"
            />
            <MetricCard
              title="Out of Stock"
              value={outCount}
              changeText="Requires immediate action"
              changeType="negative"
              icon="⊘"
            />
          </>
        )}
      </div>

      <div className="analytics">
        <section className="panel chart-panel">
          <div className="panel-head">
            <div>
              <h2>Movement Trends</h2>
              <p>Inbound and outbound transaction quantities over the past 7 days</p>
            </div>
            <span className="pill">7 days</span>
          </div>

          <div className="legend">
            <span>
              <i className="dot purple" />
              Inbound
            </span>
            <span>
              <i className="dot coral" />
              Outbound
            </span>
          </div>

          {loading ? (
            <div className="chart-placeholder" style={{ height: '220px' }}>
              Loading movement trends...
            </div>
          ) : (
            <MovementTrendChart
              data={movementTrendPoints}
              height={220}
              emptyText="No transaction history in the past 7 days"
            />
          )}
        </section>

        <section className="panel alerts-panel">
          <div className="panel-head">
            <div>
              <h2>Stock Distribution</h2>
              <p>Inventory level categorization</p>
            </div>
          </div>

          {loading ? (
            <div className="chart-placeholder" style={{ height: '230px' }}>
              Loading stock distribution...
            </div>
          ) : (
            <StockDistributionChart
              inStockCount={inStockCount}
              lowStockCount={lowCount}
              outOfStockCount={outCount}
              totalProducts={products.length}
              height={180}
              showLegend={true}
            />
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Product Catalog</h2>
            <p>Latest stock inventory records</p>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() => onNavigateTab(role === 'viewer' ? 'reports' : 'products')}
          >
            {role === 'viewer' ? 'View Reports' : 'View All'} ↗
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Threshold</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentProducts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="item-name">
                      <span className="item-avatar">{getCategoryIcon(p.category)}</span>
                      <strong>{p.name}</strong>
                    </div>
                  </td>
                  <td className="mono">{p.sku}</td>
                  <td>{p.category}</td>
                  <td>
                    {p.stock.toLocaleString('en-US')} {p.unit.toLowerCase()}
                  </td>
                  <td>{p.minimum}</td>
                  <td>
                    <StockBadge stock={p.stock} minimum={p.minimum} />
                  </td>
                </tr>
              ))}
              {recentProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    {loading ? 'Loading catalog items...' : 'No products found in warehouse.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
