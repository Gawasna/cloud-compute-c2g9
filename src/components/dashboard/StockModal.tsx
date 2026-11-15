'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { Product } from './types';

export interface StockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (stockData: {
    productId: string;
    type: 'IN' | 'OUT';
    quantity: number;
    note: string;
  }) => Promise<void>;
  products: Product[];
  initialSku?: string;
}

export default function StockModal({
  isOpen,
  onClose,
  onSave,
  products,
  initialSku = '',
}: StockModalProps) {
  const { t, formatNumber, interpolate } = useI18n();
  const [selectedSku, setSelectedSku] = useState(
    initialSku || products[0]?.sku || ''
  );
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    const product = products.find((p) => p.sku === selectedSku);
    const qty = Number(quantity);

    if (!product) {
      setError(t.stockModal.errNotExists);
      return;
    }

    if (!Number.isSafeInteger(qty) || qty <= 0) {
      setError(t.stockModal.errPositive);
      return;
    }

    if (type === 'OUT' && qty > product.stock) {
      setError(
        interpolate(t.stockModal.errExceed, {
          stock: formatNumber(product.stock),
          unit: product.unit,
        })
      );
      return;
    }

    setError('');
    setSaving(true);

    try {
      await onSave({
        productId: product.id,
        type,
        quantity: qty,
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.stockModal.errCreate);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.stockModal.title}
      description={t.stockModal.desc}
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
          {t.stockModal.productLabel}
          <select
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.sku}>
                {p.name} ({p.sku}) — {t.common.stock}: {formatNumber(p.stock)} {p.unit}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t.stockModal.typeLabel}
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'IN' | 'OUT')}
          >
            <option value="IN">{t.stockModal.typeIn}</option>
            <option value="OUT">{t.stockModal.typeOut}</option>
          </select>
        </label>

        <label>
          {t.stockModal.quantityLabel}
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>

        <label className="wide">
          {t.stockModal.noteLabel}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.stockModal.notePlaceholder}
          />
        </label>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
    </Modal>
  );
}
