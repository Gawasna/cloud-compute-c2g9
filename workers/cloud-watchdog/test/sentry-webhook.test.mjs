import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  verifySentrySecret,
  formatSentryAlert,
  handleSentryWebhook,
} from "../src/sentry.ts";

// In-memory mock for Cloudflare KVNamespace
function createMockKv() {
  const store = new Map();
  return {
    async get(key) {
      return store.get(key) || null;
    },
    async put(key, value, options) {
      store.set(key, { value, options });
    },
    async delete(key) {
      store.delete(key);
    },
    _store: store,
  };
}

describe("Sentry Webhook Ingestion & Telegram Dispatcher Tests", () => {
  const mockSecret = "sentry-super-secret-token-12345";
  const mockEnv = {
    SENTRY_WEBHOOK_SECRET: mockSecret,
    TELEGRAM_BOT_TOKEN: "mock-sentry-bot-token",
    TELEGRAM_CHAT_ID: "-1001234567890",
  };

  const samplePayload = {
    action: "created",
    issue: {
      id: "987654321",
      title: "TypeError: Cannot read properties of undefined (reading 'status')",
      culprit: "app/api/route.ts in GET",
      permalink: "https://sentry.io/organizations/cc-org/issues/987654321/",
      level: "error",
      project: {
        id: "101",
        name: "Cloud Inventory API",
        slug: "cloud-inventory-api",
      },
    },
    event: {
      event_id: "evt_abcdef123456",
      environment: "production",
      release: "v1.4.0@abc1234",
    },
  };

  describe("Secret Verification", () => {
    it("accepts valid token via x-sentry-token header", () => {
      const req = new Request("https://watchdog.internal/sentry-webhook", {
        headers: { "x-sentry-token": mockSecret },
      });
      assert.equal(verifySentrySecret(req, mockSecret), true);
    });

    it("accepts valid token via URL query parameter", () => {
      const req = new Request(`https://watchdog.internal/sentry-webhook?token=${mockSecret}`);
      assert.equal(verifySentrySecret(req, mockSecret), true);
    });

    it("rejects mismatched or missing secret token", () => {
      const wrongHeaderReq = new Request("https://watchdog.internal/sentry-webhook", {
        headers: { "x-sentry-token": "wrong-secret" },
      });
      assert.equal(verifySentrySecret(wrongHeaderReq, mockSecret), false);

      const noTokenReq = new Request("https://watchdog.internal/sentry-webhook");
      assert.equal(verifySentrySecret(noTokenReq, mockSecret), false);

      const noEnvSecretReq = new Request(`https://watchdog.internal/sentry-webhook?token=${mockSecret}`);
      assert.equal(verifySentrySecret(noEnvSecretReq, undefined), false);
    });
  });

  describe("Alert Formatting & Deep Linking", () => {
    it("formats HTML alert with title, culprit, environment, release, and Deep Link", () => {
      const html = formatSentryAlert(samplePayload);

      assert.match(html, /<b>\[SENTRY ALERT\] TypeError: Cannot read properties of undefined/);
      assert.match(html, /<b>Level:<\/b> <code>ERROR<\/code>/);
      assert.match(html, /<b>Project:<\/b> <code>Cloud Inventory API<\/code>/);
      assert.match(html, /<b>Culprit:<\/b> <code>app\/api\/route\.ts in GET<\/code>/);
      assert.match(html, /<b>Environment:<\/b> <code>production<\/code>/);
      assert.match(html, /<b>Release:<\/b> <code>v1\.4\.0@abc1234<\/code>/);
      assert.match(html, /<a href="https:\/\/sentry\.io\/organizations\/cc-org\/issues\/987654321\/">View Issue on Sentry<\/a>/);
      assert.match(html, /<i>Dispatched by Cloudflare Edge Watchdog<\/i>/);
    });

    it("safely escapes HTML characters in payload fields", () => {
      const maliciousPayload = {
        issue: {
          id: "1",
          title: "<script>alert('xss')</script> & dangerous <tag>",
          culprit: "user <input> & db",
          permalink: "https://sentry.io/test?a=1&b=2",
        },
      };

      const html = formatSentryAlert(maliciousPayload);
      assert.doesNotMatch(html, /<script/i);
      assert.match(html, /&lt;script&gt;alert\('xss'\)&lt;\/script&gt; &amp; dangerous &lt;tag&gt;/);
      assert.match(html, /user &lt;input&gt; &amp; db/);
    });
  });

  describe("handleSentryWebhook E2E Processing", () => {
    it("Test 1: Tu choi request neu sai secret token (HTTP 401)", async () => {
      const req = new Request("https://watchdog.internal/sentry-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sentry-token": "unauthorized-secret-xyz",
        },
        body: JSON.stringify(samplePayload),
      });

      const res = await handleSentryWebhook(req, mockEnv);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /Unauthorized/);
    });

    it("Test 2: Chap nhan request hop le va dispatch tin nhan Telegram dung format HTML kem Deep Link", async () => {
      let dispatchCalled = false;
      let sentEndpoint = "";
      let sentBody = null;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        dispatchCalled = true;
        sentEndpoint = String(url);
        sentBody = JSON.parse(String(options?.body || "{}"));
        return new Response(JSON.stringify({ ok: true, result: { message_id: 888 } }), { status: 200 });
      };

      try {
        const req = new Request("https://watchdog.internal/sentry-webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sentry-token": mockSecret,
          },
          body: JSON.stringify(samplePayload),
        });

        const res = await handleSentryWebhook(req, mockEnv);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.equal(data.dispatched, true);
        assert.equal(data.issue_id, "987654321");

        assert.equal(dispatchCalled, true);
        assert.equal(sentEndpoint, `https://api.telegram.org/bot${mockEnv.TELEGRAM_BOT_TOKEN}/sendMessage`);
        assert.equal(sentBody.chat_id, mockEnv.TELEGRAM_CHAT_ID);
        assert.equal(sentBody.parse_mode, "HTML");
        assert.match(sentBody.text, /View Issue on Sentry/);
        const hrefMatch = sentBody.text.match(/<a href="([^"]+)">/);
        assert.ok(hrefMatch, "Expected <a> tag in sentBody.text");
        const linkUrl = new URL(hrefMatch[1]);
        assert.equal(linkUrl.origin, "https://sentry.io");
        assert.equal(linkUrl.pathname, "/organizations/cc-org/issues/987654321/");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("Test 3: Deduplication ngan chan spam khi cung mot issue_id duoc goi 2 lan lien tiep", async () => {
      const mockKv = createMockKv();
      const envWithKv = { ...mockEnv, WATCHDOG_KV: mockKv };

      let dispatchCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        dispatchCount++;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      };

      try {
        // First call: Should dispatch
        const req1 = new Request("https://watchdog.internal/sentry-webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sentry-token": mockSecret,
          },
          body: JSON.stringify(samplePayload),
        });

        const res1 = await handleSentryWebhook(req1, envWithKv);
        assert.equal(res1.status, 200);
        const data1 = await res1.json();
        assert.equal(data1.ok, true);
        assert.equal(data1.dispatched, true);
        assert.equal(dispatchCount, 1);

        // Verify KV key stored with expirationTtl
        const storedEntry = mockKv._store.get("sentry:seen:987654321");
        assert.ok(storedEntry);
        assert.equal(storedEntry.options?.expirationTtl, 900); // 15 minutes = 900s

        // Second call (immediate subsequent): Should be deduplicated and NOT dispatch
        const req2 = new Request("https://watchdog.internal/sentry-webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sentry-token": mockSecret,
          },
          body: JSON.stringify(samplePayload),
        });

        const res2 = await handleSentryWebhook(req2, envWithKv);
        assert.equal(res2.status, 200);
        const data2 = await res2.json();
        assert.equal(data2.ok, true);
        assert.equal(data2.deduplicated, true);
        assert.match(data2.message, /Duplicate alert suppressed/);
        assert.equal(dispatchCount, 1, "Telegram fetch must not be called on duplicate");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("Test 4: Tu choi request voi JSON khong hop le (HTTP 400)", async () => {
      const req = new Request("https://watchdog.internal/sentry-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sentry-token": mockSecret,
        },
        body: "{ malformed json...",
      });

      const res = await handleSentryWebhook(req, mockEnv);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Invalid JSON/);
    });
  });
});
