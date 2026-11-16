import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  verifyDmsToken,
  recordCheckin,
  getDmsState,
  appendTelemetryPoint,
  getTelemetryRingBuffer,
  evaluateDmsTimeout,
  DMS_STATE_KEY,
} from "../src/dms.ts";
import { generateSparkline, summarizeTelemetry, generateQuickChartUrl, generateKumaChartUrl } from "../src/chart.ts";
import worker from "../src/index.ts";

// Helper to create an in-memory mock KVNamespace for testing
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

describe("Dead Man's Switch (DMS) & Token Verification Tests", () => {
  it("verifyDmsToken validates matching Bearer tokens safely", async () => {
    const valid = await verifyDmsToken("Bearer secret_token_12345", "secret_token_12345");
    assert.equal(valid, true);

    const invalid = await verifyDmsToken("Bearer wrong_token_99999", "secret_token_12345");
    assert.equal(invalid, false);

    const missingPrefix = await verifyDmsToken("secret_token_12345", "secret_token_12345");
    assert.equal(missingPrefix, false);

    const missingHeader = await verifyDmsToken(null, "secret_token_12345");
    assert.equal(missingHeader, false);
  });

  it("recordCheckin stores on-premise payload and detects recovery transition", async () => {
    const kv = createMockKv();

    // 1. First normal check-in
    const res1 = await recordCheckin(kv, {
      node: "elitedesk-mint",
      uptime_kuma: "up",
      load_avg: 0.25,
      memory_used_mb: 2048,
    });
    assert.equal(res1.wasRecovered, false);
    assert.equal(res1.state.node, "elitedesk-mint");
    assert.equal(res1.state.alerted_down, false);

    // 2. Simulate node was marked down
    const stored = JSON.parse(kv._store.get(DMS_STATE_KEY));
    stored.alerted_down = true;
    kv._store.set(DMS_STATE_KEY, JSON.stringify(stored));

    // 3. Next check-in should trigger wasRecovered: true
    const res2 = await recordCheckin(kv, {
      node: "elitedesk-mint",
      uptime_kuma: "up",
      load_avg: 0.15,
      memory_used_mb: 2040,
    });
    assert.equal(res2.wasRecovered, true);
    assert.equal(res2.state.alerted_down, false);
  });

  it("evaluateDmsTimeout detects node silence and suppresses duplicate alerts", async () => {
    const kv = createMockKv();
    const now = Date.now();

    // 1. Healthy state within grace period
    await kv.put(
      DMS_STATE_KEY,
      JSON.stringify({
        node: "elitedesk-mint",
        last_seen_epoch: now - 300 * 1000, // 5 min ago
        alerted_down: false,
      })
    );

    const check1 = await evaluateDmsTimeout(kv, 1200); // 20 min grace period
    assert.equal(check1.silent, false);
    assert.equal(check1.shouldAlert, false);

    // 2. State exceeding 20 min grace period
    await kv.put(
      DMS_STATE_KEY,
      JSON.stringify({
        node: "elitedesk-mint",
        last_seen_epoch: now - 1500 * 1000, // 25 min ago
        alerted_down: false,
      })
    );

    const check2 = await evaluateDmsTimeout(kv, 1200);
    assert.equal(check2.silent, true);
    assert.equal(check2.shouldAlert, true);

    // 3. Subsequent check: should not alert again
    const check3 = await evaluateDmsTimeout(kv, 1200);
    assert.equal(check3.silent, true);
    assert.equal(check3.shouldAlert, false);
  });

  it("appendTelemetryPoint maintains rolling ring buffer capped at max points", async () => {
    const kv = createMockKv();

    for (let i = 0; i < 55; i++) {
      await appendTelemetryPoint(kv, {
        cloud_duration_ms: 100 + i,
        hp_load: 0.1 + i * 0.01,
      });
    }

    const buffer = await getTelemetryRingBuffer(kv);
    assert.equal(buffer.length, 48, "Buffer should be strictly capped at 48 points");
    assert.equal(buffer[buffer.length - 1].cloud_duration_ms, 100 + 54);
  });
});

