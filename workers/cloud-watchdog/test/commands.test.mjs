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
      if (urlStr.includes("api.telegram.org")) {
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
      if (urlStr.includes("api.telegram.org")) {
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
        return null;
      },
    };

    const envWithKv = { ...mockEnv, WATCHDOG_KV: mockKv };

    try {
      // 1. Test default /chart
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
      assert.match(sentCaption, /BIỂU ĐỒ ĐỘ TRỄ & TẢI HỆ THỐNG/);
      assert.match(sentPhotoUrl, /Cloud%20Latency/);

      // 2. Test /chart kuma
      await handleTelegramCommand(
        {
          update_id: 8,
          message: {
            message_id: 17,
            chat: { id: "-100999888777", type: "supergroup" },
            text: "/chart kuma",
            date: 1731670000,
          },
        },
        envWithKv
      );
      assert.match(sentCaption, /BIỂU ĐỒ ĐỘ TRỄ UPTIME KUMA/);
      assert.match(sentPhotoUrl, /Uptime%20Kuma/);
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
});
