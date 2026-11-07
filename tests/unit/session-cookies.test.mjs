import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH,
  buildSessionCookies, buildClearCookies, readCookie,
} from "../../src/lib/auth/session-cookies.ts";

const tokens = { access_token: "aaa.bbb.ccc", refresh_token: "refresh-xyz", expires_in: 3600 };

describe("Security: HttpOnly session cookies", () => {
  it("every session cookie is HttpOnly + SameSite=Strict, Secure in production", () => {
    for (const isProd of [true, false]) {
      for (const c of buildSessionCookies(tokens, isProd)) {
        assert.equal(c.options.httpOnly, true, `${c.name} must be HttpOnly`);
        assert.equal(c.options.sameSite, "strict");
        assert.equal(c.options.secure, isProd);
      }
    }
  });

  it("the refresh cookie is scoped to /api/auth only; the access cookie to the whole site", () => {
    const [access, refresh] = buildSessionCookies(tokens, true);
    assert.equal(access.name, ACCESS_COOKIE);
    assert.equal(access.options.path, "/");
    assert.equal(refresh.name, REFRESH_COOKIE);
    assert.equal(refresh.options.path, REFRESH_COOKIE_PATH);
    assert.ok(refresh.options.maxAge > access.options.maxAge);
  });

  it("access cookie lifetime follows expires_in but is clamped to sane bounds", () => {
    assert.equal(buildSessionCookies({ ...tokens, expires_in: 1800 }, true)[0].options.maxAge, 1800);
    assert.equal(buildSessionCookies({ ...tokens, expires_in: 10 }, true)[0].options.maxAge, 60);
    assert.equal(buildSessionCookies({ ...tokens, expires_in: 10 ** 9 }, true)[0].options.maxAge, 86400);
    assert.equal(buildSessionCookies({ ...tokens, expires_in: NaN }, true)[0].options.maxAge, 3600);
  });

  it("clearing uses the same name/path with maxAge 0 so browsers really delete them", () => {
    const set = buildSessionCookies(tokens, true);
    const clear = buildClearCookies(true);
    assert.equal(clear.length, set.length);
    clear.forEach((c, i) => {
      assert.equal(c.name, set[i].name);
      assert.equal(c.options.path, set[i].options.path);
      assert.equal(c.options.maxAge, 0);
      assert.equal(c.value, "");
    });
  });

  it("readCookie parses the Cookie header safely", () => {
    const h = `theme=dark; ${ACCESS_COOKIE}=aaa.bbb.ccc; other=1`;
    assert.equal(readCookie(h, ACCESS_COOKIE), "aaa.bbb.ccc");
    assert.equal(readCookie(h, "missing"), undefined);
    assert.equal(readCookie(null, ACCESS_COOKIE), undefined);
    assert.equal(readCookie(`${ACCESS_COOKIE}=%E0%A4%A`, ACCESS_COOKIE), undefined, "malformed encoding must not throw");
    assert.equal(readCookie(`x${ACCESS_COOKIE}=evil; ${ACCESS_COOKIE}=ok`, ACCESS_COOKIE), "ok", "must match the exact name");
  });
});

describe("Security: browser code never touches tokens", () => {
  it("client auth module has no browser storage and no token handling", () => {
    const client = readFileSync("src/lib/auth/client.ts", "utf8");
    assert.ok(!/sessionStorage|localStorage|document\.cookie|access_token|refresh_token/.test(client));
    const api = readFileSync("src/lib/api/cloudstock.ts", "utf8");
    assert.ok(!/Authorization|Bearer|sessionStorage|localStorage/.test(api));
  });

  it("login route returns no token in the body and sets cookies via the shared helper", () => {
    const login = readFileSync("src/app/api/auth/login/route.ts", "utf8");
    assert.ok(login.includes("buildSessionCookies"));
    assert.ok(!/NextResponse\.json\([^)]*(access_token|refresh_token)/.test(login));
  });

  it("logout and refresh clear cookies with the shared helper", () => {
    assert.ok(readFileSync("src/app/api/auth/logout/route.ts", "utf8").includes("buildClearCookies"));
    assert.ok(readFileSync("src/app/api/auth/refresh/route.ts", "utf8").includes("buildClearCookies"));
  });

  it("the guard accepts the HttpOnly cookie as well as the Bearer header", () => {
    const g = readFileSync("src/lib/auth/guard.ts", "utf8");
    assert.ok(g.includes("ACCESS_COOKIE") && g.includes("authorization"));
  });
});
