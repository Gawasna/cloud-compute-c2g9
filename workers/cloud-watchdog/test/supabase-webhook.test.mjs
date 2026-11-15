import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  verifySupabaseSecret,
  formatSupabaseWebhookAlert,
  evaluateSupabaseLatency,
  handleSupabaseWebhook,
  SUPABASE_LATENCY_STATE_KEY,
} from "../src/supabase.ts";

// In-memory KVNamespace mock for deterministic testing
function createMockKv() {
  const store = new Map();
  return {
    async get(key, type) {
      const val = store.get(key);
      if (val === undefined) return null;
      if (type === "json") {
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      }
      return val;
    },
    async put(key, value) {
      store.set(key, typeof value === "string" ? value : JSON.stringify(value));
    },
    async delete(key) {
      store.delete(key);
    },
    _store: store,
  };
}

describe("Supabase Webhook Ingestion & Latency Guard Suite", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("Test 1: Secret Token Verification & 401 Rejection", () => {
    const SECRET = "test-supabase-secret-token";

    it("verifySupabaseSecret returns false when envSecret is empty or undefined", () => {
      const req = new Request("https://edge.watchdog.local/api/supabase/webhook", {
        headers: { "x-supabase-token": SECRET },
      });
      assert.equal(verifySupabaseSecret(req, undefined), false);
      assert.equal(verifySupabaseSecret(req, ""), false);
      assert.equal(verifySupabaseSecret(req, "   "), false);
    });

    it("verifySupabaseSecret checks header x-supabase-token correctly", () => {
      const validReq = new Request("https://edge.watchdog.local/api/supabase/webhook", {
        headers: { "x-supabase-token": SECRET },
      });
      assert.equal(verifySupabaseSecret(validReq, SECRET), true);

      const invalidReq = new Request("https://edge.watchdog.local/api/supabase/webhook", {
        headers: { "x-supabase-token": "wrong_token_xyz" },
      });
      assert.equal(verifySupabaseSecret(invalidReq, SECRET), false);
    });

    it("verifySupabaseSecret checks URL search parameter ?token= correctly", () => {
      const validReq = new Request(`https://edge.watchdog.local/api/supabase/webhook?token=${SECRET}`);
      assert.equal(verifySupabaseSecret(validReq, SECRET), true);

      const invalidReq = new Request("https://edge.watchdog.local/api/supabase/webhook?token=invalid_val");
      assert.equal(verifySupabaseSecret(invalidReq, SECRET), false);
    });

    it("handleSupabaseWebhook returns HTTP 401 when token is missing or incorrect", async () => {
      const env = { SUPABASE_WEBHOOK_SECRET: SECRET };

      // 1. Missing token
      const reqMissing = new Request("https://edge.watchdog.local/api/supabase/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "INSERT", table: "orders" }),
      });
      const resMissing = await handleSupabaseWebhook(reqMissing, env);
      assert.equal(resMissing.status, 401);
      const jsonMissing = await resMissing.json();
      assert.match(jsonMissing.error, /unauthorized/i);

      // 2. Wrong token in header
      const reqWrongHeader = new Request("https://edge.watchdog.local/api/supabase/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-token": "bad_token",
        },
        body: JSON.stringify({ type: "INSERT", table: "orders" }),
      });
      const resWrong = await handleSupabaseWebhook(reqWrongHeader, env);
      assert.equal(resWrong.status, 401);
    });

    it("handleSupabaseWebhook returns HTTP 400 for invalid JSON payload", async () => {
      const env = { SUPABASE_WEBHOOK_SECRET: SECRET };
      const reqBadJson = new Request("https://edge.watchdog.local/api/supabase/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-token": SECRET,
        },
        body: "not a valid json {",
      });
      const res = await handleSupabaseWebhook(reqBadJson, env);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /bad request/i);
    });
  });

  describe("Test 2: Valid Webhook Handling & Telegram HTML Alert Dispatch", () => {
    const SECRET = "test-supabase-secret-token-live";
    const env = {
      SUPABASE_WEBHOOK_SECRET: SECRET,
      TELEGRAM_BOT_TOKEN: "123456:BOT_TOKEN",
      TELEGRAM_CHAT_ID: "-100999888777",
    };

    it("formatSupabaseWebhookAlert formats INSERT, UPDATE, DELETE with escaped HTML", () => {
      // 1. INSERT alert
      const insertHtml = formatSupabaseWebhookAlert({
        type: "INSERT",
        table: "inventories",
        schema: "public",
        record: { id: "item-101", name: "<script>alert('xss')</script>", qty: 50 },
        old_record: null,
      });
      assert.match(insertHtml, /<b>\[SUPABASE DB EVENT\] INVENTORIES<\/b>/);
      assert.match(insertHtml, /<code>INSERT<\/code>/);
      assert.match(insertHtml, /public\.inventories/);
      assert.match(insertHtml, /&lt;script&gt;alert\('xss'\)&lt;\/script&gt;/);
      assert.doesNotMatch(insertHtml, /<script>/);

      // 2. UPDATE alert
      const updateHtml = formatSupabaseWebhookAlert({
        type: "UPDATE",
        table: "users",
        schema: "auth",
        record: { id: "u-1", status: "active" },
        old_record: { id: "u-1", status: "pending" },
      });
      assert.match(updateHtml, /<b>\[SUPABASE DB EVENT\] USERS<\/b>/);
      assert.match(updateHtml, /<code>UPDATE<\/code>/);
      assert.match(updateHtml, /auth\.users/);
      assert.match(updateHtml, /<b>Record Data:<\/b>/);
      assert.match(updateHtml, /<b>Previous Data:<\/b>/);

      // 3. DELETE alert
      const deleteHtml = formatSupabaseWebhookAlert({
        type: "DELETE",
        table: "sessions",
        schema: "public",
        record: null,
        old_record: { session_id: "sess_42" },
      });
      assert.match(deleteHtml, /<code>DELETE<\/code>/);
      assert.match(deleteHtml, /sess_42/);
    });

    it("handleSupabaseWebhook dispatches HTML alert to Telegram and returns 200 OK", async () => {
      let dispatchedUrl = null;
      let dispatchedBody = null;

      globalThis.fetch = async (url, options) => {
        dispatchedUrl = String(url);
        dispatchedBody = JSON.parse(options.body);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const payload = {
        type: "INSERT",
        table: "orders",
        schema: "public",
        record: { id: "ord-888", amount: 1500000, customer: "John Doe" },
        old_record: null,
      };

      const req = new Request("https://edge.watchdog.local/api/supabase/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-token": SECRET,
        },
        body: JSON.stringify(payload),
      });

      const res = await handleSupabaseWebhook(req, env);
      assert.equal(res.status, 200);
      const resJson = await res.json();
      assert.equal(resJson.ok, true);
      assert.equal(resJson.table, "orders");
      assert.equal(resJson.action, "INSERT");

      // Verify Telegram dispatch payload
      assert.equal(dispatchedUrl, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`);
      assert.equal(dispatchedBody.chat_id, env.TELEGRAM_CHAT_ID);
      assert.equal(dispatchedBody.parse_mode, "HTML");
      assert.match(dispatchedBody.text, /\[SUPABASE DB EVENT\] ORDERS/);
      assert.match(dispatchedBody.text, /ord-888/);
    });
  });

  describe("Test 3: evaluateSupabaseLatency Multi-Cycle Degraded & Recovery Guard", () => {
    it("detects degraded state after 2 consecutive cycles (> 2500ms) and triggers recovery (< 1000ms)", async () => {
      const kv = createMockKv();

      // Cycle 1: Nominal baseline (latency = 300ms, dbStatus = "connected")
      const cycle1 = await evaluateSupabaseLatency(300, "connected", kv);
      assert.equal(cycle1.shouldAlert, false);
      assert.equal(cycle1.isRecovery, false);
      assert.equal(cycle1.state.consecutive_degraded, 0);
      assert.equal(cycle1.state.alerted_degraded, false);

      // Cycle 2: High latency spike (> 2500ms) - cycle 1 of degradation
      const cycle2 = await evaluateSupabaseLatency(2800, "connected", kv);
      assert.equal(cycle2.shouldAlert, false, "Should not alert on 1st degraded cycle");
      assert.equal(cycle2.isRecovery, false);
      assert.equal(cycle2.state.consecutive_degraded, 1);
      assert.equal(cycle2.state.alerted_degraded, false);

      // Cycle 3: Second consecutive degraded cycle (> 2500ms) -> Triggers Degraded Alert!
      const cycle3 = await evaluateSupabaseLatency(3100, "connected", kv);
      assert.equal(cycle3.shouldAlert, true, "Must alert on 2nd consecutive degraded cycle");
      assert.equal(cycle3.isRecovery, false);
      assert.equal(cycle3.state.consecutive_degraded, 2);
      assert.equal(cycle3.state.alerted_degraded, true);
      assert.ok(cycle3.alertPayload);
      assert.equal(cycle3.alertPayload.status, "degraded");
      assert.match(cycle3.alertPayload.message, /CRITICAL ALERT/);

      // Cycle 4: Continues degraded (latency 2900ms) -> Duplicate alert suppression
      const cycle4 = await evaluateSupabaseLatency(2900, "connected", kv);
      assert.equal(cycle4.shouldAlert, false, "Should suppress duplicate degraded alert");
      assert.equal(cycle4.state.alerted_degraded, true);

      // Cycle 5: Recovery baseline (< 1000ms) -> Triggers Recovery Alert!
      const cycle5 = await evaluateSupabaseLatency(450, "connected", kv);
      assert.equal(cycle5.shouldAlert, true, "Must alert upon latency recovery");
      assert.equal(cycle5.isRecovery, true);
      assert.equal(cycle5.state.alerted_degraded, false);
      assert.equal(cycle5.state.consecutive_degraded, 0);
      assert.ok(cycle5.alertPayload);
      assert.equal(cycle5.alertPayload.status, "recovered");
      assert.match(cycle5.alertPayload.message, /RECOVERED/);

      // Cycle 6: Remains healthy (< 1000ms) -> No alert
      const cycle6 = await evaluateSupabaseLatency(420, "connected", kv);
      assert.equal(cycle6.shouldAlert, false);
      assert.equal(cycle6.isRecovery, false);
      assert.equal(cycle6.state.alerted_degraded, false);

      // Verify KV state persistence
      const savedState = await kv.get(SUPABASE_LATENCY_STATE_KEY, "json");
      assert.equal(savedState.last_latency_ms, 420);
      assert.equal(savedState.last_db_status, "connected");
      assert.equal(savedState.alerted_degraded, false);
    });

    it("detects degraded state when dbStatus is not connected regardless of latency", async () => {
      const kv = createMockKv();

      // Cycle 1: Disconnected status
      const cycle1 = await evaluateSupabaseLatency(200, "disconnected", kv);
      assert.equal(cycle1.shouldAlert, false);
      assert.equal(cycle1.state.consecutive_degraded, 1);

      // Cycle 2: Disconnected status -> triggers alert
      const cycle2 = await evaluateSupabaseLatency(250, "disconnected", kv);
      assert.equal(cycle2.shouldAlert, true);
      assert.equal(cycle2.state.consecutive_degraded, 2);
      assert.equal(cycle2.state.alerted_degraded, true);

      // Cycle 3: Recovers to connected and low latency
      const cycle3 = await evaluateSupabaseLatency(350, "connected", kv);
      assert.equal(cycle3.shouldAlert, true);
      assert.equal(cycle3.isRecovery, true);
      assert.equal(cycle3.state.alerted_degraded, false);
    });
  });
});
