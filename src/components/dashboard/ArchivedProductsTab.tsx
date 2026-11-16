'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest, type ArchivedProduct, type ArchivedResponse } from '@/lib/api/cloudstock';
import { ProductImage } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export interface ArchivedProductsTabProps {
  onRestored?: () => Promise<void> | void;
}

export default function ArchivedProductsTab({ onRestored }: ArchivedProductsTabProps) {
  const { t, locale, formatNumber, formatDate, interpolate } = useI18n();
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
    const displayName =
      locale === 'vi'
        ? p.name
        : p.name_en?.trim() || p.name;

    const confirmText = interpolate(t.archivedTab.restoreConfirm, {
      name: displayName,
      sku: p.sku,
    });

    if (busyId || !window.confirm(confirmText)) {
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
      setMessage(interpolate(t.archivedTab.restoreSuccess, { sku: p.sku }));
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
          <h2>{t.archivedTab.title}</h2>
          <p>{t.archivedTab.desc}</p>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={() => setReloadTrigger((v) => v + 1)}
          disabled={loading}
        >
          {t.common.refresh}
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
          aria-label={t.archivedTab.searchPlaceholder}
          placeholder={t.archivedTab.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn secondary" type="submit">
          {t.common.search}
        </button>
        <span className="result-count">
          {interpolate(t.archivedTab.archivedCount, {
            count: formatNumber(data?.total ?? 0),
          })}
        </span>
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
      {loading && <p className="hint">{t.archivedTab.loading}</p>}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t.common.productName}</th>
              <th>{t.common.sku}</th>
              <th>{t.common.category}</th>
              <th>{t.common.stock}</th>
              <th>{t.archivedTab.archivedAt}</th>
              <th style={{ textAlign: 'right' }}>{t.common.action}</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => {
              const primaryName = locale === 'vi' ? p.name : p.name_en?.trim() || p.name;
              const secondaryName = locale === 'vi' ? p.name_en?.trim() : p.name;
              const catName =
                locale === 'vi' ? p.category_name : p.category_name_en?.trim() || p.category_name;
              const unitSymbol =
                locale === 'vi' ? p.unit_symbol : p.unit_symbol_en?.trim() || p.unit_symbol;

              return (
                <tr key={p.id}>
                  <td>
                    <div className="item-name">
                      <ProductImage alt={primaryName} category={catName} size="md" />
                      <div>
                        <strong>{primaryName}</strong>
                        {secondaryName && secondaryName.trim() !== primaryName.trim() && (
                          <span className="product-subtitle">
                            {secondaryName}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="mono">{p.sku}</td>
                  <td>{catName}</td>
                  <td>
                    {formatNumber(Number(p.stock_quantity))} {unitSymbol.toLowerCase()}
                  </td>
                  <td>{formatDate(p.deleted_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="small-btn"
                      disabled={busyId !== null}
                      onClick={() => void handleRestore(p)}
                    >
                      {busyId === p.id ? t.common.restoring : t.common.restore}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="empty" style={{ textAlign: 'center', padding: '32px 0' }}>
                  {t.archivedTab.empty}
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
          {t.common.previous}
        </button>
        <span className="result-count">
          {interpolate(t.common.pageOf, {
            page: formatNumber(page),
            total: formatNumber(totalPages),
          })}
        </span>
        <button
          type="button"
          className="small-btn"
          disabled={loading || page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          {t.common.next}
        </button>
      </div>
    </section>
  );
}
