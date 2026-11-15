'use client';

import React, { useState, useMemo } from 'react';
import type { Role } from '@/components/layout/Sidebar';
import { StockBadge, EmptyState } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
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
  const { t, formatNumber, interpolate } = useI18n();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = (
        (p.name || '') + ' ' +
        (p.nameOriginal || '') + ' ' +
        (p.sku || '') + ' ' +
        (p.category || '')
      )
        .toLowerCase()
        .includes(search.toLowerCase());

      const isOut = p.stock === 0;
      const isLow = p.stock > 0 && p.stock < p.minimum;
      const isIn = p.stock >= p.minimum;

      const matchFilter =
        filter === 'all' ||
        (filter === 'in_stock' && isIn) ||
        (filter === 'low_stock' && isLow) ||
        (filter === 'out_of_stock' && isOut);

      return matchSearch && matchFilter;
    });
  }, [products, search, filter]);

  const getCategoryIcon = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('electronics') || c.includes('điện tử')) return '⌁';
    if (c.includes('home') || c.includes('gia dụng')) return '▤';
    if (c.includes('fashion') || c.includes('thời trang')) return '◈';
    return '▣';
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{t.productsTab.title}</h2>
          <p>{t.productsTab.desc}</p>
        </div>
        {role === 'admin' && (
          <button
            type="button"
            className="btn primary"
            onClick={onAddProduct}
          >
            {t.productsTab.addBtn}
          </button>
        )}
      </div>

      <div className="filters">
        <input
          placeholder={t.productsTab.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={filter}
          onChange={(e) =>
            setFilter(e.target.value as 'all' | 'in_stock' | 'low_stock' | 'out_of_stock')
          }
        >
          <option value="all">{t.common.all}</option>
          <option value="in_stock">{t.common.inStock}</option>
          <option value="low_stock">{t.common.lowStock}</option>
          <option value="out_of_stock">{t.common.outOfStock}</option>
        </select>
        <span className="result-count">
          {interpolate(t.productsTab.productCount, { count: formatNumber(visibleProducts.length) })}
        </span>
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
              {role !== 'viewer' && <th>{t.common.action}</th>}
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((p) => (
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
                {role !== 'viewer' && (
                  <td className="actions">
                    {role === 'admin' && (
                      <>
                        <button
                          type="button"
                          className="small-btn"
                          onClick={() => onEditProduct(p)}
                        >
                          {t.common.edit}
                        </button>
                        <button
                          type="button"
                          className="small-btn red"
                          onClick={() => onDeleteProduct(p)}
                        >
                          {t.common.delete}
                        </button>
                      </>
                    )}
                    {role === 'staff' && (
                      <button
                        type="button"
                        className="small-btn"
                        onClick={() => onCreateStockTicket(p.sku)}
                      >
                        {t.productsTab.createTicket}
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
                    message={t.productsTab.empty}
                    actionText={search || filter !== 'all' ? t.productsTab.clearFilters : undefined}
                    onAction={() => {
                      setSearch('');
                      setFilter('all');
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
