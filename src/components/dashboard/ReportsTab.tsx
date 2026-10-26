import React from 'react';
import { MetricCard } from '@/components/ui';
import { type Product, type ApiDashboard, formatMoney } from './types';

export interface ReportsTabProps {
  products: Product[];
  dashboardStats: ApiDashboard | null;
}

export default function ReportsTab({
  products,
  dashboardStats,
}: ReportsTabProps) {
  const totalValue = products.reduce((s, p) => s + p.stock * p.price, 0);
  const lowStockProducts = products.filter((p) => p.stock < p.minimum);

  const daysWithIn =
    dashboardStats?.history.filter((t) => t.type === 'IN').length || 0;
  const daysWithOut =
    dashboardStats?.history.filter((t) => t.type === 'OUT').length || 0;

  const handleExportCsv = () => {
    const csvHeader = 'SKU,Tên sản phẩm,Tồn kho,Định mức,Cần nhập ít nhất\n';
    const csvRows = lowStockProducts
      .map((p) =>
        [
          `"${p.sku}"`,
          `"${p.name.replace(/"/g, '""')}"`,
          p.stock,
          p.minimum,
          p.minimum - p.stock,
        ].join(',')
      )
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvHeader + csvRows], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cloudstock-canh-bao-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="metrics report-metrics">
        <MetricCard
          title="Giá trị hàng tồn (giá vốn)"
          value={formatMoney(totalValue)}
          changeText="Tính theo đơn giá vốn đã khai báo"
          changeType="positive"
        />
        <MetricCard
          title="Ngày có nhập kho"
          value={daysWithIn}
          changeText="Số ngày có giao dịch nhập trong kỳ"
          changeType="positive"
        />
        <MetricCard
          title="Ngày có xuất kho"
          value={daysWithOut}
          changeText="Số ngày có giao dịch xuất trong kỳ"
          changeType="positive"
        />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Sản phẩm cần bổ sung</h2>
            <p>Danh sách sản phẩm có số lượng tồn dưới định mức tối thiểu</p>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={handleExportCsv}
            disabled={lowStockProducts.length === 0}
          >
            ↓ Xuất CSV
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã SKU</th>
                <th>Sản phẩm</th>
                <th>Tồn kho</th>
                <th>Định mức</th>
                <th>Cần nhập ít nhất</th>
              </tr>
            </thead>
            <tbody>
              {lowStockProducts.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.stock}</td>
                  <td>{p.minimum}</td>
                  <td>
                    <strong style={{ color: '#e56a69' }}>
                      {p.minimum - p.stock}
                    </strong>
                  </td>
                </tr>
              ))}
              {lowStockProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    Tất cả các mặt hàng hiện tại đều đáp ứng định mức tối thiểu.
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
