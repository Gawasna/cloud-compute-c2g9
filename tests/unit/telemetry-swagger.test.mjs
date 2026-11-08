import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RateLimiter, getClientIp } from "../../src/lib/security/rate-limit.ts";

describe("Telemetry Swagger & Multi-Mode Error Dispatch", () => {
  const rootDir = process.cwd();
  const telemetryRoutePath = path.resolve(
    rootDir,
    "src/app/api/debug/telemetry/route.ts"
  );
  const swaggerPagePath = path.resolve(rootDir, "src/app/swagger/page.tsx");

  it("should serve a valid OpenAPI 3.0.3 spec document", async () => {
    const { GET: getOpenApi } = await import(
      "../../src/app/swagger/openapi.json/route.ts"
    );
    const res = await getOpenApi();
    assert.equal(res.status, 200);

    const spec = await res.json();
    assert.equal(spec.openapi, "3.0.3");
    assert.equal(spec.info.title, "CloudStock Telemetry Trigger API");
    assert.ok(spec.paths["/api/debug/telemetry"]);
    assert.ok(spec.paths["/api/debug/telemetry"].get);
    assert.ok(spec.paths["/api/debug/telemetry"].post);

    const modeParam = spec.paths["/api/debug/telemetry"].get.parameters.find(
      (p) => p.name === "mode"
    );
    assert.ok(modeParam);
    assert.deepEqual(modeParam.schema.enum, [
      "loose",
      "strict",
      "api_500",
      "api_4xx",
      "unhandled",
    ]);

    assert.ok(spec.components.securitySchemes.SecretKeyHeader);
    assert.ok(spec.components.securitySchemes.SecretKeyQuery);
    assert.ok(spec.components.securitySchemes.BearerAuth);

    // Validate expanded business API paths
    assert.ok(spec.paths["/api/auth/login"], "OpenAPI must include auth login route");
    assert.ok(spec.paths["/api/auth/logout"], "OpenAPI must include auth logout route");
    assert.ok(spec.paths["/api/auth/me"], "OpenAPI must include auth me route");
    assert.ok(spec.paths["/api/products"], "OpenAPI must include products route");
    assert.ok(spec.paths["/api/movements"], "OpenAPI must include stock movements route");
    assert.ok(spec.paths["/api/reports/overview"], "OpenAPI must include reports overview route");
    assert.ok(spec.paths["/api/users"], "OpenAPI must include user management route");
  });

  it("should have Swagger UI distribution package installed and exportable", async () => {
    const swaggerModule = await import("swagger-ui-dist");
    assert.ok(swaggerModule.SwaggerUIBundle, "Must export SwaggerUIBundle");
    assert.ok(swaggerModule.SwaggerUIStandalonePreset, "Must export SwaggerUIStandalonePreset");
  });

  it("should have Swagger UI interactive page component at src/app/swagger/page.tsx", () => {
    assert.ok(fs.existsSync(swaggerPagePath), "Swagger page must exist");
    const content = fs.readFileSync(swaggerPagePath, "utf8");

    assert.ok(content.includes('"use client"'), "Must be a client component");
    assert.ok(content.includes("/api/debug/telemetry"), "Must target telemetry debug endpoint");
    assert.ok(content.includes("/swagger/openapi.json"), "Must reference openapi spec");
    assert.ok(content.includes("TELEMETRY_DEBUG_SECRET"), "Must mention secret authorization");

    // All 5 error modes must be defined in UI
    assert.ok(content.includes('"loose"'));
    assert.ok(content.includes('"strict"'));
    assert.ok(content.includes('"api_500"'));
    assert.ok(content.includes('"api_4xx"'));
    assert.ok(content.includes('"unhandled"'));
  });

  describe("API Route: /api/debug/telemetry implementation integrity", () => {
    it("should export dynamic = 'force-dynamic' and standard GET/POST methods", () => {
      assert.ok(fs.existsSync(telemetryRoutePath), "Route file must exist");
      const content = fs.readFileSync(telemetryRoutePath, "utf8");

      assert.ok(content.includes('export const dynamic = "force-dynamic"'));
      assert.ok(content.includes("export async function GET"));
      assert.ok(content.includes("export async function POST"));
    });

    it("should implement all 5 event modes and telemetry dispatching", () => {
      const content = fs.readFileSync(telemetryRoutePath, "utf8");

      assert.ok(content.includes('"loose"'));
      assert.ok(content.includes('"strict"'));
      assert.ok(content.includes('"api_500"'));
      assert.ok(content.includes('"api_4xx"'));
      assert.ok(content.includes('"unhandled"'));

      assert.ok(content.includes("captureLoose("));
      assert.ok(content.includes("captureStrict("));
      assert.ok(content.includes("flush(3000)"));
    });

    it("should enforce production authorization check and repo-hygiene 403 rule", () => {
      const content = fs.readFileSync(telemetryRoutePath, "utf8");

      assert.ok(content.includes('process.env.NODE_ENV === "production"'));
      assert.ok(content.includes("TELEMETRY_DEBUG_SECRET"));
      assert.ok(content.includes("403"));

      // Must satisfy repo-hygiene regex
      assert.match(content, /NODE_ENV === "production"[\s\S]{0,200}403/);
    });

    it("should enforce 5x/IP rate limiting mechanism with isolated mode buckets", () => {
      const content = fs.readFileSync(telemetryRoutePath, "utf8");

      assert.ok(content.includes("new RateLimiter(5, 60_000)"));
      assert.ok(content.includes("429"));
      assert.ok(content.includes("Retry-After"));
      assert.ok(content.includes("X-RateLimit-Remaining"));

      // Test rate limiter algorithm independently
      const limiter = new RateLimiter(5, 60_000);
      const testIp = "203.0.113.50";
      const mode = "strict";
      const key = `${testIp}:${mode}`;
      const now = 100_000;

      for (let i = 1; i <= 5; i++) {
        const res = limiter.check(key, now);
        assert.equal(res.allowed, true, `Hit ${i} should be allowed`);
        assert.equal(res.remaining, 5 - i);
      }

      // 6th hit should be blocked
      const blockedRes = limiter.check(key, now + 100);
      assert.equal(blockedRes.allowed, false);
      assert.equal(blockedRes.remaining, 0);
      assert.ok(blockedRes.retryAfter >= 1);

      // Different event mode for same IP must have independent quota
      const diffModeKey = `${testIp}:loose`;
      const diffModeRes = limiter.check(diffModeKey, now + 100);
      assert.equal(diffModeRes.allowed, true, "Different mode must have fresh bucket");
      assert.equal(diffModeRes.remaining, 4);

      // Different IP for same mode must have independent quota
      const diffIpKey = `203.0.113.99:${mode}`;
      const diffIpRes = limiter.check(diffIpKey, now + 100);
      assert.equal(diffIpRes.allowed, true, "Different IP must have fresh bucket");
      assert.equal(diffIpRes.remaining, 4);
    });

    it("should extract client IP properly for rate limiting", () => {
      const mockHeaders = {
        get: (name) => {
          if (name === "x-forwarded-for") return "198.51.100.22, 10.0.0.1";
          return null;
        },
      };
      assert.equal(getClientIp(mockHeaders), "198.51.100.22");
    });
  });
});
