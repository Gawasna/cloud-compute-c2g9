import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "../../src/lib/security/headers.ts";

const env = { isProd: true, supabaseUrl: "https://abc.supabase.co", telemetryDsns: ["https://k@o1.ingest.sentry.io/2", "http://k@127.0.0.1:35800/1", undefined, "not a url"] };

describe("Security: HTTP security headers", () => {
  it("CSP forbids framing, plugins and foreign base/form targets", () => {
    const csp = buildContentSecurityPolicy(env);
    for (const d of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "upgrade-insecure-requests"]) {
      assert.ok(csp.includes(d), `missing ${d}`);
    }
  });
  it("production CSP has no unsafe-eval, dev CSP allows HMR", () => {
    assert.ok(!buildContentSecurityPolicy(env).includes("unsafe-eval"));
    assert.ok(buildContentSecurityPolicy({ ...env, isProd: false }).includes("unsafe-eval"));
  });
  it("connect-src only whitelists Supabase + telemetry origins (invalid DSNs ignored)", () => {
    const connect = buildContentSecurityPolicy(env).split("; ").find((d) => d.startsWith("connect-src"));
    assert.ok(connect.includes("https://abc.supabase.co"));
    assert.ok(connect.includes("http://127.0.0.1:35800"));
    assert.ok(!connect.includes("not a url"));
    assert.ok(!/connect-src[^;]*\s\*(\s|$)/.test(connect));
  });
  it("sets the standard hardening headers, HSTS only in production", () => {
    const prod = Object.fromEntries(buildSecurityHeaders(env).map((h) => [h.key, h.value]));
    assert.equal(prod["X-Content-Type-Options"], "nosniff");
    assert.equal(prod["X-Frame-Options"], "DENY");
    assert.ok(prod["Strict-Transport-Security"].includes("max-age="));
    assert.ok(prod["Referrer-Policy"]);
    assert.ok(prod["Permissions-Policy"].includes("camera=()"));
    const dev = Object.fromEntries(buildSecurityHeaders({ ...env, isProd: false }).map((h) => [h.key, h.value]));
    assert.equal(dev["Strict-Transport-Security"], undefined);
  });
  it("next.config wires the headers and disables x-powered-by; proxy rate-limits /api", () => {
    const cfg = readFileSync("next.config.ts", "utf8");
    assert.ok(cfg.includes("buildSecurityHeaders") && cfg.includes("poweredByHeader: false"));
    const proxy = readFileSync("src/proxy.ts", "utf8");
    assert.ok(proxy.includes("/api/:path*") && proxy.includes("429"));
    assert.ok(proxy.includes('"/api/health"'), "health endpoint must stay exempt for uptime monitors");
  });
});
