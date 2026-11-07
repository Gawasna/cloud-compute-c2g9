import "server-only";
import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { passwordGrant } from "@/lib/auth/supabase-auth";
import { buildSessionCookies } from "@/lib/auth/session-cookies";

/** Exchanges email/password for a session and stores the tokens in HttpOnly cookies (never in the body). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password || email.length > 254 || password.length > 256) {
      throw new ApiError(400, "Vui lòng nhập email và mật khẩu hợp lệ.");
    }

    const session = await passwordGrant(email, password);
    const response = NextResponse.json({ email: session.email ?? email }, { headers: { "Cache-Control": "no-store" } });
    for (const c of buildSessionCookies(session, process.env.NODE_ENV === "production")) {
      response.cookies.set(c.name, c.value, c.options);
    }
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
