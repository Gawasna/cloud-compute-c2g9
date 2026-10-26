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
      setError('Sản phẩm đã chọn không tồn tại trong hệ thống.');
      return;
    }

    if (!Number.isSafeInteger(qty) || qty <= 0) {
      setError('Số lượng phải là một số nguyên dương (> 0).');
      return;
    }

    if (type === 'OUT' && qty > product.stock) {
      setError(
        `Không thể xuất quá số lượng tồn kho hiện tại (${product.stock} ${product.unit}).`
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
      setError(err instanceof Error ? err.message : 'Tạo phiếu giao dịch thất bại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo phiếu nhập / xuất kho"
      description="Số lượng tồn kho và lịch sử giao dịch sẽ được cập nhật tự động sau khi xác nhận phiếu."
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
          Sản phẩm
          <select
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.sku}>
                {p.name} ({p.sku}) — tồn: {p.stock} {p.unit}
              </option>
            ))}
          </select>
        </label>

        <label>
          Loại giao dịch
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'IN' | 'OUT')}
          >
            <option value="IN">Nhập kho (＋)</option>
            <option value="OUT">Xuất kho (－)</option>
          </select>
        </label>

        <label>
          Số lượng
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>

        <label className="wide">
          Ghi chú
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Lý do nhập / xuất hàng hoặc mã đơn vận chuyển"
          />
        </label>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
    </Modal>
  );
}
