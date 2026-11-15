'use client';

import React from 'react';
import { THEME_COLORS } from '@/lib/theme/tokens';

export interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  fill?: string;
  payload?: {
    percent?: number;
    unit?: string;
    [key: string]: unknown;
  };
}

export interface CustomChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  title?: string;
  valueSuffix?: string;
  formatter?: (value: number | string, name?: string) => string;
}

export default function CustomChartTooltip({
  active,
  payload,
  label,
  title,
  valueSuffix = 'items',
  formatter,
}: CustomChartTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const headerTitle = title || (label !== undefined && label !== null && String(label).length > 0 ? String(label) : null);

  return (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${THEME_COLORS.border}`,
        borderRadius: '10px',
        padding: '10px 14px',
        boxShadow: '0 10px 25px -5px rgba(21, 32, 59, 0.12), 0 4px 10px -2px rgba(21, 32, 59, 0.05)',
        minWidth: '140px',
        fontSize: '12px',
        color: THEME_COLORS.textPrimary,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {headerTitle && (
        <div
          style={{
            fontWeight: 600,
            fontSize: '12px',
            color: THEME_COLORS.textPrimary,
            marginBottom: '8px',
            paddingBottom: '6px',
            borderBottom: `1px solid #eff0f6`,
            letterSpacing: '-0.2px',
          }}
        >
          {headerTitle}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {payload.map((entry, index) => {
          const color = entry.color || entry.fill || THEME_COLORS.brand;
          const rawValue = entry.value ?? 0;
          const displayValue = formatter
            ? formatter(rawValue, entry.name)
            : typeof rawValue === 'number'
            ? rawValue.toLocaleString('en-US')
            : rawValue;

          const percent = entry.payload?.percent;
          const percentText = typeof percent === 'number' ? ` (${(percent * 100).toFixed(1)}%)` : '';

          return (
            <div
              key={`tooltip-item-${index}-${entry.name || ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: THEME_COLORS.textSecondary, fontWeight: 500 }}>
                  {entry.name || 'Value'}
                </span>
              </div>
              <div style={{ fontWeight: 600, color: THEME_COLORS.textPrimary }}>
                {displayValue} {valueSuffix ? <span style={{ fontWeight: 400, color: THEME_COLORS.textMuted, fontSize: '11px' }}>{valueSuffix}</span> : null}
                {percentText && (
                  <span style={{ color: THEME_COLORS.textMuted, fontSize: '11px', fontWeight: 400 }}>
                    {percentText}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
