'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest, type ReportPeriod, type TrendResponse } from '@/lib/api/cloudstock';
import { withErrorBoundary } from '@/components/ui';
import { MovementTrendChart } from '@/components/charts';

const labels: Record<ReportPeriod, string> = { day: 'Day', week: 'Week', month: 'Month' };

const fmt = (iso: string, period: ReportPeriod) => {
  const [y, m, d] = iso.split('-').map(Number);
  if (period === 'month') return `${String(m).padStart(2, '0')}/${y}`;
  if (period === 'week') return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  return `${d}/${m}`;
};

function MovementChartInner({ title = 'Inventory Movement Trends' }: { title?: string }) {
  const [period, setPeriod] = useState<ReportPeriod>('day');
  const [data, setData] = useState<TrendResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await apiRequest<TrendResponse>(`/reports/trend?period=${period}`);
        if (active) {
          setData(response);
          setError('');
        }
      } catch (e) {
        if (active) {
          setData(null);
          setError(e instanceof Error ? e.message : 'Unable to load trend chart data');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [period]);

  const points = useMemo(
    () =>
      data?.points.map((p) => ({
        period: p.period,
        label: fmt(p.period, period),
        inbound: Number(p.inbound),
        outbound: Number(p.outbound),
      })) || [],
    [data, period]
  );

  return (
    <section className="panel chart-panel phase6-chart">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>
            {period === 'day' ? 'Last 14 days' : period === 'week' ? 'Last 12 weeks' : 'Last 12 months'} · Timezone: UTC · Units: inventory items
          </p>
        </div>
        <div className="period-tabs" role="group" aria-label="Select report period">
          {(['day', 'week', 'month'] as ReportPeriod[]).map((p) => (
            <button
              type="button"
              key={p}
              aria-pressed={period === p}
              className={'period-tab ' + (period === p ? 'active' : '')}
              onClick={() => {
                setLoading(true);
                setPeriod(p);
              }}
            >
              {labels[p]}
            </button>
          ))}
        </div>
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
      {error ? (
        <div className="form-error" role="alert">
          {error}{' '}
          <button
            type="button"
            className="small-btn"
            onClick={() => {
              setData(null);
              setLoading(true);
              setPeriod(period === 'day' ? 'week' : 'day');
            }}
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="chart-placeholder" style={{ height: '240px' }}>
          Loading trend analytics...
        </div>
      ) : (
        <>
          <MovementTrendChart
            data={points}
            height={240}
            emptyText="No movement transactions recorded for this period."
          />
          <p className="phase6-chart-note">
            Period Total: Inbound{' '}
            <b>{points.reduce((n, p) => n + p.inbound, 0).toLocaleString('en-US')}</b> · Outbound{' '}
            <b>{points.reduce((n, p) => n + p.outbound, 0).toLocaleString('en-US')}</b>. Physical inventory volume, not Cash Flow.
          </p>
        </>
      )}
    </section>
  );
}

export default withErrorBoundary(MovementChartInner, { name: 'MovementChart' });
