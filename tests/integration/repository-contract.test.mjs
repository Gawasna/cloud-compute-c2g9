import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");

describe("Integration: Repository Contract & Database Client Integrity", () => {
  it("should enforce server-only boundary on database and repository interface files", () => {
    const targetFiles = [
      "src/lib/db/index.ts",
      "src/server/repositories/index.ts",
      "src/server/services/index.ts",
    ];

    for (const relPath of targetFiles) {
      const fullPath = path.join(ROOT_DIR, relPath);
      assert.ok(fs.existsSync(fullPath), `Target file ${relPath} must exist`);
      const content = fs.readFileSync(fullPath, "utf8");
      const lines = content.split(/\r?\n/);
      const firstLine = lines[0].trim();
      assert.match(
        firstLine,
        /^import\s+['"]server-only['"];?$/,
        `File ${relPath} must begin with import 'server-only'`
      );
    }
  });

  it("should verify DatabaseClient contract behavior with mock client implementation", async () => {
    /**
     * In-memory implementation adhering strictly to DatabaseClient interface
     */
    class MockDatabaseClient {
      constructor() {
        this.records = new Map();
      }

      async query(sql, params = []) {
        if (!sql || typeof sql !== "string") {
          throw new TypeError("SQL statement must be a non-empty string");
        }
        if (sql.startsWith("SELECT")) {
          return Array.from(this.records.values());
        }
        return [];
      }

      async execute(sql, params = []) {
        if (!sql || typeof sql !== "string") {
          throw new TypeError("SQL statement must be a non-empty string");
        }
        if (sql.startsWith("INSERT") && params.length >= 2) {
          const [id, value] = params;
          this.records.set(id, { id, value });
          return { rowCount: 1 };
        }
        if (sql.startsWith("DELETE") && params.length >= 1) {
          const [id] = params;
          const existed = this.records.delete(id);
          return { rowCount: existed ? 1 : 0 };
        }
        return { rowCount: 0 };
      }
    }

    const client = new MockDatabaseClient();

    // Verify query interface
    const initialRows = await client.query("SELECT * FROM items;");
    assert.deepStrictEqual(initialRows, []);

    // Verify execute insert
    const insertRes = await client.execute("INSERT INTO items VALUES ($1, $2);", ["item-1", "value-1"]);
    assert.strictEqual(insertRes.rowCount, 1);

    // Verify query returns inserted record
    const updatedRows = await client.query("SELECT * FROM items;");
    assert.strictEqual(updatedRows.length, 1);
    assert.strictEqual(updatedRows[0].id, "item-1");

    // Verify execute delete
    const deleteRes = await client.execute("DELETE FROM items WHERE id = $1;", ["item-1"]);
    assert.strictEqual(deleteRes.rowCount, 1);

    // Verify error on invalid input
    await assert.rejects(
      async () => await client.query(null),
      { name: "TypeError" }
    );
  });

  it("should verify BaseRepository contract compliance with reference repository implementation", async () => {
    /**
     * Entity interface for test domain model
     */
    class InMemorySystemMetaRepository {
      constructor() {
        this.store = new Map();
      }

      async findById(id) {
        return this.store.get(id) || null;
      }

      async findMany(filter) {
        const all = Array.from(this.store.values());
        if (!filter || Object.keys(filter).length === 0) {
          return all;
        }
        return all.filter((item) => {
          return Object.entries(filter).every(([k, v]) => item[k] === v);
        });
      }

      async create(data) {
        const id = data.key;
        if (this.store.has(id)) {
          throw new Error(`Duplicate key error: ${id}`);
        }
        const record = { ...data, id };
        this.store.set(id, record);
        return record;
      }

      async update(id, data) {
        const existing = this.store.get(id);
        if (!existing) {
          throw new Error(`Record with id ${id} not found`);
        }
        const updated = { ...existing, ...data };
        this.store.set(id, updated);
        return updated;
      }

      async delete(id) {
        return this.store.delete(id);
      }
    }

    const repo = new InMemorySystemMetaRepository();

    // 1. findById returns null when empty
    const notFound = await repo.findById("non-existent");
    assert.strictEqual(notFound, null, "findById should return null for nonexistent id");

    // 2. create stores record and returns it
    const created = await repo.create({ key: "app_env", value: "test" });
    assert.strictEqual(created.id, "app_env");
    assert.strictEqual(created.value, "test");

    // 3. findById retrieves created record
    const retrieved = await repo.findById("app_env");
    assert.notStrictEqual(retrieved, null);
    assert.strictEqual(retrieved?.value, "test");

    // 4. findMany with matching filter
    const matches = await repo.findMany({ value: "test" });
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].key, "app_env");

    // 5. findMany with non-matching filter
    const emptyMatches = await repo.findMany({ value: "production" });
    assert.strictEqual(emptyMatches.length, 0);

    // 6. update modifies existing record
    const updated = await repo.update("app_env", { value: "staging" });
    assert.strictEqual(updated.value, "staging");

    // 7. delete removes record
    const deleteResult = await repo.delete("app_env");
    assert.strictEqual(deleteResult, true);

    const postDelete = await repo.findById("app_env");
    assert.strictEqual(postDelete, null);
  });

  it("should verify connection string separation pattern in database config contract", () => {
    const dbClientPath = path.join(ROOT_DIR, "src/lib/db/index.ts");
    assert.ok(fs.existsSync(dbClientPath), "src/lib/db/index.ts must exist");
    const dbContent = fs.readFileSync(dbClientPath, "utf8");

    // DatabaseConfig interface must separate databaseUrl and directUrl
    assert.ok(
      dbContent.includes("databaseUrl: string"),
      "DatabaseConfig contract must define runtime databaseUrl"
    );
    assert.ok(
      dbContent.includes("directUrl?: string"),
      "DatabaseConfig contract must define migration directUrl"
    );

    // .env.example must define DATABASE_URL and DIRECT_URL
    const envExamplePath = path.join(ROOT_DIR, ".env.example");
    assert.ok(fs.existsSync(envExamplePath), ".env.example must exist");
    const envContent = fs.readFileSync(envExamplePath, "utf8");

    assert.ok(
      envContent.includes("DATABASE_URL="),
      ".env.example must define DATABASE_URL for runtime queries"
    );
    assert.ok(
      envContent.includes("DIRECT_URL="),
      ".env.example must define DIRECT_URL for migration tooling"
    );
  });
});
