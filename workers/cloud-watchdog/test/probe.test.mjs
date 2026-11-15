import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { executeProbe, handleWatchdogPulse } from "../src/index.ts";
import { sendTelegramAlert } from "../src/notifier.ts";

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
      assert.match(interceptedUrl, /api\.telegram\.org\/bottest-token\/sendMessage/);
      assert.match(interceptedBody, /12345678/);
      assert.match(interceptedBody, /CRITICAL ALERT/);
      assert.match(interceptedBody, /disconnected/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
