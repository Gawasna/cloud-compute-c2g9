import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "dist", "coverage"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe("Security: repository hygiene", () => {
  it("no live-looking secrets in source, scripts or docs", () => {
    const patterns = [
      /eyJhbGciOi[A-Za-z0-9_-]{30,}/,                 // JWT (anon/service-role keys)
      /postgres(?:ql)?:\/\/[^\s:@/]+:(?!\*+|<|\[|your|password|PASSWORD|xxx|ci-only)[^\s@/]{6,}@(?![^\s/]*your-project)/i, // DB URL with real password
      /sbp_[0-9a-f]{20,}/, /sntrys_[A-Za-z0-9]{20,}/, /sk_live_[A-Za-z0-9]+/,
    ];
    const files = [...walk("src"), ...walk("scripts"), ...walk("supabase"), ...walk(".github"), "README.md", ".env.example"].filter((f) => existsSync(f) && !f.endsWith(".sqlite3"));
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const re of patterns) assert.ok(!re.test(text), `possible secret in ${f} (${re})`);
    }
  });

  it("ops compose files do not ship default credentials or public bind addresses", () => {
    const bugsink = readFileSync("scripts/ops/bugsink/docker-compose.yml", "utf8");
    assert.match(bugsink, /CREATE_SUPERUSER=\$\{BUGSINK_SUPERUSER:\?/, "superuser must be mandatory, not defaulted");
    assert.ok(!/CloudStockOps/i.test(bugsink));
    const deploy = readFileSync("scripts/ops/bugsink/deploy-bugsink.sh", "utf8");
    assert.ok(!/CloudStockOps/i.test(deploy), "deploy script must generate a random admin password");
    assert.ok(!/100\.\d+\.\d+\.\d+/.test(deploy), "no hard-coded tailnet IPs in deploy script");
    assert.ok(!/100\.\d+\.\d+\.\d+/.test(bugsink + readFileSync("scripts/ops/kuma/docker-compose.yml", "utf8")), "no hard-coded tailnet IPs");
  });

  it("runtime data / env files are git-ignored and not tracked", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    assert.match(ignore, /^\.env\.\*/m);
    assert.match(ignore, /scripts\/ops\/\*\*\/data\//);
    let tracked = [];
    try {
      tracked = execFileSync("git", ["ls-files"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n");
    } catch { return; /* not a git checkout (e.g. zip): static checks above still apply */ }
    const bad = tracked.filter((f) => /(^|\/)\.env(\.(?!example)[^/]*)?$/.test(f) || /\.sqlite3?$/.test(f) || /dsn\.txt$/.test(f));
    assert.deepEqual(bad, [], `sensitive files tracked by git: ${bad.join(", ")}`);
  });

  it("every mutating API route requires authentication and a role check", () => {
    const routes = walk("src/app/api").filter((f) => f.endsWith("route.ts"));
    const roleExempt = new Set(["src/app/api/auth/me/route.ts"].map((p) => p.replaceAll("/", process.platform === "win32" ? "\\" : "/")));
    const open = new Set([
      "src/app/api/health/route.ts",
      "src/app/api/debug/telemetry/route.ts",
      "src/app/api/auth/login/route.ts",
      "src/app/api/auth/refresh/route.ts",
      "src/app/api/auth/logout/route.ts",
    ].map((p) => p.replaceAll("/", process.platform === "win32" ? "\\" : "/")));
    for (const f of routes) {
      if (open.has(f)) continue;
      const s = readFileSync(f, "utf8");
      const isHof = s.includes("createApiHandler");
      assert.ok(s.includes("authenticateUser(request)") || isHof, `${f} must authenticate`);
      if (!roleExempt.has(f)) assert.ok(s.includes("requireRoles(") || (isHof && s.includes("roles:")), `${f} must authorise by role`);
      assert.ok(s.includes("handleApiError") || isHof, `${f} must use the safe error handler`);
    }
  });

  it("debug endpoints are disabled in production", () => {
    assert.match(readFileSync("src/app/api/debug/telemetry/route.ts", "utf8"), /NODE_ENV === "production"[\s\S]{0,200}403/);
  });

  it("JWT verification against JWKS never accepts symmetric algorithms", () => {
    const t = readFileSync("src/lib/auth/token.ts", "utf8");
    const algs = t.match(/algorithms:\s*\[([^\]]*)\]/)?.[1] ?? "";
    assert.ok(!/HS\d+/.test(algs), `HS* must not be allowed with JWKS, got [${algs}]`);
  });
});
