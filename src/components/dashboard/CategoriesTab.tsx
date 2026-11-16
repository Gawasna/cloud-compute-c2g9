'use client';

import React from 'react';
import { renderCategoryIcon } from '@/components/ui/Icons';
import { useI18n } from '@/lib/i18n';
import type { ApiCategory, Product } from './types';

export interface CategoriesTabProps {
  categories: ApiCategory[];
  products: Product[];
}

export default function CategoriesTab({
  categories,
  products,
}: CategoriesTabProps) {
  const { t, locale, formatNumber, interpolate } = useI18n();

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{t.categoriesTab.title}</h2>
          <p>{t.categoriesTab.desc}</p>
        </div>
      </div>

      <div className="category-grid">
        {categories.map((item) => {
          const primaryName =
            locale === 'vi'
              ? item.name
              : item.name_en?.trim() || item.name;
          const secondaryName =
            locale === 'vi'
              ? item.name_en?.trim()
              : item.name;

          const count = products.filter(
            (p) =>
              p.category === primaryName ||
              p.category === item.name ||
              p.category === item.name_en ||
              p.categoryId === item.id
          ).length;

          return (
            <div className="category-card" key={item.id}>
              <div className="category-symbol">
                {renderCategoryIcon(primaryName, { size: 24 })}
              </div>
              <h3>{primaryName}</h3>
              {secondaryName && secondaryName !== primaryName && (
                <small className="category-subtext">
                  {secondaryName}
                </small>
              )}
              <p>{interpolate(t.categoriesTab.productsCount, { count: formatNumber(count) })}</p>
            </div>
          );
        })}
      </div>

      <p className="hint">
        {t.categoriesTab.hint}
      </p>
    </section>
  );
}
