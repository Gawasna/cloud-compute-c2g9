import "server-only";
import { NextResponse } from "next/server";
import { revokeSession } from "@/lib/auth/supabase-auth";
import { ACCESS_COOKIE, buildClearCookies, readCookie } from "@/lib/auth/session-cookies";

/** Revokes the session at Supabase (best effort) and always clears both cookies. */
export async function POST(request: Request) {
  const accessToken = readCookie(request.headers.get("cookie"), ACCESS_COOKIE);
  if (accessToken) await revokeSession(accessToken);

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  for (const c of buildClearCookies(process.env.NODE_ENV === "production")) {
    response.cookies.set(c.name, c.value, c.options);
  }
  return response;
}
