import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ROOT_DIR,
  exists,
  isFile,
  isDir,
  readFile,
  readJson,
  listDir,
  getFirstCodeLine,
  resolvePath,
} from "./test-helpers.mjs";

describe("Tier 2: Boundary & Corner Cases", () => {
  // Boundary 1: Migration naming schema validation (<timestamp>_<desc>.sql)
  it("[B01] should enforce <timestamp>_<desc>.sql naming convention for all migrations", () => {
    const migrationsDir = "supabase/migrations";
    if (!isDir(migrationsDir)) {
      // In early milestones before M3, verify directory expectation
      assert.ok(true, "supabase/migrations will be validated upon creation");
      return;
    }

    const files = listDir(migrationsDir).filter((f) => f.endsWith(".sql"));
    const migrationNameRegex = /^\d{8,14}_[a-z0-9_]+\.sql$/;

    for (const sqlFile of files) {
      assert.match(
        sqlFile,
        migrationNameRegex,
        `Migration file '${sqlFile}' must strictly follow '<timestamp>_<description>.sql' naming pattern`
      );
    }
  });

  // Boundary 2: Sentry strict root exclusivity
  it("[B02] should strictly place Sentry configs only at root, never inside src/", () => {
    const sentryFiles = [
      "sentry.client.config.ts",
      "sentry.server.config.ts",
      "sentry.edge.config.ts",
    ];

    // Check prohibited nested locations
    const prohibitedSentryDirs = [
      "src",
      "src/lib",
      "src/lib/observability",
      "src/config",
      "src/app",
    ];

    for (const sDir of prohibitedSentryDirs) {
      for (const sFile of sentryFiles) {
        const nestedPath = path.join(sDir, sFile);
        assert.strictEqual(
          exists(nestedPath),
          false,
          `Sentry config must NOT exist in nested path '${nestedPath}'`
        );
      }
    }
  });

  // Boundary 3: Environment variable classification and secret hygiene
  it("[B03] should enforce browser-safe prefixing and placeholder secrets in .env.example", () => {
    if (!isFile(".env.example")) {
      assert.ok(true, ".env.example will be validated upon M3 creation");
      return;
    }

    const envContent = readFile(".env.example") || "";
    const lines = envContent.split(/\r?\n/);

    const clientVars = [];
    const serverSecrets = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const [key, ...rest] = trimmed.split("=");
      const val = rest.join("=").trim();

      if (key.startsWith("NEXT_PUBLIC_")) {
        clientVars.push(key);
      } else {
        serverSecrets.push(key);
      }

      // Ensure no live/actual credentials leaked in template
      assert.doesNotMatch(
        val,
        /^ey[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
        `Secret variable '${key}' must NOT contain an actual live JWT token in .env.example`
      );
    }

    // Must have at least Supabase public and secret variables
    assert.ok(
      clientVars.includes("NEXT_PUBLIC_SUPABASE_URL"),
      "Browser-safe group must include NEXT_PUBLIC_SUPABASE_URL"
    );
    assert.ok(
      serverSecrets.includes("SUPABASE_SERVICE_ROLE_KEY"),
      "Server secret group must include SUPABASE_SERVICE_ROLE_KEY without NEXT_PUBLIC_ prefix"
    );
    assert.ok(
      !clientVars.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
      "SUPABASE_SERVICE_ROLE_KEY must NEVER be prefixed with NEXT_PUBLIC_"
    );
  });

  // Boundary 4: ORM neutrality strictness
  it("[B04] should enforce strict absence of all ORM dependencies and config artifacts", () => {
    const pkg = readJson("package.json");
    if (!pkg) return;

    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    const prohibitedOrmTokens = [
      "prisma",
      "@prisma/client",
      "drizzle-orm",
      "drizzle-kit",
      "typeorm",
      "mikro-orm",
      "sequelize",
      "bookshelf",
      "objection",
    ];

    for (const token of prohibitedOrmTokens) {
      assert.strictEqual(
        token in allDeps,
        false,
        `Package.json must not have ORM dependency '${token}'`
      );
    }

    const prohibitedConfigFiles = [
      "drizzle.config.ts",
      "drizzle.config.js",
      "prisma/schema.prisma",
      "ormconfig.json",
    ];

    for (const cfg of prohibitedConfigFiles) {
      assert.strictEqual(
        exists(cfg),
        false,
        `ORM configuration file '${cfg}' must not exist in repository`
      );
    }
  });

  // Boundary 5: Server-only line 1 placement integrity
  it("[B05] should strictly verify that 'import \"server-only\"' is the first executable line", () => {
    const serverFiles = [
      "src/server/services/index.ts",
      "src/server/repositories/index.ts",
      "src/lib/db/index.ts",
    ];

    for (const sFile of serverFiles) {
      if (!isFile(sFile)) continue;

      const content = readFile(sFile) || "";
      const firstLine = getFirstCodeLine(content);

      assert.ok(
        firstLine !== null,
        `Server file '${sFile}' must not be empty or contain only comments`
      );
      assert.match(
        firstLine,
        /^import\s+['"]server-only['"];?$/,
        `Server file '${sFile}' first executable line must be exactly 'import "server-only";', got '${firstLine}'`
      );
    }
  });

  // Boundary 6: UI component purity static import verification
  it("[B06] should verify presentation UI components have zero imports from server or features", () => {
    const uiDir = "src/components/ui";
    if (!isDir(uiDir)) return;

    /**
     * Recursively scan files in directory
     * @param {string} dir
     * @returns {string[]}
     */
    function scanFiles(dir) {
      let results = [];
      const list = fs.readdirSync(resolvePath(dir));
      for (const item of list) {
        const fullRel = path.join(dir, item);
        const stat = fs.statSync(resolvePath(fullRel));
        if (stat.isDirectory()) {
          results = results.concat(scanFiles(fullRel));
        } else if (item.endsWith(".ts") || item.endsWith(".tsx")) {
          results.push(fullRel);
        }
      }
      return results;
    }

    const uiFiles = scanFiles(uiDir);

    for (const uFile of uiFiles) {
      const content = readFile(uFile) || "";
      const lines = content.split(/\r?\n/);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("import")) continue;

        // Check prohibited server and features import patterns
        assert.doesNotMatch(
          trimmed,
          /from\s+['"]@\/server/i,
          `UI component '${uFile}' must NOT import from '@/server': violation in line '${trimmed}'`
        );
        assert.doesNotMatch(
          trimmed,
          /from\s+['"]@\/features/i,
          `UI component '${uFile}' must NOT import from '@/features': violation in line '${trimmed}'`
        );
        assert.doesNotMatch(
          trimmed,
          /from\s+['"]\.\.\/+(?:server|features)/i,
          `UI component '${uFile}' must NOT import from relative server/features path: violation in line '${trimmed}'`
        );
      }
    }
  });

  // Boundary 7: Git hygiene and sensitive exclusions in .gitignore
  it("[B07] should verify essential security and build exclusions in .gitignore", () => {
    assert.ok(isFile(".gitignore"), ".gitignore must exist");
    const gitignoreContent = readFile(".gitignore") || "";

    const requiredIgnorePatterns = [
      "node_modules",
      ".next",
      ".env",
    ];

    for (const pattern of requiredIgnorePatterns) {
      assert.ok(
        gitignoreContent.includes(pattern),
        `.gitignore must include pattern '${pattern}'`
      );
    }
  });
});
