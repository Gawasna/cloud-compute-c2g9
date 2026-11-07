import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError, toErrorResult } from "../../src/lib/api/api-error.ts";

describe("Security: error responses never leak internals", () => {
  it("keeps the message of expected ApiError (4xx)", () => {
    const r = toErrorResult(new ApiError(403, "Không đủ quyền truy cập"));
    assert.deepEqual(r, { status: 403, message: "Không đủ quyền truy cập", report: false });
  });

  it("hides raw messages of unexpected errors (SQL / host details) behind a generic 500", () => {
    const secret = 'connect ECONNREFUSED db.abcdefgh.supabase.co:5432 password authentication failed for user "postgres"';
    const r = toErrorResult(new Error(secret));
    assert.equal(r.status, 500);
    assert.equal(r.report, true);
    assert.ok(!r.message.includes("supabase"));
    assert.ok(!r.message.includes("postgres"));
    assert.ok(!r.message.includes("ECONNREFUSED"));
  });

  it("handles non-Error throwables safely", () => {
    for (const v of ["boom", 42, null, undefined, { message: "x" }]) {
      const r = toErrorResult(v);
      assert.equal(r.status, 500);
      assert.equal(r.report, true);
    }
  });

  it("maps PostgreSQL constraint codes to friendly 4xx without reporting", () => {
    const mk = (code) => Object.assign(new Error("duplicate key value violates unique constraint products_sku_key"), { code });
    assert.equal(toErrorResult(mk("23505")).status, 409);
    assert.equal(toErrorResult(mk("23503")).status, 409);
    assert.equal(toErrorResult(mk("23514")).status, 400);
    assert.ok(!toErrorResult(mk("23505")).message.includes("products_sku_key"));
  });

  it("only exposes duck-typed errors that opt in with expose=true and a 4xx status", () => {
    const ok = Object.assign(new Error("Không thể xuất quá số lượng tồn kho"), { statusCode: 400, expose: true });
    assert.equal(toErrorResult(ok).message, "Không thể xuất quá số lượng tồn kho");
    const sneaky = Object.assign(new Error("internal detail"), { statusCode: 500, expose: true });
    assert.equal(toErrorResult(sneaky).status, 500);
    assert.ok(!toErrorResult(sneaky).message.includes("internal detail"));
    const noOptIn = Object.assign(new Error("internal detail"), { statusCode: 400 });
    assert.ok(!toErrorResult(noOptIn).message.includes("internal detail"));
  });
});
