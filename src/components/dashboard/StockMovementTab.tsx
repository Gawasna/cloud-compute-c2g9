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
    const c = category.toLowerCase();
    if (c.includes('electronics') || c.includes('điện tử')) return '⌁';
    if (c.includes('home') || c.includes('gia dụng')) return '▤';
    if (c.includes('fashion') || c.includes('thời trang')) return '◈';
    return '▣';
  };

  return (
    <>
      <div className="inline-heading">
        <p>Record stock movements, automatically updating on-hand quantities and transaction logs.</p>
        <button
          type="button"
          className="btn primary"
          onClick={onCreateTicket}
        >
          ＋ Create Stock Movement
        </button>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Current Stock Levels</h2>
            <p>Verify physical inventory before processing inbound or outbound movements</p>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Threshold</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="item-name">
                      <span className="item-avatar">{getCategoryIcon(p.category)}</span>
                      <div>
                        <strong>{p.name}</strong>
                        {p.nameOriginal && p.nameOriginal !== p.name && (
                          <span className="hint" style={{ display: 'block', fontSize: 12 }}>
                            {p.nameOriginal}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="mono">{p.sku}</td>
                  <td>{p.category}</td>
                  <td>
                    {p.stock.toLocaleString('en-US')} {p.unit.toLowerCase()}
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
                    No products found in warehouse.
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
