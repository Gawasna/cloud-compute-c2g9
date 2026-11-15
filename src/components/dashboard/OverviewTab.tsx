'use client';

import React, { useMemo } from 'react';
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
import { MovementTrendChart, StockDistributionChart } from '@/components/charts';
import { useI18n } from '@/lib/i18n';
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
  const { t, formatNumber, formatWeekday } = useI18n();

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
      const daily = (dashboardStats?.history || []).filter((tItem) =>
        sameDay(tItem.day)
      );
      const ins = daily
        .filter((tItem) => tItem.type === 'IN')
        .reduce((s, tItem) => s + Number(tItem.quantity), 0);
      const outs = daily
        .filter((tItem) => tItem.type === 'OUT')
        .reduce((s, tItem) => s + Number(tItem.quantity), 0);

      return {
        period: day.toISOString(),
        label: formatWeekday(day),
        inbound: ins,
        outbound: outs,
      };
    });
  }, [dashboardStats?.history, formatWeekday]);

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
              <span>{t.overview.totalProducts}</span>
              <b>{formatNumber(products.length)}</b>
              <small className="change positive">{t.overview.totalProductsSub}</small>
              <span className="metric-icon">
                <PackageIcon size={20} />
              </span>
            </div>
            <div className="metric">
              <span>{t.overview.totalStockUnits}</span>
              <b>{formatNumber(totalUnits)}</b>
              <small className="change positive">{t.overview.totalStockUnitsSub}</small>
              <span className="metric-icon">
                <ArchiveIcon size={20} />
              </span>
            </div>
            <div className="metric">
              <span>{t.overview.lowStockAlert}</span>
              <b>{formatNumber(lowCount)}</b>
              <small className="change negative">{t.overview.lowStockAlertSub}</small>
              <span className="metric-icon">
                <AlertTriangleIcon size={20} />
              </span>
            </div>
            <div className="metric">
              <span>{t.overview.outOfStock}</span>
              <b>{formatNumber(outCount)}</b>
              <small className="change negative">{t.overview.outOfStockSub}</small>
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
              <h2>{t.overview.movementTrends}</h2>
              <p>{t.overview.movementTrendsSub}</p>
            </div>
            <span className="pill">{t.overview.days7}</span>
          </div>

          <div className="legend">
            <span>
              <i className="dot purple" />
              {t.common.inbound}
            </span>
            <span>
              <i className="dot coral" />
              {t.common.outbound}
            </span>
          </div>

          {loading ? (
            <div className="chart-placeholder" style={{ height: '220px' }}>
              {t.overview.loadingCatalog}
            </div>
          ) : (
            <MovementTrendChart
              data={movementTrendPoints}
              height={220}
              emptyText={t.overview.noProducts || 'No transaction history in the past 7 days'}
            />
          )}
        </section>

        <section className="panel alerts-panel">
          <div className="panel-head">
            <div>
              <h2>{t.overview.stockDistribution}</h2>
              <p>{t.overview.stockDistributionSub}</p>
            </div>
          </div>

          {loading ? (
            <div className="chart-placeholder" style={{ height: '230px' }}>
              {t.overview.loadingCatalog}
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
            <h2>{t.overview.catalogTitle}</h2>
            <p>{t.overview.catalogSub}</p>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() => onNavigateTab(role === 'viewer' ? 'reports' : 'products')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>{role === 'viewer' ? t.overview.viewReports : t.overview.viewAll}</span>
            <ExternalLinkIcon size={14} />
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.common.productName}</th>
                <th>{t.common.sku}</th>
                <th>{t.common.category}</th>
                <th>{t.common.stock}</th>
                <th>{t.common.threshold}</th>
                <th>{t.common.status}</th>
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
                    {formatNumber(p.stock)} {p.unit.toLowerCase()}
                  </td>
                  <td>{formatNumber(p.minimum)}</td>
                  <td>
                    <StockBadge stock={p.stock} minimum={p.minimum} />
                  </td>
                </tr>
              ))}
              {recentProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    {loading ? t.overview.loadingCatalog : t.overview.noProducts}
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
