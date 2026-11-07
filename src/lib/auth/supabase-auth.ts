import "server-only";
import { ApiError } from "@/lib/api/api-error";
import type { TokenSet } from "./session-cookies";

export interface SupabaseSession extends TokenSet {
  email?: string;
}

function config(): { url: string; anonKey: string } {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) throw new ApiError(500, "Chưa cấu hình Supabase Auth URL và Anon Key");
  return { url, anonKey };
}

async function authPost(path: string, body: Record<string, string>, bearer?: string): Promise<Response> {
  const { url, anonKey } = config();
  try {
    return await fetch(`${url}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError(503, "Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại.");
  }
}

async function toSession(response: Response, invalidMessage: string): Promise<SupabaseSession> {
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    if (response.status === 429) throw new ApiError(429, "Bạn thử đăng nhập quá nhiều lần. Vui lòng đợi một lúc.");
    if (response.status >= 500) throw new ApiError(503, "Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại.");
    throw new ApiError(401, invalidMessage);
  }
  const access_token = String(payload.access_token || "");
  const refresh_token = String(payload.refresh_token || "");
  if (!access_token || !refresh_token) throw new ApiError(401, invalidMessage);
  return {
    access_token,
    refresh_token,
    expires_in: Number(payload.expires_in) || 3600,
    email: (payload.user as { email?: string } | undefined)?.email,
  };
}

export async function passwordGrant(email: string, password: string): Promise<SupabaseSession> {
  const res = await authPost("token?grant_type=password", { email, password });
  return toSession(res, "Email hoặc mật khẩu không chính xác.");
}

export async function refreshGrant(refreshToken: string): Promise<SupabaseSession> {
  const res = await authPost("token?grant_type=refresh_token", { refresh_token: refreshToken });
  return toSession(res, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
}

/** Best-effort server-side logout (revokes the refresh token at Supabase). Never throws. */
export async function revokeSession(accessToken: string): Promise<void> {
  try {
    const { url, anonKey } = config();
    await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* ignore: cookies are cleared regardless */
  }
}
