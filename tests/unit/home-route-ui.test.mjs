import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Unit: CloudStock Home Route UI & Modular Architecture', () => {
  const layoutFiles = [
    'src/components/layout/index.ts',
    'src/components/layout/AppShell.tsx',
    'src/components/layout/Sidebar.tsx',
    'src/components/layout/Topbar.tsx',
  ];

  const uiFiles = [
    'src/components/ui/index.ts',
    'src/components/ui/MetricCard.tsx',
    'src/components/ui/StockBadge.tsx',
    'src/components/ui/Skeleton.tsx',
    'src/components/ui/EmptyState.tsx',
    'src/components/ui/Toast.tsx',
    'src/components/ui/Modal.tsx',
  ];

  const dashboardFiles = [
    'src/components/dashboard/types.ts',
    'src/components/dashboard/OverviewTab.tsx',
    'src/components/dashboard/ProductsTab.tsx',
    'src/components/dashboard/CategoriesTab.tsx',
    'src/components/dashboard/StockMovementTab.tsx',
    'src/components/dashboard/TransactionsTab.tsx',
    'src/components/dashboard/ReportsTab.tsx',
    'src/components/dashboard/ProductModal.tsx',
    'src/components/dashboard/StockModal.tsx',
  ];

  it('should verify all required layout and UI component files exist', () => {
    for (const file of [...layoutFiles, ...uiFiles, ...dashboardFiles]) {
      const fullPath = resolve(process.cwd(), file);
      assert.strictEqual(
        existsSync(fullPath),
        true,
        `Expected component file to exist: ${file}`
      );
    }
  });

  it('should enforce pure presentation boundaries in src/components/ui (no server or features imports)', () => {
    for (const file of uiFiles) {
      const fullPath = resolve(process.cwd(), file);
      const content = readFileSync(fullPath, 'utf8');
      assert.strictEqual(
        content.includes('@/server'),
        false,
        `UI file ${file} must not import from '@/server'`
      );
      assert.strictEqual(
        content.includes('@/features'),
        false,
        `UI file ${file} must not import from '@/features'`
      );
    }
  });

  it('should verify role navigation permissions matrix', () => {
    const sidebarContent = readFileSync(
      resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'),
      'utf8'
    );

    // Admin has 7 tabs
    assert.strictEqual(
      sidebarContent.includes('admin: ['),
      true,
      'Sidebar must define admin permissions'
    );
    // Staff has 4 tabs
    assert.strictEqual(
      sidebarContent.includes("staff: ['dashboard', 'products', 'stock', 'transactions']"),
      true,
      'Sidebar must define staff permissions correctly'
    );
    // Viewer has 2 tabs
    assert.strictEqual(
      sidebarContent.includes("viewer: ['dashboard', 'reports']"),
      true,
      'Sidebar must define viewer permissions correctly'
    );
  });

  it('should verify stock status determination logic in StockBadge', () => {
    const badgeContent = readFileSync(
      resolve(process.cwd(), 'src/components/ui/StockBadge.tsx'),
      'utf8'
    );

    assert.strictEqual(
      badgeContent.includes('stock === 0'),
      true,
      'StockBadge must identify zero stock'
    );
    assert.strictEqual(
      badgeContent.includes("'Hết hàng'"),
      true,
      "StockBadge must label zero stock as 'Hết hàng'"
    );
    assert.strictEqual(
      badgeContent.includes('stock < minimum'),
      true,
      'StockBadge must identify low stock below minimum threshold'
    );
    assert.strictEqual(
      badgeContent.includes("'Sắp hết'"),
      true,
      "StockBadge must label below-minimum stock as 'Sắp hết'"
    );
    assert.strictEqual(
      badgeContent.includes("'Còn hàng'"),
      true,
      "StockBadge must label normal stock as 'Còn hàng'"
    );
  });

  it('should verify CSV export logic includes UTF-8 BOM for Vietnamese character encoding', () => {
    const reportsContent = readFileSync(
      resolve(process.cwd(), 'src/components/dashboard/ReportsTab.tsx'),
      'utf8'
    );

    assert.strictEqual(
      reportsContent.includes("'\\uFEFF'"),
      true,
      'ReportsTab CSV export must prepend UTF-8 BOM (\\uFEFF) for Vietnamese Excel compatibility'
    );
  });
});
