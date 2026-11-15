/**
 * CloudStock Design System Tokens
 * Unified tokens for Icons, Data Visualization, and Color Semantics
 */

export const THEME_COLORS = {
  // Brand
  brand: '#7769e8',
  brandHover: '#6556db',
  brandLight: '#f2eefe',

  // Semantic Status
  success: '#10b981',
  successLight: '#eaf8f0',
  warning: '#f59e0b',
  warningLight: '#fff6e6',
  danger: '#ef4444',
  dangerLight: '#fff0ee',

  // Charts
  inbound: '#8673ed',
  outbound: '#ff938d',
  chartGrid: '#eff0f5',
  chartAxis: '#94a3b8',

  // Neutrals
  textPrimary: '#1d2233',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e8eaf2',
  background: '#f5f6fb',
  surface: '#ffffff',
} as const;

export const CHART_COLORS = {
  inbound: THEME_COLORS.inbound,
  outbound: THEME_COLORS.outbound,
  inStock: THEME_COLORS.success,
  lowStock: THEME_COLORS.warning,
  outOfStock: THEME_COLORS.danger,
} as const;

export const ICON_DEFAULTS = {
  size: 18,
  strokeWidth: 2,
  sizeSm: 15,
  sizeLg: 22,
} as const;
