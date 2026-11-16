'use client';

import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export default function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = '6px',
  className = '',
  style,
}: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  hasAvatar?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  cols = 5,
  hasAvatar = true,
  className = '',
}: TableSkeletonProps) {
  const widths = ['75%', '50%', '85%', '60%', '40%'];

  return (
    <div className={`table-scroll ${className}`.trim()} aria-busy="true">
      <table>
        <tbody>
          {Array.from({ length: rows }).map((_, rIdx) => (
            <tr key={`skel-row-${rIdx}`}>
              {Array.from({ length: cols }).map((_, cIdx) => (
                <td key={`skel-col-${cIdx}`}>
                  {cIdx === 0 && hasAvatar ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Skeleton width={32} height={32} borderRadius={8} />
                      <div style={{ flex: 1 }}>
                        <Skeleton
                          width={widths[(rIdx + cIdx) % widths.length]}
                          height={14}
                          borderRadius={4}
                        />
                      </div>
                    </div>
                  ) : (
                    <Skeleton
                      width={widths[(rIdx + cIdx) % widths.length]}
                      height={14}
                      borderRadius={4}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface MetricCardSkeletonProps {
  className?: string;
}

export function MetricCardSkeleton({ className = '' }: MetricCardSkeletonProps) {
  return (
    <div className={`metric ${className}`.trim()} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} aria-busy="true">
      <Skeleton width="45%" height={13} borderRadius={4} />
      <Skeleton width="70%" height={28} borderRadius={6} />
      <Skeleton width="30%" height={12} borderRadius={4} />
    </div>
  );
}

export interface ChartSkeletonProps {
  height?: number;
  type?: 'bar' | 'donut';
  className?: string;
}

export function ChartSkeleton({
  height = 200,
  type = 'bar',
  className = '',
}: ChartSkeletonProps) {
  return (
    <div
      className={className}
      style={{
        height: `${height}px`,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafbff',
        borderRadius: '14px',
        border: '1px solid var(--line, #e8eaf2)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-busy="true"
    >
      {type === 'donut' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              border: '12px solid #edf0f7',
              position: 'relative',
              animation: 'pulse 1.8s ease-in-out infinite',
            }}
          />
          <div style={{ display: 'flex', gap: '12px' }}>
            <Skeleton width={60} height={12} borderRadius={4} />
            <Skeleton width={60} height={12} borderRadius={4} />
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            gap: '12px',
            padding: '10px 0',
          }}
        >
          {[40, 75, 55, 90, 65, 80, 50].map((h, i) => (
            <div
              key={`skel-bar-${i}`}
              style={{
                flex: 1,
                display: 'flex',
                gap: '4px',
                alignItems: 'flex-end',
                height: '100%',
              }}
            >
              <div
                className="skeleton-shimmer"
                style={{
                  width: '50%',
                  height: `${h}%`,
                  borderRadius: '4px 4px 0 0',
                }}
              />
              <div
                className="skeleton-shimmer"
                style={{
                  width: '50%',
                  height: `${Math.round(h * 0.7)}%`,
                  borderRadius: '4px 4px 0 0',
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
