import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Unit: CloudStock SVG Icon System & Unicode Elimination (TASK-20261115-0003)', () => {
  const cwd = process.cwd();
  const iconsPath = resolve(cwd, 'src/components/ui/Icons.tsx');
  const tokensPath = resolve(cwd, 'src/lib/theme/tokens.ts');
  const sidebarPath = resolve(cwd, 'src/components/layout/Sidebar.tsx');
  const topbarPath = resolve(cwd, 'src/components/layout/Topbar.tsx');
  const overviewPath = resolve(cwd, 'src/components/dashboard/OverviewTab.tsx');
  const productsPath = resolve(cwd, 'src/components/dashboard/ProductsTab.tsx');
  const categoriesPath = resolve(cwd, 'src/components/dashboard/CategoriesTab.tsx');
  const stockMovementPath = resolve(cwd, 'src/components/dashboard/StockMovementTab.tsx');
  const modalPath = resolve(cwd, 'src/components/ui/Modal.tsx');
  const toastPath = resolve(cwd, 'src/components/ui/Toast.tsx');
  const emptyStatePath = resolve(cwd, 'src/components/ui/EmptyState.tsx');
  const loginPagePath = resolve(cwd, 'src/app/login/page.tsx');
  const globalsCssPath = resolve(cwd, 'src/app/globals.css');

  it('should verify Icons.tsx and tokens.ts exist', () => {
    assert.strictEqual(existsSync(iconsPath), true, 'Icons.tsx must exist');
    assert.strictEqual(existsSync(tokensPath), true, 'tokens.ts must exist');
  });

  it('should verify tokens.ts contains ICON_DEFAULTS with size=18 and strokeWidth=2', () => {
    const content = readFileSync(tokensPath, 'utf8');
    assert.strictEqual(content.includes('ICON_DEFAULTS'), true);
    assert.strictEqual(content.includes('size: 18'), true);
    assert.strictEqual(content.includes('strokeWidth: 2'), true);
  });

  it('should verify Icons.tsx exports all required Navigation, Action, Status, and Category icons', () => {
    const content = readFileSync(iconsPath, 'utf8');
    const requiredExports = [
      'LayoutDashboardIcon',
      'PackageIcon',
      'ArchiveIcon',
      'BoxesIcon',
      'ArrowLeftRightIcon',
      'HistoryIcon',
      'FileBarChartIcon',
      'UsersIcon',
      'SearchIcon',
      'PlusIcon',
      'EditIcon',
      'Trash2Icon',
      'RotateCcwIcon',
      'DownloadIcon',
      'CloseIcon',
      'ExternalLinkIcon',
      'CheckCircle2Icon',
      'AlertTriangleIcon',
      'BanIcon',
      'BellIcon',
      'FlagIcon',
      'TvIcon',
      'HomeIcon',
      'ShirtIcon',
      'FolderIcon',
      'getCategoryIconComponent',
      'renderCategoryIcon',
    ];

    for (const exp of requiredExports) {
      assert.strictEqual(
        content.includes(exp),
        true,
        `Icons.tsx must export ${exp}`
      );
    }
  });

  it('should verify Icons.tsx applies default aria-hidden="true" and ICON_DEFAULTS', () => {
    const content = readFileSync(iconsPath, 'utf8');
    assert.strictEqual(content.includes('ICON_DEFAULTS.size'), true);
    assert.strictEqual(content.includes('ICON_DEFAULTS.strokeWidth'), true);
    assert.strictEqual(content.includes("'aria-hidden': ariaHidden = true"), true);
  });

  it('should verify 100% elimination of mock unicode icons in Sidebar and Topbar', () => {
    const sidebar = readFileSync(sidebarPath, 'utf8');
    const topbar = readFileSync(topbarPath, 'utf8');

    const forbidden = ['◫', '◈', '▤', '▦', '⇅', '☷', '▥', '♙', '♧'];
    for (const char of forbidden) {
      assert.strictEqual(
        sidebar.includes(char),
        false,
        `Sidebar must not contain unicode mock icon: ${char}`
      );
      assert.strictEqual(
        topbar.includes(char),
        false,
        `Topbar must not contain unicode mock icon: ${char}`
      );
    }

    assert.strictEqual(sidebar.includes('PAGE_ICONS'), true);
    assert.strictEqual(topbar.includes('BellIcon'), true);
  });

  it('should verify 100% elimination of mock unicode icons in Dashboard Tabs, Modals, and Login', () => {
    const targetFiles = [
      { name: 'OverviewTab', content: readFileSync(overviewPath, 'utf8') },
      { name: 'ProductsTab', content: readFileSync(productsPath, 'utf8') },
      { name: 'CategoriesTab', content: readFileSync(categoriesPath, 'utf8') },
      { name: 'StockMovementTab', content: readFileSync(stockMovementPath, 'utf8') },
      { name: 'Modal', content: readFileSync(modalPath, 'utf8') },
      { name: 'Toast', content: readFileSync(toastPath, 'utf8') },
      { name: 'EmptyState', content: readFileSync(emptyStatePath, 'utf8') },
      { name: 'LoginPage', content: readFileSync(loginPagePath, 'utf8') },
    ];

    const forbidden = ['▥', '◈', '▤', '▦', '⇅', '☷', '♙', '♧', '⌕', '＋', '✓', '✕', '↗', '⌁', '⚑', '⊘', '▣'];

    for (const { name, content } of targetFiles) {
      for (const char of forbidden) {
        assert.strictEqual(
          content.includes(char),
          false,
          `${name} must not contain unicode mock icon: ${char}`
        );
      }
    }
  });

  it('should verify globals.css contains optical balance & alignment rules for icons', () => {
    const css = readFileSync(globalsCssPath, 'utf8');
    const requiredRules = [
      '.nav-icon',
      '.brand-icon',
      '.metric-icon',
      '.item-avatar',
      '.bell',
      '.close',
      '.toast',
      '.category-symbol',
      '.search-input-wrapper',
    ];

    for (const rule of requiredRules) {
      assert.strictEqual(
        css.includes(rule),
        true,
        `globals.css must contain styling for ${rule}`
      );
    }
  });
});
