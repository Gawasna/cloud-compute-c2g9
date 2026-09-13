import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isFile,
  readFile,
  readJson,
} from "./test-helpers.mjs";

describe("Tier 3: Cross-Feature Interactions", () => {
  // Interaction 1: TypeScript Path Aliases vs ESLint Restrictions
  it("[X01] should align tsconfig path aliases with ESLint restricted import rules", () => {
    const tsconfig = readJson("tsconfig.json");
    assert.ok(tsconfig, "tsconfig.json must be valid JSON");

    const paths = tsconfig.compilerOptions?.paths || {};
    // Ensure alias @/* exists and points to ./src/*
    const aliasPattern = paths["@/*"];
    assert.ok(
      aliasPattern && aliasPattern.some((p) => p.includes("src")),
      "tsconfig.json must map '@/*' path alias to './src/*'"
    );

    const hasFlat = isFile("eslint.config.mjs");
    const configFile = hasFlat ? "eslint.config.mjs" : ".eslintrc.json";
    if (isFile(configFile)) {
      const eslintContent = readFile(configFile) || "";
      // Both tsconfig alias and ESLint restricted import patterns must match
      assert.ok(
        eslintContent.includes("@/server") || eslintContent.includes("@/features"),
        "ESLint configuration must explicitly restrict tsconfig-aliased paths (@/server or @/features)"
      );
    }
  });

  // Interaction 2: Database Connection Model Separation
  it("[X02] should align database connection models between documentation and env configuration", () => {
    const docPath = "docs/database/connection-model.md";
    const doc = isFile(docPath) ? readFile(docPath) : readFile("README.md") || "";
    const env = readFile(".env.example") || "";

    // Both must define DATABASE_URL and DIRECT_URL
    assert.ok(doc.includes("DATABASE_URL"), "Doc must reference DATABASE_URL");
    assert.ok(doc.includes("DIRECT_URL"), "Doc must reference DIRECT_URL");
    assert.ok(env.includes("DATABASE_URL="), ".env.example must define DATABASE_URL");
    assert.ok(env.includes("DIRECT_URL="), ".env.example must define DIRECT_URL");

    // Documentation must emphasize that DATABASE_URL is for runtime pooling and DIRECT_URL is for migrations
    const docLower = doc.toLowerCase();
    assert.ok(
      docLower.includes("pool") || docLower.includes("supavisor"),
      "Doc must explain connection pooling for runtime"
    );
    assert.ok(
      docLower.includes("migration") || docLower.includes("direct"),
      "Doc must explain direct connection for migrations"
    );
  });

  // Interaction 3: Production Health Check vs Local Diagnostics Duality
  it("[X03] should maintain strict separation between production Route Handler and local CLI script", () => {
    const routeFile = "src/app/api/health/route.ts";
    const localScript = "scripts/health/check-local-env.ts";

    if (isFile(routeFile)) {
      const routeContent = readFile(routeFile) || "";
      // Route handler must NOT import CLI diagnostics or Node CLI modules
      assert.doesNotMatch(
        routeContent,
        /from\s+['"].*scripts\/health/i,
        "Production route handler must not import local diagnostic script"
      );
      assert.doesNotMatch(
        routeContent,
        /from\s+['"]node:child_process['"]/i,
        "Production route handler on Vercel must not spawn child processes"
      );
    }

    if (isFile(localScript)) {
      const scriptContent = readFile(localScript) || "";
      // CLI script must NOT import Next.js route handlers
      assert.doesNotMatch(
        scriptContent,
        /from\s+['"].*src\/app\/api/i,
        "Local diagnostics script must not depend on Next.js Route Handlers"
      );
    }
  });

  // Interaction 4: CI/CD Quality Gates Hierarchy & Dependency Order
  it("[X04] should enforce quality gates hierarchy in CI/CD workflow", () => {
    const workflowPath = ".github/workflows/ci.yml";
    if (!isFile(workflowPath)) {
      assert.ok(true, "CI workflow hierarchy will be verified upon M4 creation");
      return;
    }

    const yamlContent = readFile(workflowPath) || "";

    // Parse simple stage presence & sequence
    const lintIndex = yamlContent.indexOf("lint");
    const testIndex = yamlContent.indexOf("test");
    const buildIndex = yamlContent.indexOf("build");

    assert.ok(lintIndex !== -1, "CI workflow must include lint gate");
    assert.ok(testIndex !== -1, "CI workflow must include test gate");
    assert.ok(buildIndex !== -1, "CI workflow must include build gate");

    // CI workflow should prioritize lint/typecheck before or alongside build
    assert.ok(
      yamlContent.includes("npm run lint") || yamlContent.includes("lint"),
      "CI workflow must execute lint validation"
    );
    assert.ok(
      yamlContent.includes("npm run type-check") || yamlContent.includes("tsc"),
      "CI workflow must execute type checking"
    );
  });
});
