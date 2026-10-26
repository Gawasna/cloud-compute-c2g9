import React from 'react';
import type { Role } from '@/components/layout/Sidebar';
import { MetricCard, StockBadge, Skeleton } from '@/components/ui';
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

  const getCategoryIcon = (category: string) => {
    if (category === 'Điện tử') return '⌁';
    if (category === 'Gia dụng') return '▤';
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
              title="Tổng sản phẩm"
              value={products.length.toLocaleString('vi-VN')}
              changeText="Danh mục đang quản lý"
              changeType="positive"
              icon="◈"
            />
            <MetricCard
              title="Tổng đơn vị tồn"
              value={totalUnits.toLocaleString('vi-VN')}
              changeText="Đang có trong kho"
              changeType="positive"
              icon="▤"
            />
            <MetricCard
              title="Sắp hết hàng"
              value={lowCount}
              changeText="Cần nhập thêm"
              changeType="negative"
              icon="⚑"
            />
            <MetricCard
              title="Đã hết hàng"
              value={outCount}
              changeText="Cần xử lý"
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
              <h2>Biến động nhập xuất</h2>
              <p>Số lượng nhập và xuất kho trong 7 ngày gần nhất</p>
            </div>
            <span className="pill">7 ngày</span>
          </div>

          <div className="legend">
            <span>
              <i className="dot purple" />
              Nhập kho
            </span>
            <span>
              <i className="dot coral" />
              Xuất kho
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
                      title={`Nhập ${ins}`}
                      style={{ height: `${Math.max(4, (ins / max) * 100)}%` }}
                    />
                    <span
                      className="bar bar-out"
                      title={`Xuất ${outs}`}
                      style={{ height: `${Math.max(4, (outs / max) * 100)}%` }}
                    />
                  </div>
                  <small>
                    {day.toLocaleDateString('vi-VN', { weekday: 'short' })}
                  </small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel alerts-panel">
          <div className="panel-head">
            <div>
              <h2>Cảnh báo tồn kho</h2>
              <p>Phân loại tình trạng sản phẩm</p>
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
              <span>sản phẩm</span>
            </div>
          </div>

          <div className="donut-legend">
            <div>
              <i className="dot green" />
              Còn hàng <strong>{inStockCount}</strong>
            </div>
            <div>
              <i className="dot coral" />
              Sắp hết <strong>{lowCount}</strong>
            </div>
            <div>
              <i className="dot gray" />
              Hết hàng <strong>{outCount}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Danh sách sản phẩm</h2>
            <p>Tình trạng hàng hóa mới nhất trong kho</p>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() => onNavigateTab(role === 'viewer' ? 'reports' : 'products')}
          >
            {role === 'viewer' ? 'Xem báo cáo' : 'Xem tất cả'} ↗
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tên sản phẩm</th>
                <th>Mã SKU</th>
                <th>Danh mục</th>
                <th>Tồn kho</th>
                <th>Ngưỡng</th>
                <th>Trạng thái</th>
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
                    {p.stock.toLocaleString('vi-VN')} {p.unit.toLowerCase()}
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
                    {loading ? 'Đang tải danh sách sản phẩm...' : 'Chưa có sản phẩm nào trong kho.'}
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
