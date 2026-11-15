import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Unit: Recharts Data Visualization System & Inventory Chart Integration', () => {
  const cwd = process.cwd();
  const chartsDir = resolve(cwd, 'src/components/charts');
  const movementTrendPath = resolve(chartsDir, 'MovementTrendChart.tsx');
  const stockDistributionPath = resolve(chartsDir, 'StockDistributionChart.tsx');
  const customTooltipPath = resolve(chartsDir, 'CustomChartTooltip.tsx');
  const chartsIndexPath = resolve(chartsDir, 'index.ts');
  const overviewTabPath = resolve(cwd, 'src/components/dashboard/OverviewTab.tsx');
  const movementChartPath = resolve(cwd, 'src/components/MovementChart.tsx');
  const tokensPath = resolve(cwd, 'src/lib/theme/tokens.ts');

  it('should verify all required chart component and index files exist', () => {
    const requiredFiles = [
      movementTrendPath,
      stockDistributionPath,
      customTooltipPath,
      chartsIndexPath,
    ];

    for (const filePath of requiredFiles) {
      assert.strictEqual(
        existsSync(filePath),
        true,
        `Expected chart component file to exist: ${filePath}`
      );
    }
  });

  it('should verify charts index exports all chart modules and their contracts', () => {
    const indexContent = readFileSync(chartsIndexPath, 'utf8');
    assert.strictEqual(
      indexContent.includes("export { default as MovementTrendChart } from './MovementTrendChart'"),
      true,
      'charts/index.ts must export MovementTrendChart'
    );
    assert.strictEqual(
      indexContent.includes("export { default as StockDistributionChart } from './StockDistributionChart'"),
      true,
      'charts/index.ts must export StockDistributionChart'
    );
    assert.strictEqual(
      indexContent.includes("export { default as CustomChartTooltip } from './CustomChartTooltip'"),
      true,
      'charts/index.ts must export CustomChartTooltip'
    );
  });

  it('should verify chart components are client components and enforce use client directive', () => {
    for (const filePath of [movementTrendPath, stockDistributionPath, customTooltipPath]) {
      const content = readFileSync(filePath, 'utf8');
      assert.strictEqual(
        content.startsWith("'use client'"),
        true,
        `${filePath} must start with 'use client' directive for Next.js App Router`
      );
    }
  });

  it('should verify MovementTrendChart integrates Recharts and applies design tokens', () => {
    const content = readFileSync(movementTrendPath, 'utf8');
    assert.strictEqual(
      content.includes('ResponsiveContainer') &&
        content.includes('BarChart') &&
        content.includes('Bar') &&
        content.includes('XAxis') &&
        content.includes('YAxis') &&
        content.includes('CartesianGrid') &&
        content.includes('Tooltip'),
      true,
      'MovementTrendChart must use core Recharts components'
    );
    assert.strictEqual(
      content.includes('CHART_COLORS.inbound') && content.includes('CHART_COLORS.outbound'),
      true,
      'MovementTrendChart must use CHART_COLORS design tokens for inbound and outbound bars'
    );
    assert.strictEqual(
      content.includes('animationDuration'),
      true,
      'MovementTrendChart must support smooth bar update animation'
    );
  });

  it('should verify StockDistributionChart integrates Recharts Donut and applies design tokens', () => {
    const content = readFileSync(stockDistributionPath, 'utf8');
    assert.strictEqual(
      content.includes('ResponsiveContainer') &&
        content.includes('PieChart') &&
        content.includes('Pie') &&
        content.includes('Cell') &&
        content.includes('Tooltip'),
      true,
      'StockDistributionChart must use Recharts PieChart components'
    );
    assert.strictEqual(
      content.includes('CHART_COLORS.inStock') &&
        content.includes('CHART_COLORS.lowStock') &&
        content.includes('CHART_COLORS.outOfStock'),
      true,
      'StockDistributionChart must use CHART_COLORS for inStock, lowStock, and outOfStock'
    );
    assert.strictEqual(
      content.includes('innerRadius="65%"') && content.includes('outerRadius="85%"'),
      true,
      'StockDistributionChart must configure Donut aspect with innerRadius 65% and outerRadius 85%'
    );
  });

  it('should verify CustomChartTooltip provides glassmorphic styling and number formatting', () => {
    const content = readFileSync(customTooltipPath, 'utf8');
    assert.strictEqual(
      content.includes('backdropFilter') || content.includes('rgba(255, 255, 255'),
      true,
      'CustomChartTooltip must have elevated/glassmorphic styling'
    );
    assert.strictEqual(
      content.includes('toLocaleString'),
      true,
      'CustomChartTooltip must format numbers using toLocaleString'
    );
  });

  it('should verify OverviewTab has completely eliminated hand-rolled CSS bars and conic-gradient', () => {
    const content = readFileSync(overviewTabPath, 'utf8');
    assert.strictEqual(
      content.includes('conic-gradient'),
      false,
      'OverviewTab must NOT use hand-rolled conic-gradient'
    );
    assert.strictEqual(
      content.includes('className="bars"') || content.includes('className="bar bar-in"'),
      false,
      'OverviewTab must NOT use hand-rolled CSS bars'
    );
    assert.strictEqual(
      content.includes('MovementTrendChart') && content.includes('StockDistributionChart'),
      true,
      'OverviewTab must use MovementTrendChart and StockDistributionChart'
    );
  });

  it('should verify MovementChart has completely eliminated hand-rolled CSS bars', () => {
    const content = readFileSync(movementChartPath, 'utf8');
    assert.strictEqual(
      content.includes('className="bars"') || content.includes('className="bar bar-in"'),
      false,
      'MovementChart must NOT use hand-rolled CSS bars'
    );
    assert.strictEqual(
      content.includes('MovementTrendChart'),
      true,
      'MovementChart must use MovementTrendChart'
    );
  });

  it('should verify design tokens define required chart and theme color values', () => {
    const tokensContent = readFileSync(tokensPath, 'utf8');
    assert.strictEqual(
      tokensContent.includes('CHART_COLORS = {'),
      true,
      'tokens.ts must define CHART_COLORS'
    );
    assert.strictEqual(
      tokensContent.includes('inbound:') &&
        tokensContent.includes('outbound:') &&
        tokensContent.includes('inStock:') &&
        tokensContent.includes('lowStock:') &&
        tokensContent.includes('outOfStock:'),
      true,
      'CHART_COLORS must define inbound, outbound, inStock, lowStock, outOfStock tokens'
    );
  });
});
