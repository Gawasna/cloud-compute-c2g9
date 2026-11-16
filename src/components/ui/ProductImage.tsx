'use client';

import React, { useState } from 'react';
import { ImageIcon, renderCategoryIcon } from './Icons';
import { captureLooseError } from '@/lib/observability';

export interface ProductImageProps {
  src?: string | null;
  alt: string;
  category?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  sm: { dimension: 32, iconSize: 16, radius: 8 },
  md: { dimension: 38, iconSize: 18, radius: 9 },
  lg: { dimension: 64, iconSize: 28, radius: 12 },
  xl: { dimension: 88, iconSize: 36, radius: 14 },
};

export default function ProductImage({
  src,
  alt,
  category,
  size = 'md',
  className = '',
}: ProductImageProps) {
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);
  const config = SIZES[size] || SIZES.md;

  // Normalized validity: if src is empty or matches the failed src
  const normalizedSrc = typeof src === 'string' ? src.trim() : null;
  const hasError = !normalizedSrc || erroredSrc === normalizedSrc;

  const baseStyle: React.CSSProperties = {
    width: `${config.dimension}px`,
    height: `${config.dimension}px`,
    borderRadius: `${config.radius}px`,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    userSelect: 'none',
    border: '1px solid var(--line, #e8eaf2)',
    background: 'linear-gradient(135deg, #f8f9fd 0%, #ebeef7 100%)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  };

  if (normalizedSrc && !hasError) {
    return (
      <span
        className={`product-image-wrap ${className}`.trim()}
        style={baseStyle}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={normalizedSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => {
            setErroredSrc(normalizedSrc);
            try {
              captureLooseError(
                new Error(`Failed to load product image for ${alt}: ${normalizedSrc}`),
                { component: 'ProductImage', sku: alt, src: normalizedSrc, category }
              );
            } catch {
              // resilient
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </span>
    );
  }

  // Fallback placeholder rendering with category icon or default image placeholder
  return (
    <span
      className={`product-image-wrap product-placeholder ${className}`.trim()}
      style={baseStyle}
      title={alt}
      aria-label={alt}
    >
      {category ? (
        <span style={{ color: '#7a6bcc', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {renderCategoryIcon(category, { size: config.iconSize })}
        </span>
      ) : (
        <span style={{ color: 'rgba(134, 115, 237, 0.55)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <ImageIcon size={config.iconSize} />
        </span>
      )}
    </span>
  );
}
