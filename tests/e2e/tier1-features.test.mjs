import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  exists,
  isDir,
  isFile,
  readFile,
  readJson,
  getFirstCodeLine,
  checkMilestone,
} from "./test-helpers.mjs";

describe("Tier 1: Core Feature Coverage (Features 1 - 18)", () => {
  // Feature 1: Repository & Deployment Layout (Milestone: M1)
  it("[F01][M1] should have required top-level directories", (t) => {
    if (checkMilestone(t, "M1")) return;

    const requiredDirs = [
      "src",
      "supabase",
      "scripts",
      "tests",
      ".github",
      "public",
    ];

    for (const dir of requiredDirs) {
      assert.ok(
        isDir(dir),
        `Required top-level directory '${dir}' must exist`
      );
    }
  });

  // Feature 2: Declarative Bootstrap & Manifest (Milestone: M1)
  it("[F02][M1] should have declarative configuration manifests initialized", (t) => {
    if (checkMilestone(t, "M1")) return;

    assert.ok(isFile("package.json"), "package.json must exist at root");
    assert.ok(isFile("tsconfig.json"), "tsconfig.json must exist at root");
    assert.ok(
      isFile("next.config.ts") || isFile("next.config.mjs") || isFile("next.config.js"),
      "next.config must exist at root"
    );
    assert.ok(isFile(".gitignore"), ".gitignore must exist at root");

    const pkg = readJson("package.json");
    assert.ok(pkg, "package.json must be valid JSON");
    assert.ok(pkg.dependencies?.next, "package.json must include next dependency");
    assert.ok(pkg.dependencies?.react, "package.json must include react dependency");
    assert.ok(
      pkg.dependencies?.["server-only"],
      "package.json must include server-only dependency"
    );
  });

  // Feature 3: Server-Only Boundary Enforcement (Milestone: M2)
  it("[F03][M2] should enforce 'server-only' import at line 1 in all server modules", (t) => {
    if (checkMilestone(t, "M2")) return;

    const serverFiles = [
      "src/server/services/index.ts",
      "src/server/repositories/index.ts",
      "src/lib/db/index.ts",
    ];

    for (const file of serverFiles) {
      assert.ok(isFile(file), `Server module '${file}' must exist`);
      const content = readFile(file);
      assert.ok(content, `File '${file}' must not be empty`);

      const firstLine = getFirstCodeLine(content);
      assert.match(
        firstLine || "",
        /^import\s+['"]server-only['"];?$/,
        `File '${file}' must have "import 'server-only'" as its first code statement`
      );
    }
  });

  // Feature 4: ESLint UI Purity Enforcement (Milestone: M2)
  it("[F04][M2] should configure ESLint to forbid UI components from importing server or features", (t) => {
    if (checkMilestone(t, "M2")) return;

    const hasFlatConfig = isFile("eslint.config.mjs") || isFile("eslint.config.js");
    const hasLegacyConfig = isFile(".eslintrc.json") || isFile(".eslintrc.js");
    assert.ok(
      hasFlatConfig || hasLegacyConfig,
      "ESLint configuration file must exist at root"
    );

    const configContent = readFile(hasFlatConfig ? "eslint.config.mjs" : ".eslintrc.json") || "";
    assert.ok(
      configContent.includes("no-restricted-imports"),
      "ESLint config must configure no-restricted-imports rule"
    );
    assert.ok(
      configContent.includes("src/components/ui") || configContent.includes("components/ui"),
      "ESLint config must target src/components/ui/ files"
    );
    assert.ok(
      configContent.includes("server") && configContent.includes("features"),
      "ESLint config must restrict server and features imports from UI"
    );
  });

  // Feature 5: ESLint Feature Isolation (Milestone: M2)
  it("[F05][M2] should configure ESLint to isolate features from sibling cross-imports", (t) => {
    if (checkMilestone(t, "M2")) return;

    const configFile = isFile("eslint.config.mjs") ? "eslint.config.mjs" : ".eslintrc.json";
    const configContent = readFile(configFile) || "";

    assert.ok(
      configContent.includes("src/features") || configContent.includes("features"),
      "ESLint config must define rules targeting src/features/"
    );
    assert.ok(
      configContent.includes("Feature isolation") || configContent.includes("@/features"),
      "ESLint config must enforce feature isolation"
    );
  });

  // Feature 6: Database Connection Model Separation (Milestone: M3)
  it("[F06][M3] should document separation between DATABASE_URL and DIRECT_URL", (t) => {
    if (checkMilestone(t, "M3")) return;

    const docPath = "docs/database/connection-model.md";
    const docContent = isFile(docPath) ? readFile(docPath) : readFile("README.md") || "";
    assert.ok(
      docContent.includes("DATABASE_URL"),
      "Database documentation must explain DATABASE_URL"
    );
    assert.ok(
      docContent.includes("DIRECT_URL"),
      "Database documentation must explain DIRECT_URL"
    );
    assert.ok(
      docContent.toLowerCase().includes("pool") || docContent.includes("Supavisor"),
      "Database documentation must mention connection pooler (Supavisor)"
    );
  });

  // Feature 7: Database Lifecycle Scaffolding (Milestone: M3)
  it("[F07][M3] should scaffold Supabase migrations and seed directory", (t) => {
    if (checkMilestone(t, "M3")) return;

    assert.ok(
      isDir("supabase/migrations"),
      "supabase/migrations directory must exist"
    );
    assert.ok(isDir("supabase/seed"), "supabase/seed directory must exist");
    assert.ok(
      isFile("supabase/seed/seed.sql"),
      "supabase/seed/seed.sql must exist"
    );
  });

  // Feature 8: ORM Neutrality Gate (Milestone: M3)
  it("[F08][M3] should enforce ORM neutrality without installing Prisma or Drizzle", (t) => {
    if (checkMilestone(t, "M3")) return;

    const pkg = readJson("package.json") || {};
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    const forbiddenOrmPackages = [
      "prisma",
      "@prisma/client",
      "drizzle-orm",
      "drizzle-kit",
      "typeorm",
      "mikro-orm",
    ];

    for (const ormPkg of forbiddenOrmPackages) {
      assert.strictEqual(
        ormPkg in allDeps,
        false,
        `ORM package '${ormPkg}' must not be installed in package.json`
      );
    }

    assert.strictEqual(exists("prisma"), false, "prisma directory must not exist");
    assert.strictEqual(
      exists("drizzle.config.ts"),
      false,
      "drizzle.config.ts must not exist"
    );
  });

  // Feature 9: Root Sentry Configuration (Milestone: M3)
  it("[F09][M3] should place Sentry config files strictly at project root", (t) => {
    if (checkMilestone(t, "M3")) return;

    const sentryFiles = [
      "sentry.client.config.ts",
      "sentry.server.config.ts",
      "sentry.edge.config.ts",
    ];

    for (const f of sentryFiles) {
      assert.ok(isFile(f), `Sentry root config '${f}' must exist at root`);
      assert.strictEqual(
        exists(`src/lib/observability/${f}`),
        false,
        `Sentry config '${f}' must NOT be placed in src/lib/observability/`
      );
    }
  });

  // Feature 10: Production Health Endpoint (Milestone: M3)
  it("[F10][M3] should have production health Route Handler at src/app/api/health/route.ts", (t) => {
    if (checkMilestone(t, "M3")) return;

    const routePath = "src/app/api/health/route.ts";
    assert.ok(isFile(routePath), `Production health route '${routePath}' must exist`);
    const content = readFile(routePath) || "";
    assert.ok(
      content.includes("export async function GET") || content.includes("export function GET"),
      "Health route handler must export GET function"
    );
    assert.ok(
      content.includes("status") && (content.includes("ok") || content.includes("healthy")),
      "Health route handler must return healthy status"
    );
  });

  // Feature 11: Local Health Diagnostic Tooling (Milestone: M3)
  it("[F11][M3] should isolate local diagnostic script under scripts/health/", (t) => {
    if (checkMilestone(t, "M3")) return;

    const scriptPath = "scripts/health/check-local-env.ts";
    assert.ok(
      isFile(scriptPath) || isFile("scripts/health/check-local-env.mjs"),
      "Local environment diagnostic script must exist under scripts/health/"
    );
  });

  // Feature 12: Environment Secret Classification (Milestone: M3)
  it("[F12][M3] should scaffold .env.example with browser-safe and server secret classification", (t) => {
    if (checkMilestone(t, "M3")) return;

    assert.ok(isFile(".env.example"), ".env.example must exist at project root");
    const envContent = readFile(".env.example") || "";

    assert.ok(
      envContent.includes("NEXT_PUBLIC_SUPABASE_URL"),
      ".env.example must define NEXT_PUBLIC_SUPABASE_URL"
    );
    assert.ok(
      envContent.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      ".env.example must define NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    assert.ok(
      envContent.includes("SUPABASE_SERVICE_ROLE_KEY"),
      ".env.example must define SUPABASE_SERVICE_ROLE_KEY"
    );
    assert.ok(
      envContent.includes("DATABASE_URL"),
      ".env.example must define DATABASE_URL"
    );
    assert.ok(
      envContent.includes("DIRECT_URL"),
      ".env.example must define DIRECT_URL"
    );
  });

  // Feature 13: CI/CD Delivery Pipeline Workflow (Milestone: M4)
  it("[F13][M4] should define CI/CD workflow at .github/workflows/ci.yml", (t) => {
    if (checkMilestone(t, "M4")) return;

    const workflowPath = ".github/workflows/ci.yml";
    assert.ok(isFile(workflowPath), `CI workflow '${workflowPath}' must exist`);
    const content = readFile(workflowPath) || "";

    assert.ok(
      content.includes("lint"),
      "CI workflow must contain lint step"
    );
    assert.ok(
      content.includes("type-check") || content.includes("tsc"),
      "CI workflow must contain type-check step"
    );
    assert.ok(
      content.includes("test"),
      "CI workflow must contain test step"
    );
  });

  // Feature 14: Quality & Testing Scaffolding (Milestone: M4)
  it("[F14][M4] should scaffold all five test subdirectories", (t) => {
    if (checkMilestone(t, "M4")) return;

    const testDirs = [
      "tests/unit",
      "tests/integration",
      "tests/e2e",
      "tests/rls",
      "tests/migration",
    ];

    for (const tDir of testDirs) {
      assert.ok(isDir(tDir), `Test directory '${tDir}' must exist`);
    }
  });

  // Feature 15: Centralized Documentation (Milestone: M4)
  it("[F15][M4] should scaffold all centralized documentation sections", (t) => {
    if (checkMilestone(t, "M4")) return;

    const docDirs = [
      "docs/architecture",
      "docs/database",
      "docs/operations",
      "docs/runbooks",
    ];

    const hasLocalDocs = docDirs.every((dDir) => isDir(dDir));
    assert.ok(
      hasLocalDocs || isFile("README.md"),
      "Centralized documentation must exist in docs/ or external vault cataloged in README.md"
    );
  });

  // Feature 16: Comprehensive README (Milestone: M4)
  it("[F16][M4] should provide comprehensive README.md", (t) => {
    if (checkMilestone(t, "M4")) return;

    assert.ok(isFile("README.md"), "README.md must exist at root");
    const content = readFile("README.md") || "";
    assert.ok(
      content.length > 500,
      "README.md must be populated with comprehensive documentation"
    );
  });

  // Feature 17: Prohibited Infrastructure Artifacts (Milestone: M5 / M1)
  it("[F17][M1] should strictly not contain prohibited container or backend artifacts", (t) => {
    if (checkMilestone(t, "M1")) return;

    const prohibitedPaths = [
      "backend",
      "Dockerfile",
      "docker-compose.yml",
      "docker-compose.yaml",
      "kubernetes",
      "terraform",
      "services/api",
      "services/auth",
      "services/database",
    ];

    for (const p of prohibitedPaths) {
      assert.strictEqual(
        exists(p),
        false,
        `Prohibited artifact '${p}' must not exist in repository`
      );
    }
  });

  // Feature 18: E2E Test Suite Validation & Readiness (Milestone: M5)
  it("[F18][M5] should have TEST_READY.md published or E2E runner active", (t) => {
    if (checkMilestone(t, "M5")) return;

    assert.ok(
      isFile("TEST_READY.md") || isFile("docs/TEST_READY.md") || isFile("tests/e2e/run-all.mjs"),
      "TEST_READY.md or E2E runner must exist"
    );
  });
});
