import React, { useState } from 'react';
import { Modal } from '@/components/ui';
import type { ApiCategory, ApiUnit, Product } from './types';

export interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: {
    name: string;
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
  const [name, setName] = useState(editProduct ? editProduct.name : '');
  const [sku, setSku] = useState(editProduct ? editProduct.sku : '');
  const [categoryName, setCategoryName] = useState(
    editProduct ? editProduct.category : categories[0]?.name || ''
  );
  const [unitSymbol, setUnitSymbol] = useState(
    editProduct ? editProduct.unit : units[0]?.symbol || ''
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

  const handleConfirm = async () => {
    const trimmedName = name.trim();
    const trimmedSku = sku.trim().toUpperCase();
    const targetCategory = categories.find((c) => c.name === categoryName);
    const targetUnit = units.find((u) => u.symbol === unitSymbol);
    const numPrice = Number(price);
    const numMinimum = Number(minimum);
    const numStock = Number(stock);

    if (!trimmedName || !trimmedSku || !targetCategory || !targetUnit) {
      setError('Vui lòng nhập đầy đủ tên sản phẩm, mã SKU và chọn danh mục, đơn vị tính.');
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
      setError('Giá vốn và số lượng phải là số không âm hợp lệ.');
      return;
    }

    if (!editProduct && numStock > 0) {
      setError(
        'Sản phẩm mới phải có số lượng tồn ban đầu bằng 0. Sau khi tạo, hãy lập phiếu nhập kho để ghi nhận tồn và lịch sử giao dịch.'
      );
      return;
    }

    setError('');
    setSaving(true);

    try {
      await onSave({
        name: trimmedName,
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
      setError(err instanceof Error ? err.message : 'Lưu sản phẩm thất bại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editProduct ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
      description={
        editProduct
          ? 'Cập nhật thông tin chi tiết của sản phẩm hiện có.'
          : 'Vui lòng chọn danh mục và đơn vị tính đã được thiết lập sẵn trong hệ thống.'
      }
      actions={
        <>
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
            disabled={saving}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={saving}
            onClick={handleConfirm}
          >
            {saving ? 'Đang lưu...' : 'Xác nhận'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="wide">
          Tên sản phẩm
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Cáp sạc Type-C nhanh 65W"
          />
        </label>

        <label>
          Mã SKU
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Ví dụ: CAB-001"
          />
        </label>

        <label>
          Danh mục
          <select
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Đơn vị tính
          <select
            value={unitSymbol}
            onChange={(e) => setUnitSymbol(e.target.value)}
          >
            {units.map((u) => (
              <option key={u.id} value={u.symbol}>
                {u.name} ({u.symbol})
              </option>
            ))}
          </select>
        </label>

        <label>
          Giá vốn (VNĐ)
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>

        <label>
          Tồn ban đầu (nhập kho bằng phiếu)
          <input
            type="number"
            min="0"
            disabled={!!editProduct}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </label>

        <label>
          Ngưỡng cảnh báo tối thiểu
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
