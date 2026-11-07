import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isRequestAllowedCsrf } from "../../src/lib/security/csrf.ts";

const base = { method: "POST", origin: null, host: "app.example.com", secFetchSite: null, hasAuthorizationHeader: false };

describe("Security: CSRF guard for cookie-authenticated requests", () => {
  it("safe methods are always allowed", () => {
    for (const method of ["GET", "HEAD", "OPTIONS", "get"]) {
      assert.equal(isRequestAllowedCsrf({ ...base, method, secFetchSite: "cross-site" }), true);
    }
  });

  it("state-changing requests: same-origin allowed, cross-site / same-site / none blocked (Sec-Fetch-Site)", () => {
    assert.equal(isRequestAllowedCsrf({ ...base, secFetchSite: "same-origin" }), true);
    for (const v of ["cross-site", "same-site", "none"]) {
      assert.equal(isRequestAllowedCsrf({ ...base, secFetchSite: v }), false, v);
    }
  });

  it("falls back to the Origin header when Sec-Fetch-Site is missing", () => {
    assert.equal(isRequestAllowedCsrf({ ...base, origin: "https://app.example.com" }), true);
    assert.equal(isRequestAllowedCsrf({ ...base, origin: "https://evil.example.net" }), false);
    assert.equal(isRequestAllowedCsrf({ ...base, origin: "https://app.example.com.evil.net" }), false);
    assert.equal(isRequestAllowedCsrf({ ...base, origin: "not a url" }), false);
  });

  it("no provenance information at all → blocked for writes", () => {
    assert.equal(isRequestAllowedCsrf(base), false);
  });

  it("explicit Authorization header (non-cookie clients) is not CSRF-able and is allowed", () => {
    assert.equal(isRequestAllowedCsrf({ ...base, hasAuthorizationHeader: true, secFetchSite: "cross-site" }), true);
  });

  it("proxy wires the CSRF check and a dedicated login limiter", async () => {
    const { readFileSync } = await import("node:fs");
    const proxy = readFileSync("src/proxy.ts", "utf8");
    assert.ok(proxy.includes("isRequestAllowedCsrf") && proxy.includes("403"));
    assert.ok(proxy.includes("/api/auth/login") && proxy.includes("loginLimiter"));
  });
});
