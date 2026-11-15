'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest, type ArchivedProduct, type ArchivedResponse } from '@/lib/api/cloudstock';

export interface ArchivedProductsTabProps {
  onRestored?: () => Promise<void> | void;
}

export default function ArchivedProductsTab({ onRestored }: ArchivedProductsTabProps) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ArchivedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let active = true;

    apiRequest<ArchivedResponse>(
      `/products/archived?page=${page}&limit=20&search=${encodeURIComponent(query)}`
    )
      .then((response) => {
        if (!active) return;
        if (response.items.length === 0 && page > 1 && response.total > 0) {
          setPage((p) => p - 1);
        } else {
          setData(response);
        }
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Unable to load archived products.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, query, reloadTrigger]);

  const handleRestore = async (p: ArchivedProduct) => {
    const displayName = p.name_en?.trim() || p.name;
    if (busyId || !window.confirm(`Restore "${displayName}" (${p.sku}) to active inventory?`)) {
      return;
    }
    setBusyId(p.id);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/products/${encodeURIComponent(p.id)}/restore`, { method: 'PATCH' });
      setReloadTrigger((v) => v + 1);
      if (onRestored) {
        await onRestored();
      }
      setMessage(`Product ${p.sku} restored successfully.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to restore product.');
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Archived Products</h2>
          <p>Products removed from active inventory. Restore a product without losing its stock history.</p>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={() => setReloadTrigger((v) => v + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <input
          aria-label="Search archived products"
          placeholder="Search by English name, original name, or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn secondary" type="submit">
          Search
        </button>
        <span className="result-count">{data?.total ?? 0} archived</span>
      </form>

      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      {message && (
        <p role="status" className="hint" style={{ color: 'var(--success, #10b981)' }}>
          {message}
        </p>
      )}
      {loading && <p className="hint">Loading archived products...</p>}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Archived At</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name_en?.trim() || p.name}</strong>
                  {p.name_en && p.name && p.name_en.trim() !== p.name.trim() && (
                    <span className="hint" style={{ display: 'block', fontSize: 12 }}>
                      {p.name}
                    </span>
                  )}
                </td>
                <td className="mono">{p.sku}</td>
                <td>{p.category_name_en?.trim() || p.category_name}</td>
                <td>
                  {Number(p.stock_quantity).toLocaleString('en-US')}{' '}
                  {(p.unit_symbol_en?.trim() || p.unit_symbol).toLowerCase()}
                </td>
                <td>{new Date(p.deleted_at).toLocaleString('en-US')}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="small-btn"
                    disabled={busyId !== null}
                    onClick={() => void handleRestore(p)}
                  >
                    {busyId === p.id ? 'Restoring...' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="empty" style={{ textAlign: 'center', padding: '32px 0' }}>
                  No archived products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="filters" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button
          type="button"
          className="small-btn"
          disabled={loading || page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span className="result-count">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="small-btn"
          disabled={loading || page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
