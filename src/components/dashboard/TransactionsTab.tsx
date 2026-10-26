import React from 'react';
import { EmptyState } from '@/components/ui';
import { type MovementTx, formatDate } from './types';

export interface TransactionsTabProps {
  transactions: MovementTx[];
  onCreateTicket?: () => void;
}

export default function TransactionsTab({
  transactions,
  onCreateTicket,
}: TransactionsTabProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Lịch sử nhập xuất</h2>
          <p>Nhật ký giao dịch có dấu thời gian và người thực hiện</p>
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Mã phiếu</th>
              <th>Loại</th>
              <th>Sản phẩm</th>
              <th>Số lượng</th>
              <th>Người thực hiện</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{formatDate(t.date)}</td>
                <td className="mono">{t.id.slice(0, 8)}</td>
                <td>
                  <span className={`tag ${t.type === 'IN' ? 'success' : 'warning'}`}>
                    {t.type === 'IN' ? 'Nhập' : 'Xuất'}
                  </span>
                </td>
                <td className="mono">{t.sku}</td>
                <td>{t.quantity.toLocaleString('vi-VN')}</td>
                <td>{t.actor}</td>
                <td>{t.note || '—'}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    message="Chưa có giao dịch nhập xuất nào được ghi nhận."
                    actionText={onCreateTicket ? 'Tạo phiếu giao dịch đầu tiên' : undefined}
                    onAction={onCreateTicket}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
