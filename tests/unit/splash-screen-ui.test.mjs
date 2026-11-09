import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Unit: CloudStock Brand Splash Screen & Preview Architecture', () => {
  const cwd = process.cwd();
  const splashComponentPath = resolve(cwd, 'src/components/ui/BrandSplashScreen.tsx');
  const uiIndexPath = resolve(cwd, 'src/components/ui/index.ts');
  const authGatePath = resolve(cwd, 'src/components/AuthGate.tsx');
  const homePagePath = resolve(cwd, 'src/app/page.tsx');
  const openGraphPath = resolve(cwd, 'src/app/opengraph-image.tsx');
  const globalsCssPath = resolve(cwd, 'src/app/globals.css');

  it('should verify BrandSplashScreen component file exists', () => {
    assert.strictEqual(
      existsSync(splashComponentPath),
      true,
      'BrandSplashScreen.tsx must exist in src/components/ui'
    );
  });

  it('should verify BrandSplashScreen is pure presentation without server/features imports', () => {
    const content = readFileSync(splashComponentPath, 'utf8');
    assert.strictEqual(
      content.includes('@/server'),
      false,
      'BrandSplashScreen must not import from @/server'
    );
    assert.strictEqual(
      content.includes('@/features'),
      false,
      'BrandSplashScreen must not import from @/features'
    );
    assert.strictEqual(
      content.includes('role="status"'),
      true,
      'BrandSplashScreen must include role="status" for accessibility'
    );
    assert.strictEqual(
      content.includes('aria-live="polite"'),
      true,
      'BrandSplashScreen must include aria-live="polite"'
    );
  });

  it('should verify BrandSplashScreen is exported from src/components/ui/index.ts', () => {
    const content = readFileSync(uiIndexPath, 'utf8');
    assert.strictEqual(
      content.includes("export { default as BrandSplashScreen } from './BrandSplashScreen';"),
      true,
      'BrandSplashScreen must be exported from ui/index.ts'
    );
  });

  it('should verify AuthGate uses BrandSplashScreen for loading state', () => {
    const content = readFileSync(authGatePath, 'utf8');
    assert.strictEqual(
      content.includes('<BrandSplashScreen />'),
      true,
      'AuthGate must render <BrandSplashScreen /> when identity is null'
    );
    assert.strictEqual(
      content.includes('Đang xác minh phiên đăng nhập và vai trò…'),
      false,
      'AuthGate must not render raw inline loading card text directly'
    );
  });

  it('should verify Home route (/) performs server-side cookie guard and redirect', () => {
    const content = readFileSync(homePagePath, 'utf8');
    assert.strictEqual(
      content.includes('cookies()'),
      true,
      'src/app/page.tsx must read cookies on the server'
    );
    assert.strictEqual(
      content.includes('redirect('),
      true,
      'src/app/page.tsx must perform server-side redirect'
    );
    assert.strictEqual(
      content.includes('ACCESS_COOKIE'),
      true,
      'src/app/page.tsx must check ACCESS_COOKIE'
    );
    assert.strictEqual(
      content.includes('<BrandSplashScreen'),
      true,
      'src/app/page.tsx Suspense fallback must use BrandSplashScreen'
    );
  });

  it('should verify Open Graph image generator exists with 1200x630 dimensions', () => {
    assert.strictEqual(
      existsSync(openGraphPath),
      true,
      'src/app/opengraph-image.tsx must exist'
    );
    const content = readFileSync(openGraphPath, 'utf8');
    assert.strictEqual(
      content.includes('width: 1200'),
      true,
      'Open Graph image width must be 1200'
    );
    assert.strictEqual(
      content.includes('height: 630'),
      true,
      'Open Graph image height must be 630'
    );
    assert.strictEqual(
      content.includes("runtime = 'edge'"),
      true,
      'Open Graph image should specify edge runtime'
    );
  });

  it('should verify globals.css defines splash screen animations and styles', () => {
    const content = readFileSync(globalsCssPath, 'utf8');
    assert.strictEqual(
      content.includes('.splash-container'),
      true,
      'globals.css must define .splash-container'
    );
    assert.strictEqual(
      content.includes('.splash-progress-bar'),
      true,
      'globals.css must define .splash-progress-bar'
    );
    assert.strictEqual(
      content.includes('@keyframes splash-pulse'),
      true,
      'globals.css must define splash-pulse animation'
    );
    assert.strictEqual(
      content.includes('@keyframes splash-indeterminate'),
      true,
      'globals.css must define splash-indeterminate animation'
    );
  });
});
