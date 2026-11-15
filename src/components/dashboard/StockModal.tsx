import React, { useState } from 'react';
import { Modal } from '@/components/ui';
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
      setError('The selected product does not exist in the system.');
      return;
    }

    if (!Number.isSafeInteger(qty) || qty <= 0) {
      setError('Quantity must be a positive integer (> 0).');
      return;
    }

    if (type === 'OUT' && qty > product.stock) {
      setError(
        `Cannot issue more than current stock quantity (${product.stock} ${product.unit}).`
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
      setError(err instanceof Error ? err.message : 'Failed to create stock ticket.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Stock Movement"
      description="Stock quantities and movement logs will automatically update upon confirmation."
      actions={
        <>
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={saving}
            onClick={handleConfirm}
          >
            {saving ? 'Saving...' : 'Confirm'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="wide">
          Product
          <select
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.sku}>
                {p.name} ({p.sku}) — stock: {p.stock} {p.unit}
              </option>
            ))}
          </select>
        </label>

        <label>
          Movement Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'IN' | 'OUT')}
          >
            <option value="IN">Stock In (Inbound)</option>
            <option value="OUT">Stock Out (Outbound)</option>
          </select>
        </label>

        <label>
          Quantity
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>

        <label className="wide">
          Note
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for movement or reference order number"
          />
        </label>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
    </Modal>
  );
}
