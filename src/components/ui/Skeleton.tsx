import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export default function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = '6px',
  className = '',
}: SkeletonProps) {
  return (
    <div
      className={`skeleton-loader ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#e8eaf2',
        opacity: 0.7,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}
