'use client';

import React from 'react';
import { StockBadge } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { Product } from './types';

export interface StockMovementTabProps {
  products: Product[];
  onCreateTicket: () => void;
}

export default function StockMovementTab({
  products,
  onCreateTicket,
}: StockMovementTabProps) {
  const { t, formatNumber } = useI18n();

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
        <p>{t.stockTab.intro}</p>
        <button
          type="button"
          className="btn primary"
          onClick={onCreateTicket}
        >
          {t.stockTab.createBtn}
        </button>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{t.stockTab.panelTitle}</h2>
            <p>{t.stockTab.panelDesc}</p>
          </div>
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
                    {formatNumber(p.stock)} {p.unit.toLowerCase()}
                  </td>
                  <td>{formatNumber(p.minimum)}</td>
                  <td>
                    <StockBadge stock={p.stock} minimum={p.minimum} />
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    {t.overview.noProducts}
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
