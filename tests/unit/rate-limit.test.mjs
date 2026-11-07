import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter, getClientIp } from "../../src/lib/security/rate-limit.ts";

describe("Security: RateLimiter", () => {
  it("allows up to the limit then blocks within the window", () => {
    const rl = new RateLimiter(3, 1000);
    const t = 1_000_000;
    assert.equal(rl.check("ip", t).allowed, true);
    assert.equal(rl.check("ip", t).allowed, true);
    const third = rl.check("ip", t);
    assert.equal(third.allowed, true);
    assert.equal(third.remaining, 0);
    const blocked = rl.check("ip", t + 10);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfter >= 1);
  });

  it("resets after the window and isolates keys", () => {
    const rl = new RateLimiter(1, 1000);
    const t = 5_000;
    assert.equal(rl.check("a", t).allowed, true);
    assert.equal(rl.check("a", t + 1).allowed, false);
    assert.equal(rl.check("b", t + 1).allowed, true);
    assert.equal(rl.check("a", t + 1000).allowed, true);
  });

  it("bounds memory (maxKeys) and rejects invalid config", () => {
    const rl = new RateLimiter(5, 60_000, 50);
    for (let i = 0; i < 500; i++) rl.check(`ip-${i}`, 1);
    assert.ok(rl.hits.size <= 50);
    assert.throws(() => new RateLimiter(0, 1000), RangeError);
  });

  it("extracts the first client IP from proxy headers", () => {
    const h = (o) => ({ get: (k) => o[k] ?? null });
    assert.equal(getClientIp(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
    assert.equal(getClientIp(h({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
    assert.equal(getClientIp(h({})), "unknown");
  });
});
