import React from 'react';
import type { Role } from '@/components/layout/Sidebar';
import { StockBadge, Skeleton } from '@/components/ui';
import {
  PackageIcon,
  ArchiveIcon,
  AlertTriangleIcon,
  BanIcon,
  ExternalLinkIcon,
  renderCategoryIcon,
} from '@/components/ui/Icons';
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

  const donutInStockPercent = products.length ? (inStockCount / products.length) * 100 : 0;
  const donutLowPercent = products.length ? ((inStockCount + lowCount) / products.length) * 100 : 0;

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
            <div className="metric">
              <span>Total Products</span>
              <b>{products.length.toLocaleString('en-US')}</b>
              <small className="change positive">Managed catalog items</small>
              <span className="metric-icon">
                <PackageIcon size={20} />
              </span>
            </div>
            <div className="metric">
              <span>Total Stock Units</span>
              <b>{totalUnits.toLocaleString('en-US')}</b>
              <small className="change positive">Units currently on hand</small>
              <span className="metric-icon">
                <ArchiveIcon size={20} />
              </span>
            </div>
            <div className="metric">
              <span>Low Stock Alert</span>
              <b>{lowCount}</b>
              <small className="change negative">Needs replenishment</small>
              <span className="metric-icon">
                <AlertTriangleIcon size={20} />
              </span>
            </div>
            <div className="metric">
              <span>Out of Stock</span>
              <b>{outCount}</b>
              <small className="change negative">Requires immediate action</small>
              <span className="metric-icon">
                <BanIcon size={20} />
              </span>
            </div>
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

          <div className="chart">
            {Array.from({ length: 7 }, (_, i) => {
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
              const max = Math.max(
                25,
                ...(dashboardStats?.history || []).map((t) => Number(t.quantity))
              );

              return (
                <div className="chart-col" key={day.toISOString()}>
                  <div className="bars">
                    <span
                      className="bar bar-in"
                      title={`Inbound ${ins}`}
                      style={{ height: `${Math.max(4, (ins / max) * 100)}%` }}
                    />
                    <span
                      className="bar bar-out"
                      title={`Outbound ${outs}`}
                      style={{ height: `${Math.max(4, (outs / max) * 100)}%` }}
                    />
                  </div>
                  <small>
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel alerts-panel">
          <div className="panel-head">
            <div>
              <h2>Stock Distribution</h2>
              <p>Inventory level categorization</p>
            </div>
          </div>

          <div
            className="donut"
            style={{
              background: `conic-gradient(#65bf92 0 ${donutInStockPercent}%, #ff9b93 ${donutInStockPercent}% ${donutLowPercent}%, #a9a9bd ${donutLowPercent}% 100%)`,
            }}
          >
            <div>
              <b>{products.length}</b>
              <span>items</span>
            </div>
          </div>

          <div className="donut-legend">
            <div>
              <i className="dot green" />
              In Stock <strong>{inStockCount}</strong>
            </div>
            <div>
              <i className="dot coral" />
              Low Stock <strong>{lowCount}</strong>
            </div>
            <div>
              <i className="dot gray" />
              Out of Stock <strong>{outCount}</strong>
            </div>
          </div>
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>{role === 'viewer' ? 'View Reports' : 'View All'}</span>
            <ExternalLinkIcon size={14} />
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
                      <span className="item-avatar">
                        {renderCategoryIcon(p.category, { size: 16 })}
                      </span>
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
