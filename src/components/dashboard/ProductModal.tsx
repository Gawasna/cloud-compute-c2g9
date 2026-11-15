import React, { useState } from 'react';
import { Modal } from '@/components/ui';
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
      setError('Please provide product name, SKU, category, and unit.');
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
      setError('Cost price and stock quantities must be valid non-negative numbers.');
      return;
    }

    if (!editProduct && numStock > 0) {
      setError(
        'New products must have an initial stock of 0. Create a stock-in movement ticket afterwards.'
      );
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
      setError(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editProduct ? 'Edit Product' : 'Add New Product'}
      description={
        editProduct
          ? 'Update the details and English name of the product.'
          : 'Choose an existing category and unit configured in the system.'
      }
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
          Product Name
          <input
            value={name}
            maxLength={160}
            onChange={(e) => {
              const val = e.target.value;
              setName(val);
              if (nameAlreadyEnglish) setNameEn(val);
            }}
            placeholder="e.g. Logitech G304 Wireless Mouse"
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
            <span>Product name is already in English</span>
          </label>
          <p className="hint" style={{ margin: '5px 0 0 27px' }}>
            {nameAlreadyEnglish
              ? 'The English name will be saved automatically using the product name above.'
              : 'Enter the original name above, then provide its English translation below.'}
          </p>
        </div>

        {!nameAlreadyEnglish && (
          <label className="wide">
            English Product Name
            <input
              value={nameEn}
              maxLength={160}
              placeholder="e.g. Logitech G304 Wireless Mouse"
              onChange={(e) => setNameEn(e.target.value)}
            />
          </label>
        )}

        <label>
          SKU Code
          <input
            value={sku}
            maxLength={40}
            onChange={(e) => setSku(e.target.value)}
            placeholder="e.g. ELE-001"
          />
        </label>

        <label>
          Category
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_en?.trim() || c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Unit of Measure
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name_en?.trim() || u.name} ({u.symbol_en?.trim() || u.symbol})
              </option>
            ))}
          </select>
        </label>

        <label>
          Cost Price (VND)
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>

        <label>
          Initial Stock (0; use Stock In ticket)
          <input
            type="number"
            min="0"
            disabled={!!editProduct}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </label>

        <label>
          Low Stock Threshold
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
