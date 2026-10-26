import React from 'react';
import { StockBadge } from '@/components/ui';
import type { Product } from './types';

export interface StockMovementTabProps {
  products: Product[];
  onCreateTicket: () => void;
}

export default function StockMovementTab({
  products,
  onCreateTicket,
}: StockMovementTabProps) {
  const getCategoryIcon = (category: string) => {
    if (category === 'Điện tử') return '⌁';
    if (category === 'Gia dụng') return '▤';
    return '▣';
  };

  return (
    <>
      <div className="inline-heading">
        <p>Ghi nhận phiếu nhập và xuất, tự động cập nhật số lượng tồn kho và lịch sử giao dịch.</p>
        <button
          type="button"
          className="btn primary"
          onClick={onCreateTicket}
        >
          ＋ Tạo phiếu nhập / xuất
        </button>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Tồn kho hiện tại</h2>
            <p>Đối chiếu số lượng tồn thực tế trước khi xuất hoặc nhập hàng</p>
          </div>
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
              {products.map((p) => (
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
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Chưa có sản phẩm nào trong kho.
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
