import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMovementInput, applyStockMovement, StockError } from "../../src/server/services/stock.ts";
import { toErrorResult } from "../../src/lib/api/api-error.ts";

const PID = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

/** Fake pg client that records queries and serves a single product row. */
function fakeClient(product) {
  const calls = [];
  return {
    calls,
    async query(text, params) {
      calls.push({ text, params });
      if (/for update/i.test(text)) return { rows: product ? [product] : [] };
      if (/insert into public\.stock_movements/i.test(text)) {
        return { rows: [{ product_id: params[0], type: params[1], quantity: params[2], balance_after: params[3], note: params[4], performed_by: params[5] }] };
      }
      return { rows: [], rowCount: 1 };
    },
  };
}

describe("Unit: parseMovementInput()", () => {
  const ok = { productId: PID, type: "IN", quantity: 5, note: "  nhập đầu kỳ " };
  it("accepts a valid body and trims the note", () => {
    assert.deepEqual(parseMovementInput(ok), { productId: PID, type: "IN", quantity: 5, note: "nhập đầu kỳ" });
    assert.equal(parseMovementInput({ ...ok, quantity: "7" }).quantity, 7);
    assert.equal(parseMovementInput({ ...ok, note: undefined }).note, null);
  });
  it("rejects bad input with a 400", () => {
    const bad = [
      {}, null, "str",
      { ...ok, productId: "not-a-uuid" },
      { ...ok, type: "in" }, { ...ok, type: "TRANSFER" },
      { ...ok, quantity: 0 }, { ...ok, quantity: -3 }, { ...ok, quantity: 1.5 },
      { ...ok, quantity: "abc" }, { ...ok, quantity: "" }, { ...ok, quantity: null }, { ...ok, quantity: NaN }, { ...ok, quantity: Infinity },
      { ...ok, quantity: 1_000_001 },
      { ...ok, note: "x".repeat(501) },
    ];
    for (const b of bad) {
      assert.throws(() => parseMovementInput(b), (e) => e instanceof StockError && e.statusCode === 400, JSON.stringify(b));
    }
  });
});

describe("Unit: applyStockMovement()", () => {
  it("locks the row first, then updates stock and writes the ledger with balance_after", async () => {
    const c = fakeClient({ id: PID, stock_quantity: 10, deleted_at: null });
    const m = await applyStockMovement(c, { productId: PID, type: "OUT", quantity: 4, note: null }, USER);
    assert.match(c.calls[0].text, /for update/i);
    assert.equal(c.calls[1].params[0], 6);
    assert.equal(m.balance_after, 6);
    assert.equal(m.performed_by, USER);
  });
  it("IN increases stock", async () => {
    const c = fakeClient({ id: PID, stock_quantity: 0, deleted_at: null });
    assert.equal((await applyStockMovement(c, { productId: PID, type: "IN", quantity: 9, note: null }, USER)).balance_after, 9);
  });
  it("allows taking stock exactly to zero but refuses to go below it", async () => {
    const c1 = fakeClient({ id: PID, stock_quantity: 3, deleted_at: null });
    assert.equal((await applyStockMovement(c1, { productId: PID, type: "OUT", quantity: 3, note: null }, USER)).balance_after, 0);
    const c2 = fakeClient({ id: PID, stock_quantity: 3, deleted_at: null });
    await assert.rejects(applyStockMovement(c2, { productId: PID, type: "OUT", quantity: 4, note: null }, USER), (e) => e.statusCode === 400);
    assert.equal(c2.calls.length, 1, "must not write anything when rejected");
  });
  it("404 for missing or soft-deleted products, no writes", async () => {
    for (const p of [null, { id: PID, stock_quantity: 5, deleted_at: "2026-01-01" }]) {
      const c = fakeClient(p);
      await assert.rejects(applyStockMovement(c, { productId: PID, type: "IN", quantity: 1, note: null }, USER), (e) => e.statusCode === 404);
      assert.equal(c.calls.length, 1);
    }
  });
  it("StockError is surfaced as a safe 4xx by the error mapper", () => {
    const r = toErrorResult(new StockError(400, "Không thể xuất quá số lượng tồn kho"));
    assert.equal(r.status, 400);
    assert.equal(r.message, "Không thể xuất quá số lượng tồn kho");
  });
});
