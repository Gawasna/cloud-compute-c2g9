'use client';

import React, { useSyncExternalStore, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Sector,
} from 'recharts';
import type { PieSectorDataItem } from 'recharts';
import { THEME_COLORS, CHART_COLORS } from '@/lib/theme/tokens';
import { useI18n } from '@/lib/i18n';
import CustomChartTooltip from './CustomChartTooltip';

const emptySubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export interface StockDistributionChartProps {
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalProducts?: number;
  height?: number;
  showLegend?: boolean;
  centerLabel?: string;
}

const renderActiveShape = (props: unknown) => {
  const p = props as PieSectorDataItem;
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill = '',
  } = p;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={Number(innerRadius) - 2}
        outerRadius={Number(outerRadius) + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          filter: 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.15))',
          transition: 'all 0.2s ease',
        }}
      />
    </g>
  );
};

export default function StockDistributionChart({
  inStockCount,
  lowStockCount,
  outOfStockCount,
  totalProducts,
  height = 190,
  showLegend = true,
  centerLabel,
}: StockDistributionChartProps) {
  const isClient = useIsClient();
  const { t, locale, formatNumber } = useI18n();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = totalProducts ?? (inStockCount + lowStockCount + outOfStockCount);
  const resolvedCenterLabel = centerLabel ?? (locale === 'vi' ? 'sản phẩm' : 'items');

  const data = [
    {
      name: 'In Stock',
      value: inStockCount,
      color: CHART_COLORS.inStock,
      percent: total > 0 ? inStockCount / total : 0,
    },
    {
      name: 'Low Stock',
      value: lowStockCount,
      color: CHART_COLORS.lowStock,
      percent: total > 0 ? lowStockCount / total : 0,
    },
    {
      name: 'Out of Stock',
      value: outOfStockCount,
      color: CHART_COLORS.outOfStock,
      percent: total > 0 ? outOfStockCount / total : 0,
    },
  ];

  const isEmpty = total === 0;
  const displayData = isEmpty
    ? [{ name: 'No Data', value: 1, color: '#e2e8f0', percent: 0 }]
    : data.filter((item) => item.value > 0);

  if (!isClient) {
    return (
      <div
        style={{
          height: `${height + (showLegend ? 40 : 0)}px`,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafbff',
          borderRadius: '12px',
          color: THEME_COLORS.textMuted,
          fontSize: '13px',
        }}
      >
        <span>Loading stock distribution...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: `${height}px`,
          maxWidth: '220px',
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {!isEmpty && (
              <Tooltip
                content={<CustomChartTooltip valueSuffix="items" />}
              />
            )}
            <Pie
              data={displayData}
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="85%"
              paddingAngle={isEmpty ? 0 : 3}
              dataKey="value"
              activeShape={renderActiveShape}
              animationDuration={800}
            >
              {displayData.map((entry, index) => {
                const isHovered = hoveredIndex === index;
                const isDimmed = hoveredIndex !== null && !isHovered;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    opacity={isDimmed ? 0.45 : 1}
                    style={{
                      cursor: isEmpty ? 'default' : 'pointer',
                      outline: 'none',
                      transition: 'opacity 0.2s ease',
                    }}
                  />
                );
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Donut Label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: THEME_COLORS.textPrimary,
              lineHeight: 1.1,
              letterSpacing: '-0.5px',
            }}
          >
            {formatNumber ? formatNumber(total) : total.toLocaleString('en-US')}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: THEME_COLORS.textSecondary,
              fontWeight: 500,
              marginTop: '2px',
            }}
          >
            {resolvedCenterLabel}
          </span>
        </div>
      </div>

      {showLegend && (
        <div
          className="chart-donut-legend"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginTop: '12px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              opacity: hoveredIndex !== null && hoveredIndex !== 0 ? 0.5 : 1,
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={() => setHoveredIndex(0)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <i
              className="dot"
              style={{
                backgroundColor: CHART_COLORS.inStock,
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                display: 'inline-block',
                margin: 0,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 500, color: THEME_COLORS.textSecondary }}>
              {t?.common?.inStock || 'In Stock'}
            </span>
            <strong style={{ fontSize: '12px', fontWeight: 700, color: THEME_COLORS.textPrimary }}>
              {formatNumber ? formatNumber(inStockCount) : inStockCount.toLocaleString('en-US')}
            </strong>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              opacity: hoveredIndex !== null && hoveredIndex !== 1 ? 0.5 : 1,
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={() => setHoveredIndex(1)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <i
              className="dot"
              style={{
                backgroundColor: CHART_COLORS.lowStock,
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                display: 'inline-block',
                margin: 0,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 500, color: THEME_COLORS.textSecondary }}>
              {t?.common?.lowStock || 'Low Stock'}
            </span>
            <strong style={{ fontSize: '12px', fontWeight: 700, color: THEME_COLORS.textPrimary }}>
              {formatNumber ? formatNumber(lowStockCount) : lowStockCount.toLocaleString('en-US')}
            </strong>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              opacity: hoveredIndex !== null && hoveredIndex !== 2 ? 0.5 : 1,
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={() => setHoveredIndex(2)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <i
              className="dot"
              style={{
                backgroundColor: CHART_COLORS.outOfStock,
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                display: 'inline-block',
                margin: 0,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 500, color: THEME_COLORS.textSecondary }}>
              {t?.common?.outOfStock || 'Out of Stock'}
            </span>
            <strong style={{ fontSize: '12px', fontWeight: 700, color: THEME_COLORS.textPrimary }}>
              {formatNumber ? formatNumber(outOfStockCount) : outOfStockCount.toLocaleString('en-US')}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
