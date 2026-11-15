'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
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

  const toggleNameAlreadyEnglish = (checked: boolean) => {
    setNameAlreadyEnglish(checked);
    if (checked) {
      setNameEn(name);
    }
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
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.productModal.errSave);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editProduct ? t.productModal.editTitle : t.productModal.addTitle}
      description={editProduct ? t.productModal.editDesc : t.productModal.addDesc}
      actions={
        <>
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
            disabled={saving}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={saving}
            onClick={handleConfirm}
          >
            {saving ? t.common.saving : t.common.confirm}
          </button>
        </>
      }
    >
      <div className="form-grid">
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
          <p className="hint" style={{ margin: '5px 0 0 27px' }}>
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

      {error && <div className="form-error" role="alert">{error}</div>}
    </Modal>
  );
}
