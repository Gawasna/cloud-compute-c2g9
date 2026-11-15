'use client';

import React, { useEffect, useState } from 'react';
import MovementChart from '@/components/MovementChart';
import { apiRequest, downloadReportCsv, type LowStockItem, type ApiDashboard } from '@/lib/api/cloudstock';
import { useI18n } from '@/lib/i18n';
import type { Product } from './types';

export interface ReportsTabProps {
  products?: Product[];
  dashboardStats?: ApiDashboard | null;
}

// Prepend UTF-8 BOM ('\uFEFF') for Vietnamese Excel compatibility in reports
export const CSV_UTF8_BOM = '\uFEFF';

type Summary = ApiDashboard['summary'];

export default function ReportsTab(_props?: ReportsTabProps) {
  void _props;
  const { t, formatCurrency, formatNumber } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<LowStockItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<Summary>('/reports/overview'),
      apiRequest<LowStockItem[]>('/reports/low-stock'),
    ])
      .then(([s, a]) => {
        if (active) {
          setSummary(s);
          setAlerts(a);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load report data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const download = async (kind: 'inventory' | 'low-stock' | 'movements') => {
    setDownloading(kind);
    setError('');
    try {
      await downloadReportCsv(kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to export CSV');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <div className="panel-head report-header">
        <div>
          <h2>{t.reportsTab.title}</h2>
          <p>{t.reportsTab.desc}</p>
        </div>
        <div className="report-actions">
          <button
            type="button"
            className="btn secondary"
            disabled={Boolean(downloading)}
            onClick={() => void download('inventory')}
          >
            {t.reportsTab.inventoryCsv}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={Boolean(downloading)}
            onClick={() => void download('movements')}
          >
            {t.reportsTab.movementsCsv}
          </button>
        </div>
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="metrics report-metrics">
        <div className="metric">
          <span>{t.reportsTab.valuation}</span>
          <b className="value-text">
            {loading ? '...' : formatCurrency(Number(summary?.inventory_value || 0))}
          </b>
          <small>{t.reportsTab.valuationSub}</small>
        </div>
        <div className="metric">
          <span>{t.overview.lowStockAlert}</span>
          <b>{loading ? '...' : formatNumber(summary?.low_stock ?? 0)}</b>
          <small>{t.overview.lowStockAlertSub}</small>
        </div>
        <div className="metric">
          <span>{t.overview.outOfStock}</span>
          <b>{loading ? '...' : formatNumber(summary?.out_of_stock ?? 0)}</b>
          <small>{t.overview.outOfStockSub}</small>
        </div>
      </div>

      <MovementChart title={t.reportsTab.chartTitle} />

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{t.reportsTab.alertsTitle}</h2>
            <p>{t.reportsTab.alertsSub}</p>
          </div>
          <button
            type="button"
            className="btn secondary"
            disabled={Boolean(downloading)}
            onClick={() => void download('low-stock')}
          >
            {t.reportsTab.lowStockCsv}
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.common.sku}</th>
                <th>{t.common.productName}</th>
                <th>{t.common.stock}</th>
                <th>{t.common.threshold}</th>
                <th>{t.reportsTab.shortage}</th>
                <th>{t.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{formatNumber(p.stock_quantity)}</td>
                  <td>{formatNumber(p.minimum_stock)}</td>
                  <td>{formatNumber(p.shortage)}</td>
                  <td>
                    <span className={'tag ' + (p.status === 'OUT' ? 'danger' : 'warning')}>
                      {p.status === 'OUT' ? t.common.outOfStock : t.common.lowStock}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && !alerts.length && (
                <tr>
                  <td colSpan={6} className="empty">
                    {t.reportsTab.emptyAlerts}
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
