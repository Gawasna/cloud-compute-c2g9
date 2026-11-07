import "server-only";
import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { refreshGrant } from "@/lib/auth/supabase-auth";
import { REFRESH_COOKIE, buildClearCookies, buildSessionCookies, readCookie } from "@/lib/auth/session-cookies";

/** Uses the HttpOnly refresh cookie (only sent to /api/auth/*) to issue a new access token. */
export async function POST(request: Request) {
  const isProd = process.env.NODE_ENV === "production";
  try {
    const refreshToken = readCookie(request.headers.get("cookie"), REFRESH_COOKIE);
    if (!refreshToken) throw new ApiError(401, "Cần đăng nhập");

    const session = await refreshGrant(refreshToken);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    for (const c of buildSessionCookies(session, isProd)) response.cookies.set(c.name, c.value, c.options);
    return response;
  } catch (error) {
    const response = handleApiError(error);
    // An invalid/expired refresh token means the session is over: drop both cookies.
    if (response.status === 401) {
      for (const c of buildClearCookies(isProd)) response.cookies.set(c.name, c.value, c.options);
    }
    return response;
  }
}
