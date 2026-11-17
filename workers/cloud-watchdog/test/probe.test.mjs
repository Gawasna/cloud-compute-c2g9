import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { executeProbe, handleWatchdogPulse } from "../src/index.ts";
import { sendTelegramAlert, sendTelegramWarning } from "../src/notifier.ts";
import { DMS_STATE_KEY } from "../src/dms.ts";

const DUMMY_TG_TOKEN = process.env.TEST_TG_TOKEN || ["mock", "bot", "token"].join("-");

describe("Cloud Watchdog Worker Probe & Notifier Tests", () => {
  let server;
  let serverPort;
  let requestCount = 0;
  let responseMode = "healthy"; // 'healthy' | 'cold-start' | 'degraded' | 'non-json'

  before((_, done) => {
    server = http.createServer((req, res) => {
      requestCount++;
      if (req.url === "/api/health") {
        if (responseMode === "healthy") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "healthy", database: { status: "connected", latency_ms: 45 } }));
        } else if (responseMode === "cold-start") {
          if (requestCount === 1) {
            // First attempt fails with 503 (cold start)
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "degraded", database: { status: "connecting" } }));
          } else {
            // Second attempt recovers
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "healthy", database: { status: "connected" } }));
          }
        } else if (responseMode === "degraded") {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "error", database: { status: "disconnected" } }));
        } else if (responseMode === "non-json") {
          res.writeHead(502, { "Content-Type": "text/html" });
          res.end("<html><body>Bad Gateway</body></html>");
        }
      } else if (req.url?.startsWith("/bot")) {
        // Mock Telegram Bot API
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, result: { message_id: 123 } }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      serverPort = typeof address === "object" && address ? address.port : 0;
      done();
    });
  });

  after((_, done) => {
    server.close(done);
  });

  it("executeProbe returns ok=true when status is 200 and db is connected", async () => {
    responseMode = "healthy";
    requestCount = 0;

    const result = await executeProbe(`http://127.0.0.1:${serverPort}/api/health`, 3000);
    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 200);
    assert.equal(result.dbStatus, "connected");
    assert.equal(result.dbLatencyMs, 45);
  });

  it("executeProbe returns ok=false when dbStatus is not connected", async () => {
    responseMode = "degraded";
    requestCount = 0;

    const result = await executeProbe(`http://127.0.0.1:${serverPort}/api/health`, 3000);
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 503);
    assert.equal(result.dbStatus, "disconnected");
  });

  it("handleWatchdogPulse absorbs cold start via 2s retry mechanism", async () => {
    responseMode = "cold-start";
    requestCount = 0;

    const env = {
      DEFAULT_HEALTH_ENDPOINT: `http://127.0.0.1:${serverPort}/api/health`,
    };

    const result = await handleWatchdogPulse(env);
    assert.equal(requestCount, 2, "Expected probe to have retried once");
    assert.equal(result.ok, true, "Expected probe to succeed on second attempt");
    assert.equal(result.dbStatus, "connected");
  });

  it("sendTelegramAlert successfully posts HTML message to mock Telegram API", async () => {
    const alert = {
      service: "Test Service",
      url: "https://example.com/api/health",
      statusCode: 503,
      dbStatus: "disconnected",
      durationMs: 42,
      timestamp: new Date().toISOString(),
      error: "DB connection timeout",
    };

    // Use mock server endpoint as Telegram bot endpoint
    const originalFetch = globalThis.fetch;
    let interceptedUrl = "";
    let interceptedBody = "";

    globalThis.fetch = async (url, options) => {
      interceptedUrl = String(url);
      interceptedBody = String(options?.body || "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    try {
      const success = await sendTelegramAlert("test-token", "12345678", alert);
      assert.equal(success, true);
      assert.equal(interceptedUrl, "https://api.telegram.org/bottest-token/sendMessage");
      assert.match(interceptedBody, /12345678/);
      assert.match(interceptedBody, /CRITICAL ALERT/);
      assert.match(interceptedBody, /disconnected/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sendTelegramWarning successfully posts WARNING ALERT HTML message", async () => {
    const alert = {
      service: "Cloud Compute Prod",
      url: "https://example.com/api/health",
      statusCode: 200,
      dbStatus: "disconnected",
      durationMs: 42,
      timestamp: new Date().toISOString(),
      error: "HTTP 200, DB: disconnected",
    };

    const originalFetch = globalThis.fetch;
    let interceptedBody = "";

    globalThis.fetch = async (_url, options) => {
      interceptedBody = String(options?.body || "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    try {
      const success = await sendTelegramWarning("test-token", "12345678", alert);
      assert.equal(success, true);
      assert.match(interceptedBody, /WARNING ALERT/);
      assert.match(interceptedBody, /Degraded/);
      assert.match(interceptedBody, /disconnected/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handleWatchdogPulse dispatches sendTelegramWarning when statusCode is 200 but dbStatus is disconnected", async () => {
    const originalFetch = globalThis.fetch;
    const dispatchedMessages = [];

    // Mock target endpoint returning 200 with DB disconnected, and Telegram API
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes("api/health")) {
        return new Response(
          JSON.stringify({ status: "degraded", database: { status: "disconnected" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("api.telegram.org")) {
        dispatchedMessages.push(JSON.parse(String(options.body)));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    try {
      const env = {
        DEFAULT_HEALTH_ENDPOINT: "https://mock.service/api/health",
        TELEGRAM_BOT_TOKEN: DUMMY_TG_TOKEN,
        TELEGRAM_CHAT_ID: "mock-chat-id",
      };

      const result = await handleWatchdogPulse(env);
      assert.equal(result.ok, false);
      assert.equal(result.statusCode, 200);
      assert.equal(result.dbStatus, "disconnected");
      assert.equal(dispatchedMessages.length, 1);
      assert.match(dispatchedMessages[0].text, /WARNING ALERT/);
      assert.doesNotMatch(dispatchedMessages[0].text, /CRITICAL ALERT/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handleWatchdogPulse dispatches sendTelegramAlert (CRITICAL) when statusCode is 503", async () => {
    const originalFetch = globalThis.fetch;
    const dispatchedMessages = [];

    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes("api/health")) {
        return new Response(
          JSON.stringify({ status: "error", database: { status: "disconnected" } }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("api.telegram.org")) {
        dispatchedMessages.push(JSON.parse(String(options.body)));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    try {
      const env = {
        DEFAULT_HEALTH_ENDPOINT: "https://mock.service/api/health",
        TELEGRAM_BOT_TOKEN: DUMMY_TG_TOKEN,
        TELEGRAM_CHAT_ID: "mock-chat-id",
      };

      const result = await handleWatchdogPulse(env);
      assert.equal(result.ok, false);
      assert.equal(result.statusCode, 503);
      assert.equal(dispatchedMessages.length, 1);
      assert.match(dispatchedMessages[0].text, /CRITICAL ALERT/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handleWatchdogPulse performs cloud-side DMS recovery when node is not silent but alerted_down is true", async () => {
    const originalFetch = globalThis.fetch;
    const dispatchedMessages = [];

    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes("api/health")) {
        return new Response(
          JSON.stringify({ status: "healthy", database: { status: "connected" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("api.telegram.org")) {
        dispatchedMessages.push(JSON.parse(String(options.body)));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const store = new Map();
    // Simulate node state with recent last_seen (diffSec ~ 10s <= graceSec 1200) but alerted_down is still true
    const dmsState = {
      node: "hp-elitedesk-800-g4",
      last_seen_epoch: Date.now() - 10000,
      alerted_down: true,
      uptime_kuma: "up",
      load_avg: 0.42,
    };
    store.set(DMS_STATE_KEY, JSON.stringify(dmsState));

    const mockKv = {
      async get(key, type) {
        const val = store.get(key);
        if (val === undefined) return null;
        if (type === "json") return JSON.parse(val);
        return val;
      },
      async put(key, val) {
        store.set(key, typeof val === "string" ? val : JSON.stringify(val));
      },
    };

    try {
      const env = {
        DEFAULT_HEALTH_ENDPOINT: "https://mock.service/api/health",
        TELEGRAM_BOT_TOKEN: DUMMY_TG_TOKEN,
        TELEGRAM_CHAT_ID: "mock-chat-id",
        DMS_GRACE_PERIOD_SEC: "1200",
        WATCHDOG_KV: mockKv,
      };

      await handleWatchdogPulse(env);

      // Verify alerted_down was reset to false in KV
      const updatedState = JSON.parse(store.get(DMS_STATE_KEY));
      assert.equal(updatedState.alerted_down, false, "alerted_down must be reset to false in KV");

      // Verify recovery alert was dispatched to Telegram
      const recoveryAlert = dispatchedMessages.find((m) => m.text.includes("[RECOVERED]"));
      assert.ok(recoveryAlert, "DMS recovery notification must be dispatched");
      assert.match(recoveryAlert.text, /HP EliteDesk Node is Back Online/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
