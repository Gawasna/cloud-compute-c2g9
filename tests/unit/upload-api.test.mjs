import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  processMediaUpload,
  MAX_UPLOAD_SIZE_BYTES,
  DEFAULT_MEDIA_WORKER_UPLOAD_URL,
  ApiError,
} from "../../src/lib/media/upload-pipeline.ts";
import { uploadProductImage } from "../../src/lib/media/client-preprocessor.ts";

describe("Unit: Next.js /api/upload Route Handler & Media Pipeline", () => {
  const routeFilePath = path.resolve(process.cwd(), "src/app/api/upload/route.ts");

  it("should have route.ts existing and enforce 'server-only' at line 1", () => {
    assert.ok(fs.existsSync(routeFilePath), "src/app/api/upload/route.ts must exist");
    const content = fs.readFileSync(routeFilePath, "utf8");
    const lines = content.split(/\r?\n/);
    assert.strictEqual(
      lines[0].trim(),
      'import "server-only";',
      "route.ts must declare 'server-only' at line 1"
    );
  });

  it("should secure POST endpoint using createApiHandler with roles ['admin', 'staff']", () => {
    const content = fs.readFileSync(routeFilePath, "utf8");
    assert.ok(
      content.includes("export const POST = createApiHandler("),
      "route.ts must export POST handler wrapped in createApiHandler"
    );
    assert.ok(
      content.includes('roles: ["admin", "staff"]') || content.includes("roles: ['admin', 'staff']"),
      "route.ts must restrict access to 'admin' and 'staff' roles"
    );
  });
});

describe("Unit: Media Ingest Pipeline Validation & Forwarding (processMediaUpload)", () => {
  it("should reject non-WebP Content-Type with 415 Unsupported Media Type", async () => {
    const nonWebpTypes = ["image/jpeg", "image/png", "application/octet-stream", "text/plain", "image/gif"];

    for (const mime of nonWebpTypes) {
      const dummyPayload = new Uint8Array([1, 2, 3, 4]);
      const req = new Request("http://localhost:3000/api/upload", {
        method: "POST",
        headers: { "Content-Type": mime },
        body: dummyPayload,
      });

      await assert.rejects(
        () => processMediaUpload(req),
        (err) => {
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.statusCode, 415);
          assert.match(err.message, /Unsupported Media Type/i);
          return true;
        },
        `Expected 415 for MIME: ${mime}`
      );
    }
  });

  it("should reject empty file body with 400 Bad Request", async () => {
    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { "Content-Type": "image/webp" },
      body: new Uint8Array([]),
    });

    await assert.rejects(
      () => processMediaUpload(req),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /Empty image file/i);
        return true;
      }
    );
  });

  it("should reject payload exceeding 2MB maximum limit with 413", async () => {
    // 2MB + 1 byte
    const oversizedPayload = new Uint8Array(MAX_UPLOAD_SIZE_BYTES + 1);
    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { "Content-Type": "image/webp" },
      body: oversizedPayload,
    });

    await assert.rejects(
      () => processMediaUpload(req),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 413);
        assert.match(err.message, /Image exceeds maximum allowed size of 2MB/i);
        return true;
      }
    );
  });

  it("should reject multipart form data with non-WebP file with 415", async () => {
    const formData = new FormData();
    const fakePng = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    formData.append("file", fakePng, "test.png");

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    await assert.rejects(
      () => processMediaUpload(req),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 415);
        return true;
      }
    );
  });

  it("should reject multipart form data without 'file' field with 400", async () => {
    const formData = new FormData();
    formData.append("other_field", "value");

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    await assert.rejects(
      () => processMediaUpload(req),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        return true;
      }
    );
  });

  it("should forward binary WebP buffer to Cloudflare Media Worker and normalize URL", async () => {
    const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders = null;
    let capturedBody = null;

    const mockFetcher = async (url, init) => {
      capturedUrl = url;
      capturedMethod = init.method;
      capturedHeaders = init.headers;
      capturedBody = init.body;

      return new Response(
        JSON.stringify({
          success: true,
          key: "products/1700000000_abc12345.webp",
          url: "https://media.cloudstock.app/products/1700000000_abc12345.webp",
          size: webpBytes.byteLength,
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    };

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { "Content-Type": "image/webp" },
      body: webpBytes,
    });

    const result = await processMediaUpload(req, { fetcher: mockFetcher });

    assert.strictEqual(capturedUrl, DEFAULT_MEDIA_WORKER_UPLOAD_URL);
    assert.strictEqual(capturedMethod, "POST");
    assert.strictEqual(capturedHeaders["Content-Type"], "image/webp");
    assert.strictEqual(capturedBody.byteLength, webpBytes.byteLength);

    assert.deepStrictEqual(result, {
      success: true,
      url: "https://cc-media-worker.hunglepy05.workers.dev/media/products/1700000000_abc12345.webp",
      key: "products/1700000000_abc12345.webp",
      size: webpBytes.byteLength,
    });
  });

  it("should handle multipart form data upload and forward WebP buffer", async () => {
    const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const formData = new FormData();
    const webpBlob = new Blob([webpBytes], { type: "image/webp" });
    formData.append("file", webpBlob, "sample.webp");

    const mockFetcher = async () => {
      return new Response(
        JSON.stringify({
          success: true,
          key: "products/test_form.webp",
          url: "https://media.cloudstock.app/products/test_form.webp",
          size: webpBytes.byteLength,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const result = await processMediaUpload(req, { fetcher: mockFetcher });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.key, "products/test_form.webp");
    assert.strictEqual(
      result.url,
      "https://cc-media-worker.hunglepy05.workers.dev/media/products/test_form.webp"
    );
  });

  it("should throw ApiError with 502 when Cloudflare Media Worker returns 500 error", async () => {
    const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    const mockFetcher = async () => {
      return new Response("Storage bucket not bound", { status: 500 });
    };

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { "Content-Type": "image/webp" },
      body: webpBytes,
    });

    await assert.rejects(
      () => processMediaUpload(req, { fetcher: mockFetcher }),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 502);
        assert.match(err.message, /Media Worker error/i);
        return true;
      }
    );
  });
});

describe("Unit: Client Preprocessor uploadProductImage helper", () => {
  const originalFetch = globalThis.fetch;

  it("should successfully send POST request to /api/upload with image/webp Content-Type", async () => {
    const dummyBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/webp" });
    let requestedUrl = "";
    let requestedHeaders = null;

    globalThis.fetch = async (url, options) => {
      requestedUrl = url;
      requestedHeaders = options.headers;
      return new Response(
        JSON.stringify({
          success: true,
          url: "https://cc-media-worker.hunglepy05.workers.dev/media/products/item.webp",
          key: "products/item.webp",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const res = await uploadProductImage(dummyBlob);
      assert.strictEqual(requestedUrl, "/api/upload");
      assert.strictEqual(requestedHeaders["Content-Type"], "image/webp");
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.url, "https://cc-media-worker.hunglepy05.workers.dev/media/products/item.webp");
      assert.strictEqual(res.key, "products/item.webp");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should catch API error response and return { success: false, error }", async () => {
    const dummyBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/webp" });

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ message: "Image exceeds maximum allowed size of 2MB" }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const res = await uploadProductImage(dummyBlob);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, "Image exceeds maximum allowed size of 2MB");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should catch network exceptions and return { success: false, error }", async () => {
    const dummyBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/webp" });

    globalThis.fetch = async () => {
      throw new Error("Connection reset by peer");
    };

    try {
      const res = await uploadProductImage(dummyBlob);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, "Connection reset by peer");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
