import React from 'react';
import type { ApiCategory, Product } from './types';

export interface CategoriesTabProps {
  categories: ApiCategory[];
  products: Product[];
}

export default function CategoriesTab({
  categories,
  products,
}: CategoriesTabProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Danh mục hàng hóa</h2>
          <p>Phân nhóm các mặt hàng hiện có</p>
        </div>
      </div>

      <div className="category-grid">
        {categories.map((item) => {
          const count = products.filter((p) => p.category === item.name).length;
          return (
            <div className="category-card" key={item.id}>
              <div className="category-symbol">▦</div>
              <h3>{item.name}</h3>
              <p>{count} sản phẩm</p>
            </div>
          );
        })}
      </div>

      <p className="hint">
        Danh mục được đồng bộ từ cơ sở dữ liệu PostgreSQL. Để tạo danh mục mới hãy sử dụng API quản trị danh mục.
      </p>
    </section>
  );
}
