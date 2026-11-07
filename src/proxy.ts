import { NextResponse, type NextRequest } from "next/server";
import { RateLimiter, getClientIp } from "@/lib/security/rate-limit";
import { isRequestAllowedCsrf } from "@/lib/security/csrf";

/**
 * Edge-of-app request gate (Next.js 16 `proxy`, formerly `middleware`).
 * Applies a per-IP, per-instance rate limit to /api/* as a best-effort abuse brake.
 * Health checks are exempt so uptime monitors are never throttled.
 */
const globalForLimiters = globalThis as unknown as {
  __apiReadLimiter?: RateLimiter;
  __apiWriteLimiter?: RateLimiter;
  __apiExportLimiter?: RateLimiter;
  __apiLoginLimiter?: RateLimiter;
};

const readLimiter = (globalForLimiters.__apiReadLimiter ??= new RateLimiter(240, 60_000));
const writeLimiter = (globalForLimiters.__apiWriteLimiter ??= new RateLimiter(60, 60_000));
const exportLimiter = (globalForLimiters.__apiExportLimiter ??= new RateLimiter(10, 60_000));
// Brute-force brake for credential endpoints (Supabase applies its own limits as well).
const loginLimiter = (globalForLimiters.__apiLoginLimiter ??= new RateLimiter(10, 60_000));

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/health") return NextResponse.next();

  // CSRF: cookie-authenticated, state-changing requests must come from our own origin.
  const allowed = isRequestAllowedCsrf({
    method: request.method,
    origin: request.headers.get("origin"),
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    hasAuthorizationHeader: request.headers.has("authorization"),
  });
  if (!allowed) {
    return NextResponse.json(
      { message: "Yêu cầu bị từ chối (nguồn gốc không hợp lệ)." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const ip = getClientIp(request.headers);
  const isLogin = pathname === "/api/auth/login";
  const isExport = pathname.startsWith("/api/reports/export");
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const limiter = isLogin ? loginLimiter : isExport ? exportLimiter : isWrite ? writeLimiter : readLimiter;
  const bucket = isLogin ? "login" : isExport ? "export" : isWrite ? "write" : "read";

  const result = limiter.check(`${bucket}:${ip}`);
  if (!result.allowed) {
    return NextResponse.json(
      { message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút." },
      {
        status: 429,
        headers: { "Retry-After": String(result.retryAfter), "Cache-Control": "no-store" },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
