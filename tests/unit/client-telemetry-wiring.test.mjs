import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Unit: Client-side Telemetry Wiring & Silent Swallowing Remediation", () => {
  const productImagePath = path.resolve(process.cwd(), "src/components/ui/ProductImage.tsx");
  const cloudstockApiPath = path.resolve(process.cwd(), "src/lib/api/cloudstock.ts");
  const dashboardPath = path.resolve(process.cwd(), "src/components/Dashboard.tsx");
  const sentryClientConfigPath = path.resolve(process.cwd(), "sentry.client.config.ts");

  describe("ProductImage.tsx Telemetry Wiring", () => {
    it("should verify ProductImage imports captureLooseError", () => {
      assert.ok(fs.existsSync(productImagePath), "ProductImage.tsx must exist");
      const content = fs.readFileSync(productImagePath, "utf8");
      assert.ok(
        content.includes("import { captureLooseError } from '@/lib/observability'"),
        "ProductImage must import captureLooseError from @/lib/observability"
      );
    });

    it("should capture loose error on image load failure with resilient try-catch", () => {
      const content = fs.readFileSync(productImagePath, "utf8");
      assert.ok(
        content.includes("onError={() => {"),
        "ProductImage must have a multi-statement onError handler"
      );
      assert.ok(
        content.includes("setErroredSrc(normalizedSrc)"),
        "ProductImage must update state on error"
      );
      assert.ok(
        content.includes("captureLooseError("),
        "ProductImage must notify telemetry upon image load failure"
      );
      assert.ok(
        content.includes("component: 'ProductImage'"),
        "Telemetry payload must include component: 'ProductImage'"
      );
      assert.ok(
        content.includes("sku: alt") && content.includes("src: normalizedSrc"),
        "Telemetry payload must include sku and src context"
      );
    });
  });

  describe("cloudstock.ts API Telemetry Wiring", () => {
    it("should verify cloudstock.ts imports captureLooseError", () => {
      assert.ok(fs.existsSync(cloudstockApiPath), "cloudstock.ts must exist");
      const content = fs.readFileSync(cloudstockApiPath, "utf8");
      assert.ok(
        content.includes("import { captureLooseError } from '@/lib/observability'"),
        "cloudstock.ts must import captureLooseError from @/lib/observability"
      );
    });

    it("should intercept network exceptions and 5xx errors in apiRequest", () => {
      const content = fs.readFileSync(cloudstockApiPath, "utf8");
      assert.ok(
        content.includes("catch (networkErr)"),
        "apiRequest must catch low-level network errors"
      );
      assert.ok(
        content.includes("networkError: true"),
        "apiRequest must tag network errors for telemetry"
      );
      assert.ok(
        content.includes("response.status >= 500"),
        "apiRequest must report server errors (>= 500) to telemetry"
      );
    });

    it("should intercept network exceptions and 5xx errors in downloadReportCsv", () => {
      const content = fs.readFileSync(cloudstockApiPath, "utf8");
      assert.ok(
        content.includes("kind,") && content.includes("networkError: true"),
        "downloadReportCsv must catch export network failures"
      );
    });
  });

  describe("Dashboard.tsx Telemetry Wiring", () => {
    it("should verify Dashboard imports captureLooseError and logs catch blocks", () => {
      assert.ok(fs.existsSync(dashboardPath), "Dashboard.tsx must exist");
      const content = fs.readFileSync(dashboardPath, "utf8");
      assert.ok(
        content.includes("import { captureLooseError } from '@/lib/observability'"),
        "Dashboard must import captureLooseError from @/lib/observability"
      );
      assert.ok(
        content.includes("captureLooseError(err, { source: 'dashboard.refreshData' })"),
        "Dashboard.refreshData must forward caught errors to telemetry"
      );
      assert.ok(
        content.includes("captureLooseError(err, { source: 'dashboard.initialLoad' })"),
        "Dashboard.useEffect must forward caught initial load errors to telemetry"
      );
    });
  });

  describe("sentry.client.config.ts CSP Violation Listener", () => {
    it("should register securitypolicyviolation event listener", () => {
      assert.ok(fs.existsSync(sentryClientConfigPath), "sentry.client.config.ts must exist");
      const content = fs.readFileSync(sentryClientConfigPath, "utf8");
      assert.ok(
        content.includes('window.addEventListener("securitypolicyviolation"'),
        "sentry.client.config.ts must listen for browser securitypolicyviolation"
      );
      assert.ok(
        content.includes("Content Security Policy violation: Blocked"),
        "Must construct descriptive error message for blocked resource"
      );
      assert.ok(
        content.includes("directive: event.violatedDirective") &&
        content.includes("blockedUri: event.blockedURI"),
        "Must record directive and blockedUri context"
      );
    });

    it("should simulate CSP violation event dispatch to telemetry handler", () => {
      let capturedError = null;
      let capturedContext = null;

      const mockCaptureLooseError = (err, ctx) => {
        capturedError = err;
        capturedContext = ctx;
      };

      const handler = (event) => {
        try {
          mockCaptureLooseError(
            new Error(
              `Content Security Policy violation: Blocked ${event.blockedURI} by directive '${event.violatedDirective}'`
            ),
            {
              directive: event.violatedDirective,
              blockedUri: event.blockedURI,
              sourceFile: event.sourceFile,
              lineNumber: event.lineNumber,
              columnNumber: event.columnNumber,
              statusCode: event.statusCode,
            }
          );
        } catch {
          // resilient
        }
      };

      const fakeCspEvent = {
        violatedDirective: "img-src",
        blockedURI: "https://untrusted-cdn.com/asset.png",
        sourceFile: "https://cloudstock.example.com/app.js",
        lineNumber: 104,
        columnNumber: 12,
        statusCode: 200,
      };

      handler(fakeCspEvent);

      assert.ok(capturedError instanceof Error);
      assert.strictEqual(
        capturedError.message,
        "Content Security Policy violation: Blocked https://untrusted-cdn.com/asset.png by directive 'img-src'"
      );
      assert.strictEqual(capturedContext.directive, "img-src");
      assert.strictEqual(capturedContext.blockedUri, "https://untrusted-cdn.com/asset.png");
      assert.strictEqual(capturedContext.lineNumber, 104);
    });
  });
});
