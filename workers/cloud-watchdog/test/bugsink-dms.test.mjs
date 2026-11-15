import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateBugsinkSpike,
  formatBugsinkSpikeAlert,
  formatBugsinkSummary,
  BUGSINK_SPIKE_ALERTED_KEY,
  BUGSINK_LAST_EVENTS_KEY,
  BUGSINK_DASHBOARD_URL,
} from "../src/bugsink.ts";

/**
 * Creates an in-memory mock KVNamespace for deterministic test validation.
 */
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

describe("BugSink DMS Heartbeat Extractor & Spike Detection Suite", () => {
  describe("Test 1: evaluateBugsinkSpike anomaly detection and anti-flood deduplication", () => {
    it("records initial baseline without triggering false spike", async () => {
      const kv = createMockKv();
      const telemetry = {
        status: "ok",
        total_issues: 2,
        total_events: 10,
        recent_issues: [{ id: 1, type: "InitError", value: "Bootstrap fail" }],
      };

      const result = await evaluateBugsinkSpike(telemetry, kv, 15);
      assert.equal(result.isSpike, false);
      assert.equal(result.delta, 0);
      assert.equal(result.suppressed, false);
      assert.equal(await kv.get(BUGSINK_LAST_EVENTS_KEY), "10");
      assert.equal(await kv.get(BUGSINK_SPIKE_ALERTED_KEY), null);
    });

    it("does not trigger spike when event increase is below threshold", async () => {
      const kv = createMockKv();
      await kv.put(BUGSINK_LAST_EVENTS_KEY, "10");

      const telemetry = {
        status: "ok",
        total_issues: 3,
        total_events: 18, // delta = 8 < 15
      };

      const result = await evaluateBugsinkSpike(telemetry, kv, 15);
      assert.equal(result.isSpike, false);
      assert.equal(result.delta, 8);
      assert.equal(result.suppressed, false);
      assert.equal(await kv.get(BUGSINK_LAST_EVENTS_KEY), "18");
      assert.equal(await kv.get(BUGSINK_SPIKE_ALERTED_KEY), null);
    });

    it("triggers spike alert when delta exceeds threshold and records anti-flood flag", async () => {
      const kv = createMockKv();
      await kv.put(BUGSINK_LAST_EVENTS_KEY, "18");

      const telemetry = {
        status: "ok",
        total_issues: 6,
        total_events: 48, // delta = 30 >= 15
      };

      const result = await evaluateBugsinkSpike(telemetry, kv, 15);
      assert.equal(result.isSpike, true);
      assert.equal(result.delta, 30);
      assert.equal(result.suppressed, false);
      assert.equal(await kv.get(BUGSINK_SPIKE_ALERTED_KEY), "true");
      assert.equal(await kv.get(BUGSINK_LAST_EVENTS_KEY), "48");
    });

    it("suppresses subsequent duplicate spikes within anti-flood TTL window", async () => {
      const kv = createMockKv();
      await kv.put(BUGSINK_LAST_EVENTS_KEY, "48");
      await kv.put(BUGSINK_SPIKE_ALERTED_KEY, "true");

      const telemetry = {
        status: "ok",
        total_issues: 9,
        total_events: 80, // delta = 32 >= 15
      };

      const result = await evaluateBugsinkSpike(telemetry, kv, 15);
      assert.equal(result.isSpike, false);
      assert.equal(result.delta, 32);
      assert.equal(result.suppressed, true);
      assert.equal(result.reason, "anti_flood_active");
    });

    it("re-enables alert after anti-flood flag expires or is cleared", async () => {
      const kv = createMockKv();
      await kv.put(BUGSINK_LAST_EVENTS_KEY, "80");
      // Key BUGSINK_SPIKE_ALERTED_KEY is absent / expired

      const telemetry = {
        status: "ok",
        total_issues: 12,
        total_events: 105, // delta = 25 >= 15
      };

      const result = await evaluateBugsinkSpike(telemetry, kv, 15);
      assert.equal(result.isSpike, true);
      assert.equal(result.delta, 25);
      assert.equal(result.suppressed, false);
      assert.equal(await kv.get(BUGSINK_SPIKE_ALERTED_KEY), "true");
    });

    it("handles unavailable telemetry safely without throwing exception", async () => {
      const kv = createMockKv();
      const telemetry = { status: "unavailable" };

      const result = await evaluateBugsinkSpike(telemetry, kv, 15);
      assert.equal(result.isSpike, false);
      assert.equal(result.delta, 0);
      assert.equal(result.reason, "telemetry_unavailable");

      const nullResult = await evaluateBugsinkSpike(null, kv, 15);
      assert.equal(nullResult.isSpike, false);
      assert.equal(nullResult.reason, "telemetry_unavailable");
    });

    it("supports direct delta_events override in telemetry payload", async () => {
      const kv = createMockKv();
      const telemetry = {
        status: "ok",
        total_issues: 5,
        total_events: 200,
        delta_events: 22,
      };

      const result = await evaluateBugsinkSpike(telemetry, kv, 15);
      assert.equal(result.isSpike, true);
      assert.equal(result.delta, 22);
      assert.equal(result.suppressed, false);
    });
  });

  describe("Test 2: formatBugsinkSpikeAlert creates well-structured HTML and escapes payloads", () => {
    it("formats standard alert with recent issues and Tailnet link", () => {
      const telemetry = {
        status: "ok",
        total_issues: 8,
        total_events: 142,
        recent_issues: [
          { id: 45, type: "OperationalError", value: "Database connection failed" },
          { id: 44, type: "TypeError", value: "Cannot read properties of undefined (reading 'token')" },
        ],
      };

      const html = formatBugsinkSpikeAlert(telemetry, 22);

      assert.ok(html.includes("<b>[WARNING ALERT] Phát Hiện Spike Lỗi Mới Trên BugSink!</b>"));
      assert.ok(html.includes("<b>Số lỗi mới phát sinh:</b> <code>22</code>"));
      assert.ok(html.includes("<b>Số issue chưa giải quyết:</b> <code>8</code>"));
      assert.ok(html.includes("<b>Tổng số sự kiện (Events):</b> <code>142</code>"));
      assert.ok(html.includes("• <code>[#45] OperationalError</code>: Database connection failed"));
      assert.ok(html.includes("• <code>[#44] TypeError</code>: Cannot read properties of undefined (reading 'token')"));
      assert.ok(html.includes(`<a href="${BUGSINK_DASHBOARD_URL}">${BUGSINK_DASHBOARD_URL}</a>`));
      assert.ok(html.includes("<i>Dispatched by Cloudflare Edge Watchdog</i>"));
    });

    it("strictly escapes HTML entities in error type and message value", () => {
      const maliciousTelemetry = {
        status: "ok",
        total_issues: 1,
        total_events: 50,
        recent_issues: [
          {
            id: 99,
            type: "<script>alert('xss')</script>",
            value: "Invalid payload <tag> & entities \"test\"",
          },
        ],
      };

      const html = formatBugsinkSpikeAlert(maliciousTelemetry, 18);

      assert.ok(!html.includes("<script>"));
      assert.ok(html.includes("&lt;script&gt;alert('xss')&lt;/script&gt;"));
      assert.ok(html.includes("&lt;tag&gt;"));
      assert.ok(html.includes("&amp;"));
    });

    it("formats cleanly when recent issues array is empty or missing", () => {
      const telemetry = {
        status: "ok",
        total_issues: 0,
        total_events: 30,
      };

      const html = formatBugsinkSpikeAlert(telemetry, 20);
      assert.ok(html.includes("<b>Số lỗi mới phát sinh:</b> <code>20</code>"));
      assert.ok(html.includes("<b>Số issue chưa giải quyết:</b> <code>0</code>"));
      assert.ok(!html.includes("<b>Sự cố gần nhất:</b>"));
    });
  });

  describe("Test 3: formatBugsinkSummary generates concise single-line status for /status", () => {
    it("formats summary correctly when telemetry is healthy and present", () => {
      const telemetry = {
        status: "ok",
        total_issues: 14,
        total_events: 512,
      };

      const summary = formatBugsinkSummary(telemetry);
      assert.equal(summary, "• <b>Bugsink:</b> <code>14 issues | 512 events</code>");
    });

    it("formats summary correctly when telemetry is unavailable", () => {
      const summaryUnavailable = formatBugsinkSummary({ status: "unavailable" });
      assert.equal(summaryUnavailable, "• <b>Bugsink:</b> <code>Không khả dụng (N/A)</code>");

      const summaryNull = formatBugsinkSummary(null);
      assert.equal(summaryNull, "• <b>Bugsink:</b> <code>Không khả dụng (N/A)</code>");

      const summaryUndefined = formatBugsinkSummary(undefined);
      assert.equal(summaryUndefined, "• <b>Bugsink:</b> <code>Không khả dụng (N/A)</code>");
    });
  });
});
