import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/index.ts";

/**
 * Mock implementation of Cloudflare R2Bucket
 */
class MockR2Bucket {
  constructor() {
    this.store = new Map();
  }

  async put(key, value, options = {}) {
    let buffer;
    if (value instanceof ArrayBuffer) {
      buffer = Buffer.from(value);
    } else if (Buffer.isBuffer(value)) {
      buffer = value;
    } else if (typeof value === "string") {
      buffer = Buffer.from(value);
    } else {
      buffer = Buffer.from(new Uint8Array(value));
    }

    const metadata = {
      key,
      size: buffer.byteLength,
      body: buffer,
      httpMetadata: options.httpMetadata || { contentType: "application/octet-stream" },
      httpEtag: `"${crypto.randomUUID()}"`,
      uploaded: new Date(),
    };

    this.store.set(key, metadata);
    return metadata;
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    return {
      key: item.key,
      size: item.size,
      body: item.body,
      httpMetadata: item.httpMetadata,
      httpEtag: item.httpEtag,
    };
  }

  async delete(key) {
    this.store.delete(key);
  }
}

function createTestEnv(overrides = {}) {
  const bucket = new MockR2Bucket();
  return {
    PRODUCT_MEDIA_BUCKET: bucket,
    ALLOWED_ORIGINS: "https://cloud-compute-c2g9.vercel.app,http://localhost:3000",
    PUBLIC_CDN_URL: "https://media.cloudstock.app",
    ...overrides,
  };
}

describe("Media Worker - CORS Handling", () => {
  it("should respond 204 for OPTIONS preflight with allowed origin", async () => {
    const env = createTestEnv();
    const request = new Request("https://media-worker.local/upload", {
      method: "OPTIONS",
      headers: {
        Origin: "https://cloud-compute-c2g9.vercel.app",
        "Access-Control-Request-Method": "POST",
      },
    });

    const res = await handleRequest(request, env);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://cloud-compute-c2g9.vercel.app");
    assert.ok(res.headers.get("Access-Control-Allow-Methods")?.includes("POST"));
  });

  it("should not reflect disallowed origin in CORS headers", async () => {
    const env = createTestEnv();
    const request = new Request("https://media-worker.local/health", {
      method: "GET",
      headers: {
        Origin: "https://evil-site.com",
      },
    });

    const res = await handleRequest(request, env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  });
});

describe("Media Worker - Health Check", () => {
  it("should return 200 with service status and bucket binding info", async () => {
    const env = createTestEnv();
    const request = new Request("https://media-worker.local/health", {
      method: "GET",
    });

    const res = await handleRequest(request, env);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.service, "cc-media-worker");
    assert.equal(body.bucket_bound, true);
    assert.ok(typeof body.timestamp === "number");
  });
});

describe("Media Worker - POST /upload Validation & Storage", () => {
  it("should reject non-webp MIME types with 415", async () => {
    const env = createTestEnv();
    const request = new Request("https://media-worker.local/upload", {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
      },
      body: new Uint8Array([1, 2, 3, 4]),
    });

    const res = await handleRequest(request, env);
    assert.equal(res.status, 415);
    const body = await res.json();
    assert.match(body.error, /Only image\/webp is accepted/);
  });

  it("should reject empty payload with 400", async () => {
    const env = createTestEnv();
    const request = new Request("https://media-worker.local/upload", {
      method: "POST",
      headers: {
        "Content-Type": "image/webp",
      },
      body: new Uint8Array([]),
    });

    const res = await handleRequest(request, env);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Empty payload/);
  });

  it("should reject payload exceeding 2MB limit with 413", async () => {
    const env = createTestEnv();
    const overSized = new Uint8Array(2 * 1024 * 1024 + 1); // 2MB + 1 byte
    const request = new Request("https://media-worker.local/upload", {
      method: "POST",
      headers: {
        "Content-Type": "image/webp",
      },
      body: overSized,
    });

    const res = await handleRequest(request, env);
    assert.equal(res.status, 413);
    const body = await res.json();
    assert.match(body.error, /exceeds 2MB limit/);
  });

  it("should accept valid webp within 2MB and store it in R2", async () => {
    const env = createTestEnv();
    const mockWebpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const request = new Request("https://media-worker.local/upload", {
      method: "POST",
      headers: {
        "Content-Type": "image/webp",
        Origin: "http://localhost:3000",
      },
      body: mockWebpBytes,
    });

    const res = await handleRequest(request, env);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.match(body.key, /^products\/\d+_[a-z0-9-]+\.webp$/);
    assert.equal(body.url, `https://media.cloudstock.app/${body.key}`);
    assert.equal(body.size, mockWebpBytes.byteLength);

    // Verify stored object in R2
    const stored = await env.PRODUCT_MEDIA_BUCKET.get(body.key);
    assert.ok(stored);
    assert.equal(stored.size, mockWebpBytes.byteLength);
    assert.equal(stored.httpMetadata.contentType, "image/webp");
  });

  it("should enforce UPLOAD_SECRET when configured", async () => {
    const env = createTestEnv({ UPLOAD_SECRET: "super-secret-key-123" });
    const mockWebpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

    // Unauthorized request
    const unauthorizedReq = new Request("https://media-worker.local/upload", {
      method: "POST",
      headers: {
        "Content-Type": "image/webp",
      },
      body: mockWebpBytes,
    });
    const unauthorizedRes = await handleRequest(unauthorizedReq, env);
    assert.equal(unauthorizedRes.status, 401);

    // Authorized request
    const authorizedReq = new Request("https://media-worker.local/upload", {
      method: "POST",
      headers: {
        "Content-Type": "image/webp",
        Authorization: "Bearer super-secret-key-123",
      },
      body: mockWebpBytes,
    });
    const authorizedRes = await handleRequest(authorizedReq, env);
    assert.equal(authorizedRes.status, 201);
  });
});

describe("Media Worker - GET /media/* Retrieval", () => {
  it("should serve existing image with proper cache and content-type headers", async () => {
    const env = createTestEnv();
    const fileBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0xaa, 0xbb]);
    const key = "products/test-image.webp";

    await env.PRODUCT_MEDIA_BUCKET.put(key, fileBytes, {
      httpMetadata: { contentType: "image/webp" },
    });

    const request = new Request(`https://media-worker.local/media/${key}`, {
      method: "GET",
    });

    const res = await handleRequest(request, env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "image/webp");
    assert.equal(res.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
    assert.ok(res.headers.get("ETag"));

    const buffer = await res.arrayBuffer();
    assert.equal(buffer.byteLength, fileBytes.byteLength);
  });

  it("should return 404 when file does not exist in R2", async () => {
    const env = createTestEnv();
    const request = new Request("https://media-worker.local/media/products/not-found.webp", {
      method: "GET",
    });

    const res = await handleRequest(request, env);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "Media not found");
  });

  it("should reject empty media key or invalid key with 400", async () => {
    const env = createTestEnv();
    const emptyKeyReq = new Request("https://media-worker.local/media/", {
      method: "GET",
    });
    const emptyRes = await handleRequest(emptyKeyReq, env);
    assert.equal(emptyRes.status, 400);
    const emptyBody = await emptyRes.json();
    assert.equal(emptyBody.error, "Invalid media key");

    const dotKeyReq = new Request("https://media-worker.local/media/..forbidden.webp", {
      method: "GET",
    });
    const dotRes = await handleRequest(dotKeyReq, env);
    assert.equal(dotRes.status, 400);
    const dotBody = await dotRes.json();
    assert.equal(dotBody.error, "Invalid media key");
  });
});
