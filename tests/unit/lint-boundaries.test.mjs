import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ESLint } from "eslint";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");

describe("Unit: Architectural Lint Boundaries & Server Protection", () => {
  const eslint = new ESLint({
    cwd: ROOT_DIR,
  });

  it("should reject UI component importing from @/server", async () => {
    const code = [
      'import { db } from "@/server/services";',
      'export const TestButton = () => null;',
    ].join("\n");

    const results = await eslint.lintText(code, {
      filePath: path.join(ROOT_DIR, "src/components/ui/test-violation.tsx"),
    });

    assert.strictEqual(results.length, 1);
    assert.ok(results[0].errorCount > 0, "Should report at least one error");
    const restrictedImportErr = results[0].messages.find(
      (m) => m.ruleId === "no-restricted-imports"
    );
    assert.ok(restrictedImportErr, "Should trigger no-restricted-imports rule");
    assert.ok(
      restrictedImportErr.message.includes("UI purity violation"),
      `Expected UI purity violation message, got: ${restrictedImportErr.message}`
    );
  });

  it("should reject UI component importing from @/features", async () => {
    const code = [
      'import { authFeature } from "@/features/auth";',
      'export const TestButton = () => null;',
    ].join("\n");

    const results = await eslint.lintText(code, {
      filePath: path.join(ROOT_DIR, "src/components/ui/test-violation.tsx"),
    });

    assert.strictEqual(results.length, 1);
    assert.ok(results[0].errorCount > 0, "Should report at least one error");
    const restrictedImportErr = results[0].messages.find(
      (m) => m.ruleId === "no-restricted-imports"
    );
    assert.ok(restrictedImportErr, "Should trigger no-restricted-imports rule");
    assert.ok(
      restrictedImportErr.message.includes("UI purity violation"),
      `Expected UI purity violation message, got: ${restrictedImportErr.message}`
    );
  });

  it("should reject cross-feature sibling import via @/features", async () => {
    const code = [
      'import { billingService } from "@/features/billing";',
      'export const authHandler = () => null;',
    ].join("\n");

    const results = await eslint.lintText(code, {
      filePath: path.join(ROOT_DIR, "src/features/auth/handler.ts"),
    });

    assert.strictEqual(results.length, 1);
    assert.ok(results[0].errorCount > 0, "Should report at least one error");
    const restrictedImportErr = results[0].messages.find(
      (m) => m.ruleId === "no-restricted-imports"
    );
    assert.ok(restrictedImportErr, "Should trigger no-restricted-imports rule");
    assert.ok(
      restrictedImportErr.message.includes("Feature isolation violation"),
      `Expected Feature isolation violation message, got: ${restrictedImportErr.message}`
    );
  });

  it("should reject deep relative imports escaping feature boundaries", async () => {
    const code = [
      'import { billingHelper } from "../../billing/helper";',
      'export const authHandler = () => null;',
    ].join("\n");

    const results = await eslint.lintText(code, {
      filePath: path.join(ROOT_DIR, "src/features/auth/components/handler.ts"),
    });

    assert.strictEqual(results.length, 1);
    assert.ok(results[0].errorCount > 0, "Should report at least one error");
    const restrictedImportErr = results[0].messages.find(
      (m) => m.ruleId === "no-restricted-imports"
    );
    assert.ok(restrictedImportErr, "Should trigger no-restricted-imports rule");
    assert.ok(
      restrictedImportErr.message.includes("Feature isolation violation"),
      `Expected Feature isolation violation message, got: ${restrictedImportErr.message}`
    );
  });

  it("should allow valid imports in UI components", async () => {
    const code = [
      'import type { ReactNode } from "react";',
      'export interface Props { children: ReactNode; }',
      'export const Component = ({ children }: Props) => null;',
    ].join("\n");

    const results = await eslint.lintText(code, {
      filePath: path.join(ROOT_DIR, "src/components/ui/valid-button.tsx"),
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].errorCount, 0, "Valid UI component should produce 0 errors");
  });

  it("should verify line 1 server-only imports across all designated server modules", () => {
    const serverFiles = [
      "src/server/services/index.ts",
      "src/server/repositories/index.ts",
      "src/lib/db/index.ts",
    ];

    for (const relPath of serverFiles) {
      const fullPath = path.join(ROOT_DIR, relPath);
      assert.ok(fs.existsSync(fullPath), `Server module ${relPath} must exist`);
      const content = fs.readFileSync(fullPath, "utf8");
      const firstLine = content.split(/\r?\n/)[0].trim();
      assert.match(
        firstLine,
        /^import\s+['"]server-only['"];?$/,
        `File ${relPath} must begin with import 'server-only'`
      );
    }
  });
});
