import React from 'react';
import { renderCategoryIcon } from '@/components/ui/Icons';
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
          <h2>Product Categories</h2>
          <p>Classification and grouped catalog inventory</p>
        </div>
      </div>

      <div className="category-grid">
        {categories.map((item) => {
          const displayName = item.name_en?.trim() || item.name;
          const count = products.filter(
            (p) =>
              p.category === displayName ||
              p.category === item.name ||
              p.categoryId === item.id
          ).length;
          return (
            <div className="category-card" key={item.id}>
              <div className="category-symbol">
                {renderCategoryIcon(displayName, { size: 24 })}
              </div>
              <h3>{displayName}</h3>
              {item.name_en && item.name && item.name_en !== item.name && (
                <small className="hint" style={{ display: 'block', marginBottom: 4 }}>
                  {item.name}
                </small>
              )}
              <p>{count} products</p>
            </div>
          );
        })}
      </div>

      <p className="hint">
        Categories are synced from PostgreSQL. To define new categories, use the category management API.
      </p>
    </section>
  );
}
