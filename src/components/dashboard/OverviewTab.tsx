'use client';

import React from 'react';
import type { Role } from '@/components/layout/Sidebar';
import { MetricCard, StockBadge, Skeleton } from '@/components/ui';
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

  const donutInStockPercent = products.length ? (inStockCount / products.length) * 100 : 0;
  const donutLowPercent = products.length ? ((inStockCount + lowCount) / products.length) * 100 : 0;

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
              title={t.overview.totalProducts}
              value={formatNumber(products.length)}
              changeText={t.overview.totalProductsSub}
              changeType="positive"
              icon="◈"
            />
            <MetricCard
              title={t.overview.totalStockUnits}
              value={formatNumber(totalUnits)}
              changeText={t.overview.totalStockUnitsSub}
              changeType="positive"
              icon="▤"
            />
            <MetricCard
              title={t.overview.lowStockAlert}
              value={formatNumber(lowCount)}
              changeText={t.overview.lowStockAlertSub}
              changeType="negative"
              icon="⚑"
            />
            <MetricCard
              title={t.overview.outOfStock}
              value={formatNumber(outCount)}
              changeText={t.overview.outOfStockSub}
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

          <div className="chart">
            {Array.from({ length: 7 }, (_, i) => {
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
              const max = Math.max(
                25,
                ...(dashboardStats?.history || []).map((tItem) => Number(tItem.quantity))
              );

              return (
                <div className="chart-col" key={day.toISOString()}>
                  <div className="bars">
                    <span
                      className="bar bar-in"
                      title={`${t.common.inbound} ${ins}`}
                      style={{ height: `${Math.max(4, (ins / max) * 100)}%` }}
                    />
                    <span
                      className="bar bar-out"
                      title={`${t.common.outbound} ${outs}`}
                      style={{ height: `${Math.max(4, (outs / max) * 100)}%` }}
                    />
                  </div>
                  <small>
                    {formatWeekday(day)}
                  </small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel alerts-panel">
          <div className="panel-head">
            <div>
              <h2>{t.overview.stockDistribution}</h2>
              <p>{t.overview.stockDistributionSub}</p>
            </div>
          </div>

          <div
            className="donut"
            style={{
              background: `conic-gradient(#65bf92 0 ${donutInStockPercent}%, #ff9b93 ${donutInStockPercent}% ${donutLowPercent}%, #a9a9bd ${donutLowPercent}% 100%)`,
            }}
          >
            <div>
              <b>{formatNumber(products.length)}</b>
              <span>{t.common.items}</span>
            </div>
          </div>

          <div className="donut-legend">
            <div>
              <i className="dot green" />
              {t.common.inStock} <strong>{formatNumber(inStockCount)}</strong>
            </div>
            <div>
              <i className="dot coral" />
              {t.common.lowStock} <strong>{formatNumber(lowCount)}</strong>
            </div>
            <div>
              <i className="dot gray" />
              {t.common.outOfStock} <strong>{formatNumber(outCount)}</strong>
            </div>
          </div>
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
          >
            {role === 'viewer' ? t.overview.viewReports : t.overview.viewAll} ↗
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
                      <span className="item-avatar">{getCategoryIcon(p.category)}</span>
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
