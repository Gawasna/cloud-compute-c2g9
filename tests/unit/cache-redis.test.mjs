import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getCache,
  setCache,
  deleteCache,
  getOrSetCache,
  invalidateInventoryCaches,
  DEFAULT_CACHE_TTL,
  INVENTORY_CACHE_KEYS,
} from "../../src/lib/cache/client.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");

describe("Unit: Upstash Redis / Vercel KV Cache-Aside & Graceful Degradation", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  it("should enforce 'server-only' import at line 1 in src/lib/cache/redis.ts facade", () => {
    const file = path.join(ROOT_DIR, "src/lib/cache/redis.ts");
    const content = fs.readFileSync(file, "utf8");
    const firstLine = content.split(/\r?\n/)[0].trim();
    assert.strictEqual(firstLine, 'import "server-only";', "redis.ts must declare server-only at line 1");
  });

  it("should define DEFAULT_CACHE_TTL as 300 seconds and include all inventory report keys", () => {
    assert.strictEqual(DEFAULT_CACHE_TTL, 300);
    assert.ok(INVENTORY_CACHE_KEYS.includes("cache:reports:trend:day"));
    assert.ok(INVENTORY_CACHE_KEYS.includes("cache:reports:trend:week"));
    assert.ok(INVENTORY_CACHE_KEYS.includes("cache:reports:trend:month"));
    assert.ok(INVENTORY_CACHE_KEYS.includes("cache:dashboard:summary"));
    assert.ok(INVENTORY_CACHE_KEYS.includes("cache:reports:overview"));
  });

  describe("Graceful Degradation without Redis credentials", () => {
    it("should return null on getCache when environment variables are missing", async () => {
      const res = await getCache("test:key");
      assert.strictEqual(res, null);
    });

    it("should return false on setCache when environment variables are missing", async () => {
      const res = await setCache("test:key", { foo: "bar" });
      assert.strictEqual(res, false);
    });

    it("should return false on deleteCache when environment variables are missing", async () => {
      const res = await deleteCache("test:key");
      assert.strictEqual(res, false);
    });

    it("should fallback to fetcher in getOrSetCache when environment variables are missing", async () => {
      let fetcherCalled = false;
      const res = await getOrSetCache("test:key", async () => {
        fetcherCalled = true;
        return { value: 123 };
      });

      assert.strictEqual(fetcherCalled, true);
      assert.deepStrictEqual(res, { data: { value: 123 }, cached: false });
    });
  });

  describe("HTTP REST Protocol & Cache-Aside with credentials", () => {
    const mockUrl = "https://mock-redis.upstash.io";
    const mockToken = "A123_upstash_mock_token";

    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = mockUrl;
      process.env.UPSTASH_REDIS_REST_TOKEN = mockToken;
    });

    it("should send correct HTTP headers and GET command over REST API", async () => {
      let interceptedReq = null;
      globalThis.fetch = async (url, options) => {
        interceptedReq = { url, options };
        return {
          ok: true,
          json: async () => ({ result: JSON.stringify({ count: 100 }) }),
        };
      };

      const result = await getCache("cache:test:metric");
      assert.deepStrictEqual(result, { count: 100 });
      assert.strictEqual(interceptedReq.url, mockUrl);
      assert.strictEqual(interceptedReq.options.headers.Authorization, `Bearer ${mockToken}`);
      assert.deepStrictEqual(JSON.parse(interceptedReq.options.body), ["GET", "cache:test:metric"]);
    });

    it("should return null on cache miss (nil result from Upstash)", async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ result: null }),
      });

      const result = await getCache("cache:test:miss");
      assert.strictEqual(result, null);
    });

    it("should send SET command with EX expiration and return true on OK", async () => {
      let interceptedReq = null;
      globalThis.fetch = async (url, options) => {
        interceptedReq = { url, options };
        return {
          ok: true,
          json: async () => ({ result: "OK" }),
        };
      };

      const payload = { total: 50 };
      const success = await setCache("cache:dashboard:summary", payload, 600);
      assert.strictEqual(success, true);
      const parsedBody = JSON.parse(interceptedReq.options.body);
      assert.deepStrictEqual(parsedBody, ["SET", "cache:dashboard:summary", JSON.stringify(payload), "EX", 600]);
    });

    it("should send DEL command with multiple keys on invalidateInventoryCaches", async () => {
      let deletedKeys = null;
      globalThis.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body[0] === "DEL") {
          deletedKeys = body.slice(1);
        }
        return {
          ok: true,
          json: async () => ({ result: 5 }),
        };
      };

      const success = await invalidateInventoryCaches();
      assert.strictEqual(success, true);
      assert.deepStrictEqual(deletedKeys, [...INVENTORY_CACHE_KEYS]);
    });

    it("should support Vercel KV aliases (KV_REST_API_URL and KV_REST_API_TOKEN)", async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      process.env.KV_REST_API_URL = "https://vercel-kv.mock.io/";
      process.env.KV_REST_API_TOKEN = "vercel_kv_token_secret";

      let capturedUrl = null;
      let capturedAuth = null;
      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedAuth = options.headers.Authorization;
        return {
          ok: true,
          json: async () => ({ result: JSON.stringify({ active: true }) }),
        };
      };

      const res = await getCache("test:kv:alias");
      assert.deepStrictEqual(res, { active: true });
      assert.strictEqual(capturedUrl, "https://vercel-kv.mock.io");
      assert.strictEqual(capturedAuth, "Bearer vercel_kv_token_secret");
    });
  });

  describe("Failure Engineering & Network Fault Tolerance", () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "mock_token";
    });

    it("should gracefully handle HTTP 500 error from Upstash REST API", async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 500,
      });

      const res = await getCache("test:down");
      assert.strictEqual(res, null, "Should return null on HTTP error without throwing");
    });

    it("should gracefully handle fetch rejection (network failure / connection reset)", async () => {
      globalThis.fetch = async () => {
        throw new Error("getaddrinfo ENOTFOUND mock-redis.upstash.io");
      };

      const res = await getCache("test:error");
      assert.strictEqual(res, null, "Should return null on network crash");

      let fetcherInvoked = false;
      const getOrSetRes = await getOrSetCache("test:error", async () => {
        fetcherInvoked = true;
        return { status: "fallback_executed" };
      });

      assert.strictEqual(fetcherInvoked, true);
      assert.deepStrictEqual(getOrSetRes, {
        data: { status: "fallback_executed" },
        cached: false,
      });
    });

    it("should handle corrupted / non-JSON responses safely", async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ result: "{ invalid json ... " }),
      });

      const res = await getCache("test:corrupted");
      assert.strictEqual(res, null, "Should catch JSON parse error and return null");
    });
  });
});
