/**
 * Integration tests against a REAL PostgreSQL (runs the real migrations + the real service code).
 *
 *   TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:5432/cloudstock_test npm test
 *
 * Skipped automatically when TEST_DATABASE_URL is not set. The database name MUST contain "test"
 * because the bootstrap drops and recreates the public/auth schemas.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

const URL_ = process.env.TEST_DATABASE_URL;
const skip = URL_ ? false : "TEST_DATABASE_URL not set (real-PostgreSQL tests skipped)";

describe("Integration (real PostgreSQL): inventory ledger, concurrency and constraints", { skip }, () => {
  let admin, withTransaction, getDbPool, applyStockMovement, toSearchPattern;
  const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  let categoryId, unitId;

  async function newProduct(sku, stock = 0, extra = {}) {
    const r = await admin.query(
      `insert into public.products(name, sku, category_id, unit_id, stock_quantity, minimum_stock) values($1,$2,$3,$4,$5,$6) returning id`,
      [extra.name ?? `SP ${sku}`, sku, categoryId, unitId, stock, extra.min ?? 5]
    );
    return r.rows[0].id;
  }
  const move = (productId, type, quantity) =>
    withTransaction((c) => applyStockMovement(c, { productId, type, quantity, note: null }, USER));

  before(async () => {
    const dbName = new URL(URL_).pathname.slice(1);
    assert.ok(/test/i.test(dbName), `Refusing to run destructive bootstrap on database "${dbName}" (name must contain "test")`);

    admin = new pg.Client({ connectionString: URL_ });
    await admin.connect();
    await admin.query(readFileSync("tests/integration/helpers/supabase-stub.sql", "utf8"));
    for (const f of readdirSync("supabase/migrations").filter((n) => n.endsWith(".sql")).sort()) {
      await admin.query(readFileSync(`supabase/migrations/${f}`, "utf8"));
    }
    await admin.query("insert into auth.users(id, email) values($1, 'qa@example.com')", [USER]);
    await admin.query("insert into public.profiles(id, display_name, role) values($1, 'QA', 'staff')", [USER]);
    categoryId = (await admin.query("select id from public.categories limit 1")).rows[0].id;
    unitId = (await admin.query("select id from public.units limit 1")).rows[0].id;

    process.env.DATABASE_URL = URL_;
    process.env.DATABASE_SSL_CA_PATH = "/nonexistent-ca.crt"; // local test DB has no TLS
    process.env.DATABASE_POOL_SIZE = "30";
    ({ withTransaction, getDbPool } = await import("../../src/lib/db/client.ts"));
    ({ applyStockMovement } = await import("../../src/server/services/stock.ts"));
    ({ toSearchPattern } = await import("../../src/lib/utils/sql.ts"));
  });

  after(async () => {
    await getDbPool?.().end();
    await admin?.end();
  });

  it("real migrations apply cleanly in order (schema is usable)", async () => {
    const r = await admin.query("select count(*)::int n from information_schema.tables where table_schema='public' and table_name in ('products','stock_movements','profiles','categories','units')");
    assert.equal(r.rows[0].n, 5);
  });

  it("RACE: 25 parallel OUT(1) on stock=10 → exactly 10 succeed, stock ends at 0, never negative", async () => {
    const pid = await newProduct("RACE-1", 10);
    const results = await Promise.allSettled(Array.from({ length: 25 }, () => move(pid, "OUT", 1)));
    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(ok.length, 10);
    assert.equal(rejected.length, 15);
    assert.ok(rejected.every((r) => r.reason.statusCode === 400));

    const stock = (await admin.query("select stock_quantity from public.products where id=$1", [pid])).rows[0].stock_quantity;
    assert.equal(stock, 0);
    const balances = (await admin.query("select balance_after from public.stock_movements where product_id=$1 order by balance_after desc", [pid])).rows.map((r) => r.balance_after);
    assert.deepEqual(balances, [9, 8, 7, 6, 5, 4, 3, 2, 1, 0], "ledger must be a gap-free, duplicate-free sequence");
  });

  it("RACE: mixed parallel IN/OUT keeps ledger and stock consistent", async () => {
    const pid = await newProduct("RACE-2", 50);
    const ops = Array.from({ length: 60 }, (_, i) => [i % 3 === 0 ? "IN" : "OUT", (i % 4) + 1]);
    const results = await Promise.allSettled(ops.map(([t, q]) => move(pid, t, q)));
    const accepted = ops.filter((_, i) => results[i].status === "fulfilled");
    const expected = 50 + accepted.reduce((s, [t, q]) => s + (t === "IN" ? q : -q), 0);
    const row = (await admin.query("select stock_quantity from public.products where id=$1", [pid])).rows[0];
    assert.equal(row.stock_quantity, expected);
    assert.ok(row.stock_quantity >= 0);
    const ledger = (await admin.query("select coalesce(sum(case when type='IN' then quantity else -quantity end),0)::int d, count(*)::int n from public.stock_movements where product_id=$1", [pid])).rows[0];
    assert.equal(50 + ledger.d, expected);
    assert.equal(ledger.n, accepted.length);
  });

  it("failed movement rolls back: no stock change and no ledger row", async () => {
    const pid = await newProduct("ROLL-1", 2);
    await assert.rejects(move(pid, "OUT", 3), (e) => e.statusCode === 400);
    assert.equal((await admin.query("select stock_quantity from public.products where id=$1", [pid])).rows[0].stock_quantity, 2);
    assert.equal((await admin.query("select count(*)::int n from public.stock_movements where product_id=$1", [pid])).rows[0].n, 0);
  });

  it("soft-deleted product cannot be moved (404)", async () => {
    const pid = await newProduct("DEL-1", 5);
    await admin.query("update public.products set deleted_at=now() where id=$1", [pid]);
    await assert.rejects(move(pid, "IN", 1), (e) => e.statusCode === 404);
  });

  it("SKU can be re-used after soft delete, but not by two ACTIVE products (partial unique index)", async () => {
    const a = await newProduct("SKU-REUSE", 0);
    await assert.rejects(newProduct("SKU-REUSE", 0), (e) => e.code === "23505");
    await admin.query("update public.products set deleted_at=now() where id=$1", [a]);
    const b = await newProduct("SKU-REUSE", 0);
    assert.notEqual(a, b);
  });

  it("stock_movements is append-only (UPDATE and DELETE are rejected)", async () => {
    const pid = await newProduct("LEDGER-1", 3);
    await move(pid, "IN", 1);
    await assert.rejects(admin.query("update public.stock_movements set quantity=999 where product_id=$1", [pid]), /append-only/);
    await assert.rejects(admin.query("delete from public.stock_movements where product_id=$1", [pid]), /append-only/);
  });

  it("database CHECK constraints reject negative stock and non-positive quantities even if app code is bypassed", async () => {
    const pid = await newProduct("CHK-1", 1);
    await assert.rejects(admin.query("update public.products set stock_quantity=-1 where id=$1", [pid]), (e) => e.code === "23514");
    await assert.rejects(
      admin.query("insert into public.stock_movements(product_id,type,quantity,balance_after,performed_by) values($1,'IN',0,1,$2)", [pid, USER]),
      (e) => e.code === "23514"
    );
  });

  it("updated_at trigger advances on update", async () => {
    const pid = await newProduct("UPD-1", 0);
    const before = (await admin.query("select updated_at from public.products where id=$1", [pid])).rows[0].updated_at;
    await new Promise((r) => setTimeout(r, 15));
    await admin.query("update public.products set minimum_stock=9 where id=$1", [pid]);
    const after = (await admin.query("select updated_at from public.products where id=$1", [pid])).rows[0].updated_at;
    assert.ok(after > before);
  });

  it("search: '%' and '_' are matched literally, not as wildcards", async () => {
    await newProduct("LIKE-A", 0, { name: "Giảm giá 100% hôm nay" });
    await newProduct("LIKE-B", 0, { name: "Bút bi xanh" });
    const search = async (term) =>
      (await admin.query("select name from public.products where deleted_at is null and (name ilike $1 or sku ilike $1)", [toSearchPattern(term)])).rows.map((r) => r.name);
    assert.deepEqual(await search("%"), ["Giảm giá 100% hôm nay"]);
    assert.deepEqual(await search("100%"), ["Giảm giá 100% hôm nay"]);
    assert.ok((await search("bút")).includes("Bút bi xanh"));
    assert.deepEqual(await search("_"), []);
  });

  it("timezone: Vietnam-local day boundaries (UTC+7) bucket correctly", async () => {
    // 2026-01-01 17:30 UTC == 2026-01-02 00:30 Asia/Ho_Chi_Minh
    const r = await admin.query("select date_trunc('day', timestamptz '2026-01-01 17:30:00+00' at time zone 'Asia/Ho_Chi_Minh')::date::text d");
    assert.equal(r.rows[0].d, "2026-01-02");
  });
});