describe("Telemetry Sparkline & Visualization Tests", () => {
  it("generateSparkline creates expected Unicode gradient", () => {
    assert.equal(generateSparkline([]), "N/A");

    const line = generateSparkline([10, 20, 30, 40, 50, 60, 70, 80]);
    assert.equal(line.length, 8);
    assert.equal(line[0], " ");
    assert.equal(line[7], "█");

    // Flat line handles range=0 safely
    const flat = generateSparkline([50, 50, 50]);
    assert.equal(flat.length, 3);
  });

  it("summarizeTelemetry calculates proper averages and sparklines", () => {
    const points = [
      { ts: 1000, cloud_duration_ms: 200, hp_load: 0.2 },
      { ts: 1600, cloud_duration_ms: 400, hp_load: 0.4 },
    ];
    const summary = summarizeTelemetry(points);
    assert.equal(summary.avgCloudLatency, 300);
    assert.equal(summary.maxCloudLatency, 400);
    assert.equal(summary.avgHpLoad, 0.3);
    assert.equal(summary.pointCount, 2);
    assert.equal(summary.cloudLatencySpark.length, 2);
  });

  it("generateQuickChartUrl produces valid chart URL", () => {
    const points = [
      { ts: 1731690000, cloud_duration_ms: 250, hp_load: 0.15 },
      { ts: 1731690600, cloud_duration_ms: 320, hp_load: 0.18 },
    ];
    const url = generateQuickChartUrl(points);
    assert.match(url, /^https:\/\/quickchart\.io\/chart\?/);
    assert.match(url, /Cloud%20Latency/);
  });

  it("generateKumaChartUrl produces valid chart URL with kuma 8h series and fallback datasets", () => {
    // 1. Series mode
    const series = [
      { time: "05:15", supabase_ping: 450, vercel_health_ping: 1200, vercel_front_ping: 160, uplink_ping: 15 },
      { time: "06:15", supabase_ping: 460, vercel_health_ping: 1100, vercel_front_ping: 155, uplink_ping: 14 },
    ];
    const seriesUrl = generateKumaChartUrl(series);
    assert.match(seriesUrl, /^https:\/\/quickchart\.io\/chart\?/);
    assert.match(seriesUrl, /Uptime%20Kuma%208-Hour/);
    assert.match(seriesUrl, /Supabase%20DB/);
    assert.match(seriesUrl, /Vercel%20Front/);

    // 2. Fallback mode
    const points = [
      { ts: 1731690000, kuma_supabase_ping_ms: 450, kuma_vercel_ping_ms: 1200, kuma_uplink_ping_ms: 15 },
      { ts: 1731690600, kuma_supabase_ping_ms: 460, kuma_vercel_ping_ms: 1100, kuma_uplink_ping_ms: 14 },
    ];
    const fallbackUrl = generateKumaChartUrl(undefined, points);
    assert.match(fallbackUrl, /^https:\/\/quickchart\.io\/chart\?/);
    assert.match(fallbackUrl, /Uptime%20Kuma/);
  });
});

describe("Kuma Telemetry Ingestion Tests", () => {
  it("recordCheckin stores rich kuma telemetry into state and ring buffer", async () => {
    const kv = createMockKv();
    const payload = {
      node: "elitedesk-mint",
      uptime_kuma: "up",
      load_avg: 0.2,
      memory_used_mb: 2100,
      kuma: {
        status: "up",
        monitors_total: 7,
        monitors_up: 7,
        monitors_down: 0,
        supabase_db_ping_ms: 488,
        vercel_api_ping_ms: 1295,
        internet_uplink_ping_ms: 15,
        uptime_24h_percent: 100.0,
        failed_events: [
          { monitor_id: 1, monitor_name: "Supabase DB", time: "2026-11-15 08:00:00", msg: "Timeout", ping: 10000 },
        ],
        series: [
          { time: "05:00", supabase_ping: 500, vercel_health_ping: 1300, vercel_front_ping: 160, uplink_ping: 20 },
          { time: "06:00", supabase_ping: 510, vercel_health_ping: 1250, vercel_front_ping: 155, uplink_ping: 19 },
        ],
      },
    };

    const res = await recordCheckin(kv, payload);
    assert.equal(res.state.kuma.monitors_total, 7);
    assert.equal(res.state.kuma.supabase_db_ping_ms, 488);
    assert.equal(res.state.kuma.failed_events.length, 1);
    assert.equal(res.state.kuma.series.length, 2);

    const buffer = await getTelemetryRingBuffer(kv);
    assert.equal(buffer.length, 1);
    assert.equal(buffer[0].kuma_supabase_ping_ms, 488);
    assert.equal(buffer[0].kuma_monitors_up, 7);
  });
});

describe("POST /api/dms/checkin HTTP Handler Tests", () => {
  it("rejects unauthorized requests with 401 when token is missing or wrong", async () => {
    const env = {
      DEFAULT_HEALTH_ENDPOINT: "https://example.com/api/health",
      DMS_SECRET_TOKEN: "valid_token_abc",
      WATCHDOG_KV: createMockKv(),
    };

    // 1. Missing header
    const req1 = new Request("http://localhost/api/dms/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node: "elitedesk-mint" }),
    });
    const res1 = await worker.fetch(req1, env);
    assert.equal(res1.status, 401);

    // 2. Wrong token
    const req2 = new Request("http://localhost/api/dms/checkin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer wrong_token_xyz",
      },
      body: JSON.stringify({ node: "elitedesk-mint" }),
    });
    const res2 = await worker.fetch(req2, env);
    assert.equal(res2.status, 401);
  });

  it("accepts valid heartbeat and responds with 200 and node state", async () => {
    const kv = createMockKv();
    const env = {
      DEFAULT_HEALTH_ENDPOINT: "https://example.com/api/health",
      DMS_SECRET_TOKEN: "valid_token_abc",
      WATCHDOG_KV: kv,
    };

    const req = new Request("http://localhost/api/dms/checkin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer valid_token_abc",
      },
      body: JSON.stringify({
        node: "elitedesk-mint",
        uptime_kuma: "up",
        load_avg: 0.18,
        memory_used_mb: 2048,
      }),
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.node, "elitedesk-mint");

    // Verify stored in KV
    const stored = await getDmsState(kv);
    assert.equal(stored?.node, "elitedesk-mint");
    assert.equal(stored?.load_avg, 0.18);
  });
});
