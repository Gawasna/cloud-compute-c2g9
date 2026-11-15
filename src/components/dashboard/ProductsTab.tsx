import React, { useState, useMemo } from 'react';
import type { Role } from '@/components/layout/Sidebar';
import { StockBadge, EmptyState } from '@/components/ui';
import { getStockStatus } from '@/components/ui/StockBadge';
import {
  PlusIcon,
  SearchIcon,
  renderCategoryIcon,
} from '@/components/ui/Icons';
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
  const [filter, setFilter] = useState('All');

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
      const statusLabel = getStockStatus(p.stock, p.minimum).label;
      const matchFilter = filter === 'All' || statusLabel === filter;
      return matchSearch && matchFilter;
    });
  }, [products, search, filter]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Products</h2>
          <p>Manage SKUs, categories, cost prices, and minimum stock levels</p>
        </div>
        {role === 'admin' && (
          <button
            type="button"
            className="btn primary"
            onClick={onAddProduct}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <PlusIcon size={16} />
            <span>Add Product</span>
          </button>
        )}
      </div>

      <div className="filters">
        <div className="search-input-wrapper">
          <SearchIcon size={16} className="search-icon-adornment" />
          <input
            placeholder="Search by name, SKU, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {['All', 'In Stock', 'Low Stock', 'Out of Stock'].map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span className="result-count">{visibleProducts.length} products</span>
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
              {role !== 'viewer' && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="item-name">
                    <span className="item-avatar">
                      {renderCategoryIcon(p.category, { size: 16 })}
                    </span>
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
                {role !== 'viewer' && (
                  <td className="actions">
                    {role === 'admin' && (
                      <>
                        <button
                          type="button"
                          className="small-btn"
                          onClick={() => onEditProduct(p)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="small-btn red"
                          onClick={() => onDeleteProduct(p)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {role === 'staff' && (
                      <button
                        type="button"
                        className="small-btn"
                        onClick={() => onCreateStockTicket(p.sku)}
                      >
                        Create Ticket
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
                    message="No products found matching the active filters."
                    actionText={search || filter !== 'All' ? 'Clear Filters' : undefined}
                    onAction={() => {
                      setSearch('');
                      setFilter('All');
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
