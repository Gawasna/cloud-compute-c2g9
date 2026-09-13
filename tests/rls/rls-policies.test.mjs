import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");

describe("RLS: Row Level Security Policy Verification", () => {
  const migrationsDir = path.join(ROOT_DIR, "supabase/migrations");

  function getCombinedMigrationSql() {
    assert.ok(fs.existsSync(migrationsDir), "supabase/migrations directory must exist");
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    return files
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"))
      .join("\n");
  }

  it("should enforce Row Level Security on all public tables", () => {
    const sql = getCombinedMigrationSql();

    // Extract table names created in public schema
    const createTableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi;
    const tables = [];
    let match;

    while ((match = createTableRegex.exec(sql)) !== null) {
      tables.push(match[1]);
    }

    assert.ok(tables.length > 0, "Expected at least one public table definition in migrations");

    for (const table of tables) {
      // Check for 'alter table public.<table_name> enable row level security'
      const rlsRegex = new RegExp(
        `alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`,
        "i"
      );
      assert.match(
        sql,
        rlsRegex,
        `Table 'public.${table}' MUST explicitly enable Row Level Security via ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
      );
    }
  });

  it("should define explicit security policies for protected tables", () => {
    const sql = getCombinedMigrationSql();

    // Match create policy statements
    const policyRegex = /create\s+policy\s+["']?([a-z0-9_]+)["']?\s+on\s+(?:public\.)?([a-z0-9_]+)/gi;
    const policies = [];
    let match;

    while ((match = policyRegex.exec(sql)) !== null) {
      policies.push({ policyName: match[1], table: match[2] });
    }

    assert.ok(policies.length > 0, "At least one explicit RLS policy must be declared");

    // Verify system_meta has policies configured
    const systemMetaPolicies = policies.filter((p) => p.table === "system_meta");
    assert.ok(
      systemMetaPolicies.length > 0,
      "Table 'system_meta' must have declared RLS access policies"
    );
  });

  it("should ensure administrative service_role policy is present", () => {
    const sql = getCombinedMigrationSql();

    assert.ok(
      /to\s+service_role/i.test(sql),
      "Migrations must configure explicit service_role access policy"
    );
  });

  it("should forbid permissive anon write policies on sensitive public tables", () => {
    const sql = getCombinedMigrationSql();

    // Ensure there is no policy giving anon write/update/delete access
    const dangerousAnonWrite = /create\s+policy[^\n]+to\s+anon\s+for\s+(?:all|insert|update|delete)/i;
    assert.doesNotMatch(
      sql,
      dangerousAnonWrite,
      "Migrations must never grant unauthenticated (anon) write/insert/update/delete access"
    );
  });
});
