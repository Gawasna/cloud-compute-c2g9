'use client';

import React, { useSyncExternalStore } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { THEME_COLORS, CHART_COLORS } from '@/lib/theme/tokens';
import CustomChartTooltip from './CustomChartTooltip';

const emptySubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export interface MovementTrendDataPoint {
  period: string;
  label?: string;
  inbound: number;
  outbound: number;
}

export interface MovementTrendChartProps {
  data: MovementTrendDataPoint[];
  height?: number;
  showLegend?: boolean;
  formatXAxis?: (value: string) => string;
  inboundLabel?: string;
  outboundLabel?: string;
  animationDuration?: number;
  emptyText?: string;
}

export default function MovementTrendChart({
  data,
  height = 220,
  showLegend = false,
  formatXAxis,
  inboundLabel = 'Inbound',
  outboundLabel = 'Outbound',
  animationDuration = 800,
  emptyText = 'No movement data available',
}: MovementTrendChartProps) {
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <div
        style={{
          height: `${height}px`,
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
        <span>Loading chart analytics...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: `${height}px`,
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
        <span>{emptyText}</span>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    displayLabel: d.label ?? (formatXAxis ? formatXAxis(d.period) : d.period),
  }));

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        position: 'relative',
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
          barGap={4}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={THEME_COLORS.chartGrid}
            vertical={false}
          />
          <XAxis
            dataKey="displayLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fill: THEME_COLORS.chartAxis, fontSize: 11 }}
            dy={6}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: THEME_COLORS.chartAxis, fontSize: 11 }}
            allowDecimals={false}
            tickFormatter={(val: number) => val.toLocaleString('en-US')}
          />
          <Tooltip
            content={<CustomChartTooltip valueSuffix="units" />}
            cursor={{ fill: 'rgba(119, 105, 232, 0.05)', radius: 4 }}
          />
          {showLegend && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontSize: '12px',
                paddingTop: '8px',
                color: THEME_COLORS.textSecondary,
              }}
            />
          )}
          <Bar
            dataKey="inbound"
            name={inboundLabel}
            fill={CHART_COLORS.inbound}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            animationDuration={animationDuration}
          />
          <Bar
            dataKey="outbound"
            name={outboundLabel}
            fill={CHART_COLORS.outbound}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            animationDuration={animationDuration}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
