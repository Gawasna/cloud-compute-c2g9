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
    const connectTokens = new Set(connect.split(" "));
    assert.equal(connectTokens.has("https://abc.supabase.co"), true);
    assert.equal(connectTokens.has("http://127.0.0.1:35800"), true);
    assert.equal(connectTokens.has("not a url"), false);
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
    assert.ok(proxy.includes('"/api/csp-report"'), "csp-report endpoint must have dedicated handling");
  });
  it("CSP includes report-to, report-uri, and Reporting-Endpoints header", () => {
    const defaultCsp = buildContentSecurityPolicy(env);
    assert.ok(defaultCsp.includes("report-to csp-endpoint"), "missing report-to directive in CSP");
    assert.ok(defaultCsp.includes("report-uri /api/csp-report"), "missing default report-uri in CSP");

    const customCsp = buildContentSecurityPolicy({ ...env, reportUri: "/custom/csp-report" });
    assert.ok(customCsp.includes("report-to csp-endpoint"), "missing report-to directive in custom CSP");
    assert.ok(customCsp.includes("report-uri /custom/csp-report"), "custom reportUri not respected in CSP");

    const headers = Object.fromEntries(buildSecurityHeaders(env).map((h) => [h.key, h.value]));
    assert.equal(headers["Reporting-Endpoints"], 'csp-endpoint="/api/csp-report"');

    const customHeaders = Object.fromEntries(
      buildSecurityHeaders({ ...env, reportUri: "/custom/csp-report" }).map((h) => [h.key, h.value])
    );
    assert.equal(customHeaders["Reporting-Endpoints"], 'csp-endpoint="/custom/csp-report"');
  });
  it("proxy configures /api/csp-report with CSRF bypass and writeLimiter", () => {
    const proxy = readFileSync("src/proxy.ts", "utf8");
    const cspIndex = proxy.indexOf('pathname === "/api/csp-report"');
    const csrfCallIndex = proxy.indexOf("const allowed = isRequestAllowedCsrf");
    assert.ok(cspIndex !== -1, "proxy must contain /api/csp-report handling");
    assert.ok(csrfCallIndex !== -1, "proxy must contain CSRF checking");
    assert.ok(cspIndex < csrfCallIndex, "/api/csp-report must precede CSRF validation to allow browser reporting");
    assert.ok(
      proxy.includes("writeLimiter.check(`write:${ip}`)") || proxy.includes("writeLimiter.check("),
      "csp-report must be rate-limited by writeLimiter"
    );
  });
  it("implements /api/csp-report route handler with captureLooseError and 204 response", () => {
    const routeSrc = readFileSync("src/app/api/csp-report/route.ts", "utf8");
    assert.ok(
      routeSrc.includes('import { captureLooseError } from "@/lib/observability"'),
      "route must import captureLooseError"
    );
    assert.ok(routeSrc.includes("export async function POST"), "route must export POST handler");
    assert.ok(routeSrc.includes('"csp.report-to"'), 'telemetry source must be "csp.report-to"');
    assert.ok(routeSrc.includes("status: 204"), "must return HTTP 204 No Content");
  });
  it("img-src and connect-src whitelist media worker origin without universal wildcard", () => {
    const defaultCsp = buildContentSecurityPolicy(env);
    const defaultImg = defaultCsp.split("; ").find((d) => d.startsWith("img-src"));
    const defaultConnect = defaultCsp.split("; ").find((d) => d.startsWith("connect-src"));
    const defaultImgTokens = new Set(defaultImg.split(" "));
    const defaultConnectTokens = new Set(defaultConnect.split(" "));

    assert.equal(defaultImgTokens.has("https://cc-media-worker.hunglepy05.workers.dev"), true);
    assert.equal(defaultConnectTokens.has("https://cc-media-worker.hunglepy05.workers.dev"), true);
    assert.ok(!/img-src[^;]*\s\*(\s|$)/.test(defaultImg), "img-src must not contain universal wildcard *");
    assert.ok(!/connect-src[^;]*\s\*(\s|$)/.test(defaultConnect), "connect-src must not contain universal wildcard *");

    const customCsp = buildContentSecurityPolicy({
      ...env,
      mediaOrigins: ["https://cdn.example.com/assets", undefined, "invalid-url"],
    });
    const customImg = customCsp.split("; ").find((d) => d.startsWith("img-src"));
    const customConnect = customCsp.split("; ").find((d) => d.startsWith("connect-src"));
    const customImgTokens = new Set(customImg.split(" "));
    const customConnectTokens = new Set(customConnect.split(" "));

    assert.equal(customImgTokens.has("https://cdn.example.com"), true);
    assert.equal(customConnectTokens.has("https://cdn.example.com"), true);
    assert.equal(customImgTokens.has("invalid-url"), false);
    assert.ok(!/img-src[^;]*\s\*(\s|$)/.test(customImg));
    assert.ok(!/connect-src[^;]*\s\*(\s|$)/.test(customConnect));
  });
});
