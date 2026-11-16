'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, RefreshCw, Trash2 } from 'lucide-react';
import { Modal, ProductImage } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import {
  processProductImage,
  uploadProductImage,
  formatFileSize,
  type ProcessedProductImage,
} from '@/lib/media';
import type { ApiCategory, ApiUnit, Product } from './types';

export interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: {
    name: string;
    nameEn?: string;
    sku: string;
    categoryId: string;
    unitId: string;
    costPrice: number;
    minimumStock: number;
    initialStock: number;
    editId?: string;
    imageUrl?: string | null;
  }) => Promise<void>;
  categories: ApiCategory[];
  units: ApiUnit[];
  editProduct?: Product | null;
}

export default function ProductModal({
  isOpen,
  onClose,
  onSave,
  categories,
  units,
  editProduct,
}: ProductModalProps) {
  const { t, locale } = useI18n();

  const initialName = editProduct ? (editProduct.nameOriginal || editProduct.name) : '';
  const initialNameEn = editProduct ? (editProduct.nameEn || '') : '';
  const isInitiallySame = Boolean(initialName && initialNameEn && initialName === initialNameEn);

  const [name, setName] = useState(initialName);
  const [nameEn, setNameEn] = useState(initialNameEn);
  const [nameAlreadyEnglish, setNameAlreadyEnglish] = useState(isInitiallySame);
  const [sku, setSku] = useState(editProduct ? editProduct.sku : '');
  const [categoryId, setCategoryId] = useState(
    editProduct?.categoryId || categories[0]?.id || ''
  );
  const [unitId, setUnitId] = useState(
    editProduct?.unitId || units[0]?.id || ''
  );
  const [price, setPrice] = useState(
    editProduct ? String(editProduct.price) : '0'
  );
  const [stock, setStock] = useState(
    editProduct ? String(editProduct.stock) : '0'
  );
  const [minimum, setMinimum] = useState(
    editProduct ? String(editProduct.minimum) : '10'
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState('');

  // Client-side image processing states
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(
    editProduct?.imageUrl || null
  );
  const [processedImage, setProcessedImage] = useState<ProcessedProductImage | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs on unmount or when image changes
  useEffect(() => {
    return () => {
      if (processedImage?.previewUrl) {
        URL.revokeObjectURL(processedImage.previewUrl);
      }
    };
  }, [processedImage]);

  const toggleNameAlreadyEnglish = (checked: boolean) => {
    setNameAlreadyEnglish(checked);
    if (checked) {
      setNameEn(name);
    }
  };

  const handleProcessFile = async (file: File) => {
    setImageError(null);
    setIsProcessingImage(true);
    setExistingImageUrl(null);
    try {
      const result = await processProductImage(file, {
        maxDimension: 800,
        quality: 0.82,
      });
      if (processedImage?.previewUrl) {
        URL.revokeObjectURL(processedImage.previewUrl);
      }
      setProcessedImage(result);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Error processing image');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleProcessFile(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleProcessFile(files[0]);
    }
    e.target.value = '';
  };

  const handleRemoveImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (processedImage?.previewUrl) {
      URL.revokeObjectURL(processedImage.previewUrl);
    }
    setProcessedImage(null);
    setExistingImageUrl(null);
    setImageError(null);
  };

  const handleChangeImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleModalClose = () => {
    if (saving) return;
    if (processedImage?.previewUrl) {
      URL.revokeObjectURL(processedImage.previewUrl);
    }
    setProcessedImage(null);
    setImageError(null);
    setStatusText('');
    onClose();
  };

  const handleConfirm = async () => {
    const trimmedName = name.trim();
    const trimmedNameEn = (nameAlreadyEnglish ? trimmedName : nameEn.trim()) || trimmedName;
    const trimmedSku = sku.trim().toUpperCase();
    const targetCategory = categories.find((c) => c.id === categoryId) || categories[0];
    const targetUnit = units.find((u) => u.id === unitId) || units[0];
    const numPrice = Number(price);
    const numMinimum = Number(minimum);
    const numStock = Number(stock);

    if (!trimmedName || !trimmedSku || !targetCategory || !targetUnit) {
      setError(t.productModal.errRequired);
      return;
    }

    if (
      !Number.isFinite(numPrice) ||
      numPrice < 0 ||
      !Number.isInteger(numMinimum) ||
      numMinimum < 0 ||
      !Number.isInteger(numStock) ||
      numStock < 0
    ) {
      setError(t.productModal.errNumbers);
      return;
    }

    if (!editProduct && numStock > 0) {
      setError(t.productModal.errInitialStock);
      return;
    }

    setError('');
    setSaving(true);

    try {
      let finalImageUrl: string | null = null;

      if (processedImage?.blob) {
        setStatusText(
          locale === 'vi'
            ? 'Đang tải ảnh lên Cloudflare R2...'
            : 'Uploading image to Cloudflare R2...'
        );

        const uploadRes = await uploadProductImage(processedImage.blob);
        if (!uploadRes.success || !uploadRes.url) {
          setError(
            uploadRes.error ||
              (locale === 'vi'
                ? 'Không thể tải ảnh lên Cloudflare R2.'
                : 'Failed to upload image to Cloudflare R2.')
          );
          setSaving(false);
          setStatusText('');
          return;
        }

        finalImageUrl = uploadRes.url;
      } else if (existingImageUrl) {
        finalImageUrl = existingImageUrl;
      } else {
        finalImageUrl = null;
      }

      setStatusText(
        locale === 'vi'
          ? 'Đang lưu thông tin sản phẩm...'
          : 'Saving product information...'
      );

      await onSave({
        name: trimmedName,
        nameEn: trimmedNameEn,
        sku: trimmedSku,
        categoryId: targetCategory.id,
        unitId: targetUnit.id,
        costPrice: numPrice,
        minimumStock: numMinimum,
        initialStock: numStock,
        editId: editProduct?.id,
        imageUrl: finalImageUrl,
      });

      if (processedImage?.previewUrl) {
        URL.revokeObjectURL(processedImage.previewUrl);
      }
      setProcessedImage(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.productModal.errSave);
    } finally {
      setSaving(false);
      setStatusText('');
    }
  };

  const savingsPercent = processedImage
    ? Math.max(
        0,
        Math.round(
          ((processedImage.originalSize - processedImage.compressedSize) /
            processedImage.originalSize) *
            100
        )
      )
    : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={editProduct ? t.productModal.editTitle : t.productModal.addTitle}
      description={editProduct ? t.productModal.editDesc : t.productModal.addDesc}
      actions={
        <>
          <button
            type="button"
            className="btn secondary"
            onClick={handleModalClose}
            disabled={saving}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={saving || isProcessingImage}
            onClick={handleConfirm}
          >
            {saving ? (statusText || t.common.saving) : t.common.confirm}
          </button>
        </>
      }
    >
      <div className="form-grid">
        {/* Hidden native file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Dynamic Image Upload & Preview Interactive Box */}
        {isProcessingImage ? (
          <div
            className="wide"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px 16px',
              background: '#fafbff',
              border: '1px dashed #7569eb',
              borderRadius: '12px',
              marginBottom: '4px',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                border: '3px solid #e0e7ff',
                borderTopColor: '#7569eb',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #15203b)' }}>
              {locale === 'vi'
                ? 'Đang tiền xử lý & tối ưu hoá WebP...'
                : 'Pre-processing & optimizing WebP image...'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--muted, #7c8498)' }}>
              {locale === 'vi'
                ? 'Đang nén client-side bằng HTML5 Canvas...'
                : 'Compressing client-side via HTML5 Canvas...'}
            </span>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : processedImage ? (
          <div
            className="wide"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 14px',
              background: '#fafbff',
              border: '1px solid #7569eb44',
              borderRadius: '12px',
              marginBottom: '4px',
            }}
          >
            <ProductImage
              src={processedImage.previewUrl}
              alt={name || editProduct?.name || 'Product'}
              category={categories.find((c) => c.id === categoryId)?.name}
              size="lg"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '2px',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text, #15203b)',
                  }}
                >
                  {locale === 'vi' ? 'Ảnh đã xử lý' : 'Optimized Image'}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    background: '#ede9fe',
                    color: '#5b21b6',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    letterSpacing: '0.5px',
                  }}
                >
                  WEBP
                </span>
                <span style={{ fontSize: '11px', color: 'var(--muted, #7c8498)' }}>
                  {processedImage.width} × {processedImage.height}px
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: 'var(--muted, #7c8498)' }}>
                  {formatFileSize(processedImage.originalSize)}
                </span>
                <span style={{ color: 'var(--muted, #7c8498)' }}>→</span>
                <span style={{ fontWeight: 600, color: '#059669' }}>
                  {formatFileSize(processedImage.compressedSize)}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#059669',
                    background: '#ecfdf5',
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}
                >
                  -{savingsPercent}%
                </span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                className="btn secondary"
                onClick={handleChangeImage}
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  height: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={locale === 'vi' ? 'Đổi ảnh khác' : 'Change image'}
              >
                <RefreshCw size={13} />
                <span>{locale === 'vi' ? 'Đổi ảnh' : 'Change'}</span>
              </button>
              <button
                type="button"
                onClick={handleRemoveImage}
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  height: 'auto',
                  background: '#fff',
                  border: '1px solid #fee2e2',
                  color: '#dc2626',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
                title={locale === 'vi' ? 'Xóa ảnh' : 'Remove image'}
              >
                <Trash2 size={13} />
                <span>{locale === 'vi' ? 'Xóa' : 'Remove'}</span>
              </button>
            </div>
          </div>
        ) : existingImageUrl ? (
          <div
            className="wide"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 14px',
              background: '#fafbff',
              border: '1px solid #7569eb44',
              borderRadius: '12px',
              marginBottom: '4px',
            }}
          >
            <ProductImage
              src={existingImageUrl}
              alt={name || editProduct?.name || 'Product'}
              category={categories.find((c) => c.id === categoryId)?.name}
              size="lg"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text, #15203b)',
                  marginBottom: '2px',
                }}
              >
                {locale === 'vi' ? 'Ảnh sản phẩm hiện tại' : 'Current Product Image'}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--muted, #7c8498)',
                  display: 'block',
                  wordBreak: 'break-all',
                }}
              >
                {existingImageUrl}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                className="btn secondary"
                onClick={handleChangeImage}
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  height: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={locale === 'vi' ? 'Đổi ảnh khác' : 'Change image'}
              >
                <RefreshCw size={13} />
                <span>{locale === 'vi' ? 'Đổi ảnh' : 'Change'}</span>
              </button>
              <button
                type="button"
                onClick={() => setExistingImageUrl(null)}
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  height: 'auto',
                  background: '#fff',
                  border: '1px solid #fee2e2',
                  color: '#dc2626',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
                title={locale === 'vi' ? 'Xóa ảnh' : 'Remove image'}
              >
                <Trash2 size={13} />
                <span>{locale === 'vi' ? 'Xóa' : 'Remove'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            className="wide"
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 16px',
              background: isDragging ? '#f5f3ff' : '#fafbff',
              border: isDragging
                ? '2px dashed #7569eb'
                : '1px dashed var(--line, #e8eaf2)',
              borderRadius: '12px',
              marginBottom: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: isDragging ? '#ede9fe' : '#f0f2fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7569eb',
                flexShrink: 0,
                transition: 'background 0.2s ease',
              }}
            >
              <UploadCloud size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text, #15203b)',
                  }}
                >
                  {locale === 'vi' ? 'Tải lên ảnh sản phẩm' : 'Upload Product Image'}
                </span>
                <span style={{ fontSize: '11px', color: '#7569eb', fontWeight: 500 }}>
                  {locale === 'vi' ? '(Nhấp hoặc kéo thả)' : '(Click or drag & drop)'}
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--muted, #7c8498)',
                  display: 'block',
                  marginTop: '2px',
                }}
              >
                {locale === 'vi'
                  ? 'Hỗ trợ JPEG, PNG, WebP (Tối đa 10MB - Tự động nén WebP max 800px)'
                  : 'Supports JPEG, PNG, WebP (Max 10MB - Auto WebP 800px)'}
              </span>
            </div>
          </div>
        )}

        {imageError && (
          <div
            className="wide"
            style={{
              color: '#dc2626',
              fontSize: '12px',
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '8px',
              padding: '8px 12px',
              marginBottom: '4px',
            }}
          >
            {imageError}
          </div>
        )}

        <label className="wide">
          {t.productModal.nameLabel}
          <input
            value={name}
            maxLength={160}
            onChange={(e) => {
              const val = e.target.value;
              setName(val);
              if (nameAlreadyEnglish) setNameEn(val);
            }}
            placeholder={t.productModal.namePlaceholder}
          />
        </label>

        <div className="wide" style={{ padding: '2px 0 4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={nameAlreadyEnglish}
              onChange={(e) => toggleNameAlreadyEnglish(e.target.checked)}
              style={{ width: 17, height: 17, flex: 'none', accentColor: '#7569eb' }}
            />
            <span>{t.productModal.alreadyEnglish}</span>
          </label>
          <p className="form-hint" style={{ margin: '4px 0 0 27px' }}>
            {nameAlreadyEnglish
              ? t.productModal.alreadyEnglishHint
              : t.productModal.needEnglishHint}
          </p>
        </div>

        {!nameAlreadyEnglish && (
          <label className="wide">
            {t.productModal.nameEnLabel}
            <input
              value={nameEn}
              maxLength={160}
              placeholder={t.productModal.nameEnPlaceholder}
              onChange={(e) => setNameEn(e.target.value)}
            />
          </label>
        )}

        <label>
          {t.productModal.skuLabel}
          <input
            value={sku}
            maxLength={40}
            onChange={(e) => setSku(e.target.value)}
            placeholder={t.productModal.skuPlaceholder}
          />
        </label>

        <label>
          {t.productModal.categoryLabel}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => {
              const catName = locale === 'vi' ? c.name : (c.name_en?.trim() || c.name);
              return (
                <option key={c.id} value={c.id}>
                  {catName}
                </option>
              );
            })}
          </select>
        </label>

        <label>
          {t.productModal.unitLabel}
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            {units.map((u) => {
              const unitName = locale === 'vi' ? u.name : (u.name_en?.trim() || u.name);
              const unitSymbol = locale === 'vi' ? u.symbol : (u.symbol_en?.trim() || u.symbol);
              return (
                <option key={u.id} value={u.id}>
                  {unitName} ({unitSymbol})
                </option>
              );
            })}
          </select>
        </label>

        <label>
          {t.productModal.priceLabel}
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>

        <label>
          {t.productModal.initialStockLabel}
          <input
            type="number"
            min="0"
            disabled={Boolean(editProduct)}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </label>

        <label>
          {t.productModal.thresholdLabel}
          <input
            type="number"
            min="0"
            value={minimum}
            onChange={(e) => setMinimum(e.target.value)}
          />
        </label>
      </div>

      {saving && statusText && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#4f46e5',
            background: '#eef2ff',
            padding: '8px 12px',
            borderRadius: '8px',
            marginTop: '12px',
          }}
        >
          <div
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid #c7d2fe',
              borderTopColor: '#4f46e5',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span>{statusText}</span>
        </div>
      )}

      {error && <div className="form-error" role="alert" style={{ marginTop: '12px' }}>{error}</div>}
    </Modal>
  );
}
