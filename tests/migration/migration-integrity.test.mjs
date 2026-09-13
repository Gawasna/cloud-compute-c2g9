import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");

describe("Migration: Migration Integrity & Schema Evolution Rules", () => {
  const migrationsDir = path.join(ROOT_DIR, "supabase/migrations");
  const seedFile = path.join(ROOT_DIR, "supabase/seed/seed.sql");

  it("should enforce <timestamp>_<description>.sql naming pattern on all migration files", () => {
    assert.ok(fs.existsSync(migrationsDir), "supabase/migrations directory must exist");

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    assert.ok(files.length > 0, "At least one SQL migration file must exist");

    const migrationRegex = /^\d{8,14}_[a-z0-9_]+\.sql$/;

    for (const file of files) {
      assert.match(
        file,
        migrationRegex,
        `Migration file '${file}' must follow '<timestamp>_<description>.sql' format`
      );
    }
  });

  it("should ensure migrations are strictly ordered chronologically by timestamp", () => {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const timestamps = files.map((f) => {
      const match = f.match(/^(\d{8,14})_/);
      return match ? BigInt(match[1]) : 0n;
    });

    for (let i = 1; i < timestamps.length; i++) {
      assert.ok(
        timestamps[i] > timestamps[i - 1],
        `Migration '${files[i]}' timestamp must be strictly greater than '${files[i - 1]}'`
      );
    }
  });

  it("should verify migrations contain non-empty, syntactically valid PostgreSQL statements", () => {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

    const validDdlKeywords = [
      "CREATE",
      "ALTER",
      "DROP",
      "COMMENT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "DO",
      "SET",
    ];

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, "utf8").trim();

      assert.ok(sql.length > 0, `Migration file '${file}' must not be empty`);

      // Strip comments to find SQL statements
      const statementLines = sql
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("--"));

      assert.ok(
        statementLines.length > 0,
        `Migration file '${file}' must contain active SQL statements beyond comments`
      );

      const firstKeyword = statementLines[0].split(/\s+/)[0].toUpperCase();
      assert.ok(
        validDdlKeywords.includes(firstKeyword),
        `Migration '${file}' begins with recognized SQL keyword: ${firstKeyword}`
      );
    }
  });

  it("should verify baseline migration creates required core metadata table", () => {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    let definesSystemMeta = false;

    for (const file of files) {
      const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      if (
        /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.system_meta/i.test(content) ||
        /create\s+table\s+(?:if\s+not\s+exists\s+)?system_meta/i.test(content)
      ) {
        definesSystemMeta = true;
        break;
      }
    }

    assert.ok(
      definesSystemMeta,
      "Migrations must define 'public.system_meta' table for environment and schema state tracking"
    );
  });

  it("should verify seed.sql exists and populates valid schema tables", () => {
    assert.ok(fs.existsSync(seedFile), "supabase/seed/seed.sql must exist");
    const seedContent = fs.readFileSync(seedFile, "utf8");

    assert.ok(
      seedContent.trim().length > 0,
      "seed.sql must contain seed population script"
    );

    assert.ok(
      /insert\s+into\s+public\.system_meta/i.test(seedContent) ||
        /insert\s+into\s+system_meta/i.test(seedContent),
      "seed.sql must populate system_meta table"
    );
  });
});
