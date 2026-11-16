'use client';

import React, { useMemo, useState } from 'react';
import type { Role } from '@/components/layout/Sidebar';
import {
  StockBadge,
  Skeleton,
  TableSkeleton,
  ChartSkeleton,
  ProductImage,
} from '@/components/ui';
import {
  PackageIcon,
  ArchiveIcon,
  AlertTriangleIcon,
  BanIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
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
  const { t, locale, formatNumber, formatWeekday } = useI18n();
  const [periodDays, setPeriodDays] = useState<7 | 14 | 30>(7);
  const [movementType, setMovementType] = useState<'all' | 'in' | 'out'>('all');

  const lowCount = products.filter((p) => p.stock > 0 && p.stock < p.minimum).length;
  const outCount = products.filter((p) => p.stock === 0).length;
  const inStockCount = Math.max(0, products.length - lowCount - outCount);
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);

  const recentProducts = products.slice(0, 6);

  const movementTrendPoints = useMemo(() => {
    return Array.from({ length: periodDays }, (_, i) => {
      const day = new Date();
      day.setDate(day.getDate() - (periodDays - 1) + i);
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

      const label =
        periodDays === 7
          ? formatWeekday(day)
          : `${day.getDate()}/${day.getMonth() + 1}`;

      return {
        period: day.toISOString(),
        label,
        inbound: movementType === 'out' ? 0 : ins,
        outbound: movementType === 'in' ? 0 : outs,
      };
    });
  }, [dashboardStats?.history, formatWeekday, periodDays, movementType]);

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
            <div className="trend-filter-select-wrapper">
              <select
                value={periodDays}
                onChange={(e) => setPeriodDays(Number(e.target.value) as 7 | 14 | 30)}
                className="trend-filter-select"
                aria-label={locale === 'vi' ? 'Chọn khoảng thời gian xu hướng' : 'Select trend period'}
              >
                <option value={7}>{locale === 'vi' ? '7 ngày' : '7 Days'}</option>
                <option value={14}>{locale === 'vi' ? '14 ngày' : '14 Days'}</option>
                <option value={30}>{locale === 'vi' ? '30 ngày' : '30 Days'}</option>
              </select>
              <span className="trend-filter-chevron">
                <ChevronDownIcon size={13} />
              </span>
            </div>
          </div>

          <div className="legend">
            <span
              role="button"
              tabIndex={0}
              onClick={() => setMovementType((curr) => (curr === 'in' ? 'all' : 'in'))}
              style={{
                cursor: 'pointer',
                opacity: movementType === 'out' ? 0.35 : 1,
                fontWeight: movementType === 'in' ? 700 : 500,
                transition: 'all 0.15s ease',
                userSelect: 'none',
              }}
              title={locale === 'vi' ? 'Nhấn để lọc Nhập kho' : 'Click to filter Inbound'}
            >
              <i className="dot purple" />
              {t.common.inbound}
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={() => setMovementType((curr) => (curr === 'out' ? 'all' : 'out'))}
              style={{
                cursor: 'pointer',
                opacity: movementType === 'in' ? 0.35 : 1,
                fontWeight: movementType === 'out' ? 700 : 500,
                transition: 'all 0.15s ease',
                userSelect: 'none',
              }}
              title={locale === 'vi' ? 'Nhấn để lọc Xuất kho' : 'Click to filter Outbound'}
            >
              <i className="dot coral" />
              {t.common.outbound}
            </span>
          </div>

          {loading ? (
            <ChartSkeleton height={220} type="bar" />
          ) : (
            <MovementTrendChart
              data={movementTrendPoints}
              height={220}
              emptyText={t.overview.noProducts || 'No transaction history in this period'}
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
            <ChartSkeleton height={230} type="donut" />
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

        {loading ? (
          <TableSkeleton rows={4} cols={6} />
        ) : (
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
                        <ProductImage alt={p.name} category={p.category} size="sm" />
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
                      {t.overview.noProducts}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
