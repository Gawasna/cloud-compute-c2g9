import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleTelegramCommand } from "../src/commands.ts";
import worker from "../src/index.ts";

describe("Telegram Slash Commands Handler Tests", () => {
  const mockEnv = {
    DEFAULT_HEALTH_ENDPOINT: "https://example.com/api/health",
    ALERT_SERVICE_NAME: "Test Cloud Platform",
    TELEGRAM_BOT_TOKEN: "mock-token-123",
    TELEGRAM_CHAT_ID: "-100999888777",
    TELEGRAM_WEBHOOK_SECRET: "test-secret-token-xyz",
  };

  it("silently ignores messages without command slash prefix", async () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    try {
      const update = {
        update_id: 1,
        message: {
          message_id: 10,
          chat: { id: "-100999888777", type: "supergroup" },
          text: "hello everyone",
          date: 1731670000,
        },
      };

      await handleTelegramCommand(update, mockEnv);
      assert.equal(fetchCalled, false, "Expected non-command message to be ignored");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("strictly rejects commands originating from unauthorized chats", async () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    try {
      const update = {
        update_id: 2,
        message: {
          message_id: 11,
          chat: { id: "12345678_unauthorized", type: "private" },
          text: "/status",
          date: 1731670000,
        },
      };

      await handleTelegramCommand(update, mockEnv);
      assert.equal(fetchCalled, false, "Expected unauthorized chat message to be rejected");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles /help command and delivers list of supported commands", async () => {
    let sentBody = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
      sentBody = String(options?.body || "");
      return new Response(JSON.stringify({ ok: true, result: { message_id: 100 } }), { status: 200 });
    };

    try {
      const update = {
        update_id: 3,
        message: {
          message_id: 12,
          chat: { id: "-100999888777", type: "supergroup" },
          text: "/help@c2g9_bot",
          date: 1731670000,
        },
      };

      await handleTelegramCommand(update, mockEnv);
      assert.match(sentBody, /DANH MỤC LỆNH GIÁM SÁT/);
      assert.match(sentBody, /\/status/);
      assert.match(sentBody, /\/ping/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles /ping command and returns pong edge latency", async () => {
    let sentBody = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.startsWith("https://api.telegram.org/")) {
        sentBody = String(options?.body || "");
        return new Response(JSON.stringify({ ok: true, result: { message_id: 101 } }), { status: 200 });
      }
      // Mock probe response
      return new Response(JSON.stringify({ status: "healthy" }), { status: 200 });
    };

    try {
      const update = {
        update_id: 4,
        message: {
          message_id: 13,
          chat: { id: "-100999888777", type: "supergroup" },
          text: "/ping",
          date: 1731670000,
        },
      };

      await handleTelegramCommand(update, mockEnv);
      assert.match(sentBody, /PONG/);
      assert.match(sentBody, /Edge Status/);
      assert.match(sentBody, /Network Latency/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles /status command and returns full system status snapshot", async () => {
    let sentBody = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.startsWith("https://api.telegram.org/")) {
        sentBody = String(options?.body || "");
        return new Response(JSON.stringify({ ok: true, result: { message_id: 102 } }), { status: 200 });
      }
      // Mock health endpoint response
      return new Response(
        JSON.stringify({
          status: "healthy",
          database: { status: "connected", latency_ms: 38 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const update = {
        update_id: 5,
        message: {
          message_id: 14,
          chat: { id: "-100999888777", type: "supergroup" },
          text: "/status",
          date: 1731670000,
        },
      };

      await handleTelegramCommand(update, mockEnv);
      assert.match(sentBody, /HỆ THỐNG GIÁM SÁT TOÀN DIỆN|SYSTEM SNAPSHOT/);
      assert.match(sentBody, /HOẠT ĐỘNG BÌNH THƯỜNG/);
      assert.match(sentBody, /connected/);
      assert.match(sentBody, /200/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles invalid commands with helpful guidance", async () => {
    let sentBody = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
      sentBody = String(options?.body || "");
      return new Response(JSON.stringify({ ok: true, result: { message_id: 103 } }), { status: 200 });
    };

    try {
      const update = {
        update_id: 6,
        message: {
          message_id: 15,
          chat: { id: "-100999888777", type: "supergroup" },
          text: "/foobar",
          date: 1731670000,
        },
      };

      await handleTelegramCommand(update, mockEnv);
      assert.match(sentBody, /Lệnh không hợp lệ/);
      assert.match(sentBody, /\/help/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles /chart and /chart kuma commands delivering quickchart images", async () => {
    let sentPhotoUrl = "";
    let sentCaption = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes("sendPhoto")) {
        const body = JSON.parse(String(options?.body || "{}"));
        sentPhotoUrl = body.photo;
        sentCaption = body.caption;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 104 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const mockKv = {
      async get(key) {
        if (key === "telemetry:ring_buffer") {
          return [
            { ts: 1731690000, cloud_duration_ms: 250, hp_load: 0.15, kuma_supabase_ping_ms: 450, kuma_vercel_ping_ms: 1200 },
            { ts: 1731690600, cloud_duration_ms: 320, hp_load: 0.18, kuma_supabase_ping_ms: 460, kuma_vercel_ping_ms: 1100 },
          ];
        }
        if (key === "dms:elitedesk:state") {
          return {
            node: "elitedesk-mint",
            last_seen_epoch: 1731690600000,
            kuma: {
              status: "up",
              monitors_total: 7,
              monitors_up: 7,
              monitors_down: 0,
              uptime_24h_percent: 100.0,
              supabase_db_ping_ms: 488,
              vercel_api_ping_ms: 1295,
              internet_uplink_ping_ms: 15,
              failed_events: [
                { monitor_id: 1, monitor_name: "Supabase DB", time: "2026-11-15 08:00", msg: "Timeout", ping: 10000 }
              ],
              series: [
                { time: "05:00", supabase_ping: 500, vercel_health_ping: 1300, vercel_front_ping: 160, uplink_ping: 20 },
                { time: "06:00", supabase_ping: 510, vercel_health_ping: 1250, vercel_front_ping: 155, uplink_ping: 19 },
              ]
            }
          };
        }
        return null;
      },
    };

    const envWithKv = { ...mockEnv, WATCHDOG_KV: mockKv };

    try {
      // 1. Test default /chart (Cloud mode)
      await handleTelegramCommand(
        {
          update_id: 7,
          message: {
            message_id: 16,
            chat: { id: "-100999888777", type: "supergroup" },
            text: "/chart",
            date: 1731670000,
          },
        },
        envWithKv
      );
      assert.match(sentCaption, /BIỂU ĐỒ HIỆU NĂNG CLOUD/);
      assert.match(sentPhotoUrl, /Cloud%20Latency/);

      // 2. Test /chart node (HP node hardware mode)
      await handleTelegramCommand(
        {
          update_id: 8,
          message: {
            message_id: 17,
            chat: { id: "-100999888777", type: "supergroup" },
            text: "/chart node",
            date: 1731670000,
          },
        },
        envWithKv
      );
      assert.match(sentCaption, /BIỂU ĐỒ TÀI NGUYÊN MÁY CHỦ HP NODE/);
      assert.match(sentCaption, /CPU Load Avg TB/);
      assert.match(sentPhotoUrl, /HP%20EliteDesk/);

      // 3. Test /chart kuma
      await handleTelegramCommand(
        {
          update_id: 9,
          message: {
            message_id: 18,
            chat: { id: "-100999888777", type: "supergroup" },
            text: "/chart kuma",
            date: 1731670000,
          },
        },
        envWithKv
      );
      assert.match(sentCaption, /BIỂU ĐỒ ĐỘ TRỄ 8H UPTIME KUMA/);
      assert.match(sentCaption, /Sự kiện lỗi/);
      assert.match(sentCaption, /Supabase DB: Timeout/);
      assert.match(sentPhotoUrl, /Uptime%20Kuma%208-Hour/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("validates secret token on POST /telegram-webhook endpoint", async () => {
    // 1. Invalid secret token returns 403
    const badReq = new Request("http://localhost/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": "wrong-secret",
      },
      body: JSON.stringify({ update_id: 10 }),
    });

    const badRes = await worker.fetch(badReq, mockEnv);
    assert.equal(badRes.status, 403);

    // 2. Valid secret token returns 200
    const goodReq = new Request("http://localhost/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": "test-secret-token-xyz",
      },
      body: JSON.stringify({
        update_id: 11,
        message: {
          message_id: 20,
          chat: { id: "-100999888777", type: "supergroup" },
          text: "/ping",
          date: 1731670000,
        },
      }),
    });

    const goodRes = await worker.fetch(goodReq, mockEnv, { waitUntil: () => {} });
    assert.equal(goodRes.status, 200);
  });

  it("WE3: /ping distinguishes network reachability from application status (e.g. HTTP 503)", async () => {
    let sentBody = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.startsWith("https://api.telegram.org/")) {
        sentBody = String(options?.body || "");
        return new Response(JSON.stringify({ ok: true, result: { message_id: 105 } }), { status: 200 });
      }
      // Target returns HTTP 503 Degraded
      return new Response(JSON.stringify({ status: "degraded" }), { status: 503 });
    };

    try {
      const update = {
        update_id: 12,
        message: {
          message_id: 21,
          chat: { id: "-100999888777", type: "supergroup" },
          text: "/ping",
          date: 1731670000,
        },
      };

      await handleTelegramCommand(update, mockEnv);
      assert.match(sentBody, /Reached \(HTTP 503 - App Degraded\)/);
      assert.doesNotMatch(sentBody, /Unreachable/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("WE5: /chart kuma fallback computes and displays real failed events instead of hardcoding 0", async () => {
    let sentPhotoUrl = "";
    let sentCaption = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes("sendPhoto")) {
        const body = JSON.parse(String(options?.body || "{}"));
        sentPhotoUrl = body.photo;
        sentCaption = body.caption;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 106 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const mockKv = {
      async get(key) {
        if (key === "telemetry:ring_buffer") {
          return [
            { ts: 1731690000, kuma_supabase_ping_ms: 450 },
            { ts: 1731690600, kuma_supabase_ping_ms: 460 },
          ];
        }
        if (key === "dms:elitedesk:state") {
          return {
            node: "elitedesk-mint",
            last_seen_epoch: 1731690600000,
            kuma: {
              status: "up",
              // series is missing or empty, forcing fallback path
              failed_events: [
                { monitor_id: 2, monitor_name: "Tailscale Subnet", time: "2026-11-15 10:00", msg: "Peer timeout" },
                { monitor_id: 3, monitor_name: "Vercel API", time: "2026-11-15 10:05", msg: "HTTP 504" },
              ]
            }
          };
        }
        return null;
      },
    };

    try {
      await handleTelegramCommand(
        {
          update_id: 13,
          message: {
            message_id: 22,
            chat: { id: "-100999888777", type: "supergroup" },
            text: "/chart kuma",
            date: 1731670000,
          },
        },
        { ...mockEnv, WATCHDOG_KV: mockKv }
      );

      assert.match(sentCaption, /2 sự cố gần nhất/);
      assert.match(sentCaption, /Tailscale Subnet: Peer timeout/);
      assert.match(sentCaption, /Vercel API: HTTP 504/);
      assert.doesNotMatch(sentCaption, /0 sự cố/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("M3: /silence activates silence flag in KV with TTL and rejects invalid range", async () => {
    let sentBody = "";
    const kvStore = new Map();
    const mockKv = {
      async get(key) {
        return kvStore.get(key) || null;
      },
      async put(key, value, options) {
        kvStore.set(key, { value, options });
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
      sentBody = String(options?.body || "");
      return new Response(JSON.stringify({ ok: true, result: { message_id: 107 } }), { status: 200 });
    };

    try {
      // 1. Invalid minutes (< 5)
      await handleTelegramCommand(
        {
          update_id: 14,
          message: {
            message_id: 23,
            chat: { id: "-100999888777", type: "supergroup" },
            text: "/silence 2",
            date: 1731670000,
          },
        },
        { ...mockEnv, WATCHDOG_KV: mockKv }
      );
      assert.match(sentBody, /Thời gian im lặng không hợp lệ/);
      assert.equal(kvStore.has("watchdog:silence:active"), false);

      // 2. Valid silence: 60 minutes
      await handleTelegramCommand(
        {
          update_id: 15,
          message: {
            message_id: 24,
            chat: { id: "-100999888777", type: "supergroup" },
            text: "/silence 60",
            date: 1731670000,
          },
        },
        { ...mockEnv, WATCHDOG_KV: mockKv }
      );
      assert.match(sentBody, /CHẾ ĐỘ IM LẶNG/);
      assert.match(sentBody, /60 phút/);
      assert.equal(kvStore.has("watchdog:silence:active"), true);
      assert.equal(kvStore.get("watchdog:silence:active").options.expirationTtl, 3600);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("UX2 & UX1: /status includes Supabase Latency State and GMT+7 timestamp", async () => {
    let sentBody = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.startsWith("https://api.telegram.org/")) {
        sentBody = String(options?.body || "");
        return new Response(JSON.stringify({ ok: true, result: { message_id: 108 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: "healthy", database: { status: "connected", latency_ms: 45 } }), { status: 200 });
    };

    const mockKv = {
      async get(key) {
        if (key === "supabase:latency:state") {
          return JSON.stringify({
            last_latency_ms: 2850,
            alerted_degraded: true,
            consecutive_degraded: 3,
            last_updated: "2026-11-17T11:00:00Z",
          });
        }
        return null;
      },
    };

    try {
      await handleTelegramCommand(
        {
          update_id: 16,
          message: {
            message_id: 25,
            chat: { id: "-100999888777", type: "supergroup" },
            text: "/status",
            date: 1731670000,
          },
        },
        { ...mockEnv, WATCHDOG_KV: mockKv }
      );
      assert.match(sentBody, /Supabase Latency State/);
      assert.match(sentBody, /2850ms/);
      assert.match(sentBody, /CẢNH BÁO SUY GIẢM/);
      assert.match(sentBody, /GMT\+7/);
      assert.match(sentBody, /💡 Gõ \/status/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("UX3: /dms returns on-premise node summary without probing cloud", async () => {
    let sentBody = "";
    let cloudProbed = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.startsWith("https://api.telegram.org/")) {
        sentBody = String(options?.body || "");
        return new Response(JSON.stringify({ ok: true, result: { message_id: 109 } }), { status: 200 });
      }
      cloudProbed = true;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const mockKv = {
      async get(key) {
        if (key === "dms:elitedesk:state") {
          return {
            node: "elitedesk-mint",
            last_seen_epoch: Date.now() - 120000, // 2 minutes ago
            load_avg: 0.22,
            memory_used_mb: 3100,
            memory_total_mb: 7712,
            disk_used_percent: 42,
            kuma: {
              status: "up",
              monitors_total: 5,
              monitors_up: 5,
              monitors_down: 0,
            },
            bugsink: {
              status: "ok",
              total_issues: 4,
              total_events: 18,
            }
          };
        }
        return null;
      },
    };

    try {
      await handleTelegramCommand(
        {
          update_id: 17,
          message: {
            message_id: 26,
            chat: { id: "-100999888777", type: "supergroup" },
            text: "/dms",
            date: 1731670000,
          },
        },
        { ...mockEnv, WATCHDOG_KV: mockKv }
      );
      assert.equal(cloudProbed, false, "Expected /dms NOT to probe cloud endpoint");
      assert.match(sentBody, /TRẠNG THÁI HẠ TẦNG ON-PREMISE/);
      assert.match(sentBody, /elitedesk-mint/);
      assert.match(sentBody, /ONLINE/);
      assert.match(sentBody, /3100 MB \/ 7712 MB/);
      assert.match(sentBody, /Bugsink/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("UX4: /chart bugsink generates BugSink error tracking chart", async () => {
    let sentPhotoUrl = "";
    let sentCaption = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes("sendPhoto")) {
        const body = JSON.parse(String(options?.body || "{}"));
        sentPhotoUrl = body.photo;
        sentCaption = body.caption;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 110 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const mockKv = {
      async get(key) {
        if (key === "telemetry:ring_buffer") {
          return [
            { ts: 1731690000, bugsink_events: 10, bugsink_issues: 3 },
            { ts: 1731690600, bugsink_events: 25, bugsink_issues: 5 },
          ];
        }
        if (key === "dms:elitedesk:state") {
          return {
            node: "elitedesk-mint",
            last_seen_epoch: 1731690600000,
            bugsink: {
              status: "ok",
              total_issues: 5,
              total_events: 25,
            }
          };
        }
        return null;
      },
    };

    try {
      await handleTelegramCommand(
        {
          update_id: 18,
          message: {
            message_id: 27,
            chat: { id: "-100999888777", type: "supergroup" },
            text: "/chart bugsink",
            date: 1731670000,
          },
        },
        { ...mockEnv, WATCHDOG_KV: mockKv }
      );
      assert.match(sentCaption, /BIỂU ĐỒ SỰ CỐ BUGSINK/);
      assert.match(sentCaption, /25/);
      assert.match(sentCaption, /5/);
      assert.match(sentPhotoUrl, /BugSink%20Issue%20Tracker%20Telemetry/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("WE7: GMT+7 hour calculation wraps around 24 correctly without overflow", () => {
    // 1731693600 is 18:00:00 UTC. 18 + 7 = 25 -> 25 % 24 = 01 (GMT+7)
    const d = new Date(Date.UTC(2026, 10, 15, 18, 30, 0));
    const hh = String((d.getUTCHours() + 7) % 24).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    assert.equal(`${hh}:${mm}`, "01:30");
  });
});
