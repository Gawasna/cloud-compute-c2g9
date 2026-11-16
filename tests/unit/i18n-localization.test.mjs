import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import vi from '../../src/lib/i18n/dictionaries/vi.ts';
import en from '../../src/lib/i18n/dictionaries/en.ts';
import {
  formatNumber,
  formatCurrency,
  formatDate,
  formatWeekday,
  interpolate,
} from '../../src/lib/i18n/formatters.ts';

describe('Unit: Comprehensive i18n Localization Architecture', () => {
  const cwd = process.cwd();

  it('should verify all core i18n module files exist', () => {
    const requiredFiles = [
      'src/lib/i18n/types.ts',
      'src/lib/i18n/dictionaries/vi.ts',
      'src/lib/i18n/dictionaries/en.ts',
      'src/lib/i18n/formatters.ts',
      'src/lib/i18n/context.tsx',
      'src/lib/i18n/index.ts',
    ];

    for (const f of requiredFiles) {
      assert.strictEqual(
        existsSync(resolve(cwd, f)),
        true,
        `Expected i18n file to exist: ${f}`
      );
    }
  });

  it('should verify vi and en dictionaries have parity in keys and non-empty strings', () => {
    const checkParity = (viObj, enObj, prefix = '') => {
      const viKeys = Object.keys(viObj);
      const enKeys = Object.keys(enObj);

      assert.deepStrictEqual(
        viKeys.sort(),
        enKeys.sort(),
        `Dictionary key mismatch at ${prefix || 'root'}`
      );

      for (const k of viKeys) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof viObj[k] === 'object' && viObj[k] !== null) {
          assert.strictEqual(
            typeof enObj[k],
            'object',
            `Expected object at ${fullKey}`
          );
          checkParity(viObj[k], enObj[k], fullKey);
        } else {
          assert.strictEqual(
            typeof viObj[k],
            'string',
            `Expected string at vi.${fullKey}`
          );
          assert.strictEqual(
            typeof enObj[k],
            'string',
            `Expected string at en.${fullKey}`
          );
          assert.ok(
            viObj[k].length > 0,
            `Expected non-empty string at vi.${fullKey}`
          );
          assert.ok(
            enObj[k].length > 0,
            `Expected non-empty string at en.${fullKey}`
          );
        }
      }
    };

    checkParity(vi, en);
  });

  it('should verify formatNumber behaves deterministically across locales', () => {
    const num = 1234567;
    const viFormatted = formatNumber(num, 'vi');
    const enFormatted = formatNumber(num, 'en');

    // Vietnamese format uses '.' as thousand separator
    assert.strictEqual(viFormatted, '1.234.567');
    // English format uses ',' as thousand separator
    assert.strictEqual(enFormatted, '1,234,567');
  });

  it('should verify formatCurrency produces VND suffix notation', () => {
    const amount = 500000;
    const viCurrency = formatCurrency(amount, 'vi');
    const enCurrency = formatCurrency(amount, 'en');

    assert.ok(viCurrency.includes('₫'), 'Vietnamese currency must include ₫');
    assert.ok(enCurrency.includes('₫'), 'English currency must include ₫');
  });

  it('should verify formatDate and formatWeekday handle valid and invalid dates', () => {
    const validDate = '2026-11-15T12:00:00Z';
    const viDate = formatDate(validDate, 'vi');
    const enDate = formatDate(validDate, 'en');

    assert.ok(viDate.length > 0, 'Should format valid date in VI');
    assert.ok(enDate.length > 0, 'Should format valid date in EN');

    assert.strictEqual(formatDate('invalid-date', 'vi'), '—');
    assert.strictEqual(formatDate('invalid-date', 'en'), '—');

    const viDay = formatWeekday(validDate, 'vi');
    const enDay = formatWeekday(validDate, 'en');
    assert.ok(viDay.length > 0, 'Should format weekday in VI');
    assert.ok(enDay.length > 0, 'Should format weekday in EN');
  });

  it('should verify interpolate replaces parameters accurately', () => {
    const template = 'Showing {page} of {total} items for {user}';
    const result = interpolate(template, { page: 1, total: 10, user: 'Admin' });
    assert.strictEqual(result, 'Showing 1 of 10 items for Admin');
  });

  it('should verify StockBadge source file contains bilingual status mapping', () => {
    const badgeContent = readFileSync(
      resolve(cwd, 'src/components/ui/StockBadge.tsx'),
      'utf8'
    );
    assert.strictEqual(
      badgeContent.includes("'Hết hàng'"),
      true,
      "StockBadge must support Vietnamese 'Hết hàng'"
    );
    assert.strictEqual(
      badgeContent.includes("'Out of Stock'"),
      true,
      "StockBadge must support English 'Out of Stock'"
    );
    assert.strictEqual(
      badgeContent.includes("'Sắp hết'"),
      true,
      "StockBadge must support Vietnamese 'Sắp hết'"
    );
    assert.strictEqual(
      badgeContent.includes("'Low Stock'"),
      true,
      "StockBadge must support English 'Low Stock'"
    );
    assert.strictEqual(
      badgeContent.includes("'Còn hàng'"),
      true,
      "StockBadge must support Vietnamese 'Còn hàng'"
    );
    assert.strictEqual(
      badgeContent.includes("'In Stock'"),
      true,
      "StockBadge must support English 'In Stock'"
    );
  });

  it('should verify UI components integrate useI18n and LanguageSwitcher', () => {
    const topbarContent = readFileSync(resolve(cwd, 'src/components/layout/Topbar.tsx'), 'utf8');
    assert.strictEqual(
      topbarContent.includes('LanguageSwitcher'),
      true,
      'Topbar must render LanguageSwitcher'
    );
    assert.strictEqual(
      topbarContent.includes('useI18n'),
      true,
      'Topbar must use useI18n hook'
    );

    const loginContent = readFileSync(resolve(cwd, 'src/app/login/page.tsx'), 'utf8');
    assert.strictEqual(
      loginContent.includes('LanguageSwitcher'),
      true,
      'LoginPage must render LanguageSwitcher'
    );
    assert.strictEqual(
      loginContent.includes('useI18n'),
      true,
      'LoginPage must use useI18n hook'
    );

    const appShellContent = readFileSync(resolve(cwd, 'src/components/layout/AppShell.tsx'), 'utf8');
    assert.strictEqual(
      appShellContent.includes('I18nProvider'),
      true,
      'AppShell must provide I18nProvider context'
    );
  });

  it('should verify I18nProvider maintains hydration safety and syncs post-mount', () => {
    const contextContent = readFileSync(resolve(cwd, 'src/lib/i18n/context.tsx'), 'utf8');
    assert.strictEqual(
      contextContent.includes('useState<Locale>(initialLocale || DEFAULT_LOCALE)'),
      true,
      'I18nProvider must initialize state with initialLocale || DEFAULT_LOCALE for hydration parity'
    );
    assert.strictEqual(
      contextContent.includes('isMounted'),
      true,
      'I18nProvider must provide isMounted state flag'
    );
    assert.strictEqual(
      contextContent.includes('useEffect(() => {'),
      true,
      'I18nProvider must synchronize client locale in useEffect post-hydration'
    );
  });
});
