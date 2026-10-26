import React, { useState, useMemo } from 'react';
import type { Role } from '@/components/layout/Sidebar';
import { StockBadge, EmptyState } from '@/components/ui';
import { getStockStatus } from '@/components/ui/StockBadge';
import type { Product } from './types';

export interface ProductsTabProps {
  role: Role;
  products: Product[];
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onCreateStockTicket: (sku: string) => void;
}

export default function ProductsTab({
  role,
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onCreateStockTicket,
}: ProductsTabProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Tất cả');

  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = (p.name + ' ' + p.sku + ' ' + p.category)
        .toLowerCase()
        .includes(search.toLowerCase());
      const statusLabel = getStockStatus(p.stock, p.minimum).label;
      const matchFilter = filter === 'Tất cả' || statusLabel === filter;
      return matchSearch && matchFilter;
    });
  }, [products, search, filter]);

  const getCategoryIcon = (category: string) => {
    if (category === 'Điện tử') return '⌁';
    if (category === 'Gia dụng') return '▤';
    return '▣';
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Danh sách sản phẩm</h2>
          <p>Quản lý SKU, danh mục, giá vốn và định mức tồn kho</p>
        </div>
        {role === 'admin' && (
          <button
            type="button"
            className="btn primary"
            onClick={onAddProduct}
          >
            ＋ Thêm sản phẩm
          </button>
        )}
      </div>

      <div className="filters">
        <input
          placeholder="⌕  Tìm tên, mã SKU, danh mục..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {['Tất cả', 'Còn hàng', 'Sắp hết', 'Hết hàng'].map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span className="result-count">{visibleProducts.length} sản phẩm</span>
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
              {role !== 'viewer' && <th>Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((p) => (
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
                {role !== 'viewer' && (
                  <td className="actions">
                    {role === 'admin' && (
                      <>
                        <button
                          type="button"
                          className="small-btn"
                          onClick={() => onEditProduct(p)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="small-btn red"
                          onClick={() => onDeleteProduct(p)}
                        >
                          Xóa
                        </button>
                      </>
                    )}
                    {role === 'staff' && (
                      <button
                        type="button"
                        className="small-btn"
                        onClick={() => onCreateStockTicket(p.sku)}
                      >
                        Tạo phiếu
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {visibleProducts.length === 0 && (
              <tr>
                <td colSpan={role !== 'viewer' ? 7 : 6}>
                  <EmptyState
                    message="Không tìm thấy sản phẩm phù hợp với bộ lọc."
                    actionText={search || filter !== 'Tất cả' ? 'Xóa bộ lọc' : undefined}
                    onAction={() => {
                      setSearch('');
                      setFilter('Tất cả');
                    }}
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
