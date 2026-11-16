'use client';

import React from 'react';
import { Modal, StockBadge, ProductImage } from '@/components/ui';
import { ArrowLeftRightIcon, EditIcon, renderCategoryIcon } from '@/components/ui/Icons';
import { useI18n } from '@/lib/i18n';
import type { Role } from '@/components/layout/Sidebar';
import type { Product } from './types';

export interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  role: Role;
  onEdit?: (product: Product) => void;
  onCreateStockTicket?: (sku: string) => void;
}

export default function ProductDetailModal({
  isOpen,
  onClose,
  product,
  role,
  onEdit,
  onCreateStockTicket,
}: ProductDetailModalProps) {
  const { t, locale, formatCurrency, formatNumber } = useI18n();

  if (!product) return null;

  const totalValue = Number(product.stock) * Number(product.price);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product.name}
      description={
        product.nameOriginal && product.nameOriginal !== product.name
          ? product.nameOriginal
          : undefined
      }
      actions={
        <>
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
          >
            {t.common.cancel}
          </button>

          {role !== 'viewer' && onCreateStockTicket && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                onCreateStockTicket(product.sku);
                onClose();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeftRightIcon size={14} />
              <span>{t.productsTab.createTicket}</span>
            </button>
          )}

          {role === 'admin' && onEdit && (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                onEdit(product);
                onClose();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <EditIcon size={14} />
              <span>{t.common.edit}</span>
            </button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Top Summary Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            background: 'linear-gradient(135deg, #fafbff 0%, #f4f5fc 100%)',
            borderRadius: '14px',
            border: '1px solid var(--line, #e8eaf2)',
          }}
        >
          <ProductImage
            alt={product.name}
            category={product.category}
            size="xl"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text, #15203b)' }}>
                {product.sku}
              </span>
              <StockBadge stock={product.stock} minimum={product.minimum} />
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#1d2233' }}>
              {product.name}
            </h3>
            {product.nameOriginal && product.nameOriginal !== product.name && (
              <span style={{ fontSize: '12px', color: 'var(--muted, #7c8498)', display: 'block' }}>
                {product.nameOriginal}
              </span>
            )}
          </div>
        </div>

        {/* 2-column Detail Specs Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '12px',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid var(--line, #e8eaf2)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--muted, #7c8498)', display: 'block', marginBottom: '4px' }}>
              {t.common.category}
            </span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
              {renderCategoryIcon(product.category, { size: 16 })}
              <span>{product.category}</span>
            </div>
          </div>

          <div
            style={{
              padding: '12px 14px',
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid var(--line, #e8eaf2)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--muted, #7c8498)', display: 'block', marginBottom: '4px' }}>
              {t.common.unit}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #15203b)' }}>
              {product.unit}
            </span>
          </div>

          <div
            style={{
              padding: '12px 14px',
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid var(--line, #e8eaf2)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--muted, #7c8498)', display: 'block', marginBottom: '4px' }}>
              {locale === 'vi' ? 'Giá vốn đơn vị' : 'Unit Cost Price'}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text, #15203b)' }}>
              {formatCurrency(product.price)}
            </span>
          </div>

          <div
            style={{
              padding: '12px 14px',
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid var(--line, #e8eaf2)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--muted, #7c8498)', display: 'block', marginBottom: '4px' }}>
              {t.common.stock} / {t.common.threshold}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #15203b)' }}>
              <b>{formatNumber(product.stock)}</b> / {formatNumber(product.minimum)} {product.unit.toLowerCase()}
            </span>
          </div>

          <div
            style={{
              gridColumn: '1 / -1',
              padding: '14px',
              background: '#f8f9fd',
              borderRadius: '10px',
              border: '1px solid var(--line, #e8eaf2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--muted, #7c8498)', fontWeight: 500 }}>
              {locale === 'vi' ? 'Tổng giá trị hàng tồn' : 'Total Inventory Valuation'}
            </span>
            <strong style={{ fontSize: '16px', fontWeight: 800, color: '#6859c1' }}>
              {formatCurrency(totalValue)}
            </strong>
          </div>
        </div>
      </div>
    </Modal>
  );
}
