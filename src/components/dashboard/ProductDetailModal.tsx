'use client';

import React, { useState, useEffect } from 'react';
import { Modal, StockBadge, ProductImage } from '@/components/ui';
import {
  ArrowLeftRightIcon,
  EditIcon,
  renderCategoryIcon,
  EyeIcon,
  ExternalLinkIcon,
  CloseIcon,
  ImageIcon,
} from '@/components/ui/Icons';
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

function getImageMeta(url: string | null | undefined) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  let format = 'IMAGE';
  if (lower.includes('.webp') || lower.startsWith('data:image/webp')) {
    format = 'WEBP';
  } else if (lower.includes('.png') || lower.startsWith('data:image/png')) {
    format = 'PNG';
  } else if (lower.includes('.jpg') || lower.includes('.jpeg') || lower.startsWith('data:image/jpeg')) {
    format = 'JPEG';
  } else if (lower.includes('.svg') || lower.startsWith('data:image/svg')) {
    format = 'SVG';
  } else if (lower.includes('.avif') || lower.startsWith('data:image/avif')) {
    format = 'AVIF';
  } else if (lower.includes('.gif') || lower.startsWith('data:image/gif')) {
    format = 'GIF';
  }

  const isCdn = lower.startsWith('http://') || lower.startsWith('https://');

  return {
    url: trimmed,
    format,
    isCdn,
  };
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
  const [showLightbox, setShowLightbox] = useState(false);

  // Close lightbox on Escape key press
  useEffect(() => {
    if (!showLightbox) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLightbox(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLightbox]);

  if (!product) return null;

  const handleClose = () => {
    setShowLightbox(false);
    onClose();
  };

  const totalValue = Number(product.stock) * Number(product.price);
  const imageMeta = getImageMeta(product.imageUrl);
  const isLightboxVisible = isOpen && showLightbox && !!imageMeta;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
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
              onClick={handleClose}
            >
              {t.common.cancel}
            </button>

            {role !== 'viewer' && onCreateStockTicket && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  onCreateStockTicket(product.sku);
                  handleClose();
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
                  handleClose();
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
            <div
              style={{
                position: 'relative',
                cursor: imageMeta ? 'pointer' : 'default',
                borderRadius: '14px',
                overflow: 'hidden',
                flexShrink: 0,
              }}
              onClick={() => {
                if (imageMeta) setShowLightbox(true);
              }}
              title={
                imageMeta
                  ? locale === 'vi'
                    ? 'Bấm để xem ảnh kích thước lớn'
                    : 'Click to view full image'
                  : undefined
              }
            >
              <ProductImage
                src={product.imageUrl}
                alt={product.name}
                category={product.category}
                size="xl"
              />
              {imageMeta && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.3)',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                >
                  <EyeIcon size={22} />
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text, #15203b)' }}>
                  {product.sku}
                </span>
                <StockBadge stock={product.stock} minimum={product.minimum} />
                {imageMeta && (
                  <>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: '#ede9fe',
                        color: '#6d28d9',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {imageMeta.format}
                    </span>
                    {imageMeta.isCdn && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          background: '#dcfce7',
                          color: '#15803d',
                          letterSpacing: '0.5px',
                        }}
                      >
                        CDN
                      </span>
                    )}
                  </>
                )}
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

          {/* Image URL & Action Box (if image exists) */}
          {imageMeta && (
            <div
              style={{
                padding: '10px 14px',
                background: '#ffffff',
                borderRadius: '10px',
                border: '1px solid var(--line, #e8eaf2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <span style={{ color: '#8673ed', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <ImageIcon size={16} />
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--muted, #7c8498)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  URL:
                </span>
                <a
                  href={imageMeta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '12px',
                    color: '#6859c1',
                    textDecoration: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={imageMeta.url}
                >
                  {imageMeta.url}
                </a>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowLightbox(true)}
                  style={{
                    border: '1px solid var(--line, #e8eaf2)',
                    background: '#f8f9fd',
                    color: '#4f46e5',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <EyeIcon size={12} />
                  <span>{locale === 'vi' ? 'Xem ảnh' : 'View'}</span>
                </button>
                <a
                  href={imageMeta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    border: '1px solid var(--line, #e8eaf2)',
                    background: '#f8f9fd',
                    color: '#64748b',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none',
                  }}
                  title={locale === 'vi' ? 'Mở trong tab mới' : 'Open in new tab'}
                >
                  <ExternalLinkIcon size={12} />
                </a>
              </div>
            </div>
          )}

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

      {/* Lightbox / Fullscreen Image Preview */}
      {isLightboxVisible && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={product.name}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setShowLightbox(false)}
        >
          {/* Top Actions */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              zIndex: 1001,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={imageMeta.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#ffffff',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ExternalLinkIcon size={14} />
              <span>{locale === 'vi' ? 'Mở tab mới' : 'Open in tab'}</span>
            </a>
            <button
              type="button"
              onClick={() => setShowLightbox(false)}
              aria-label={locale === 'vi' ? 'Đóng' : 'Close'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {/* Lightbox Image & Caption */}
          <div
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageMeta.url}
              alt={product.name}
              style={{
                maxWidth: '90vw',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: '#ffffff',
              }}
            />
            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#ffffff',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <span className="mono" style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 700 }}>
                {product.sku}
              </span>
              <span style={{ fontSize: '15px', fontWeight: 600 }}>{product.name}</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                }}
              >
                {imageMeta.format}
              </span>
              {imageMeta.isCdn && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.3)',
                    color: '#6ee7b7',
                  }}
                >
                  CDN
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
