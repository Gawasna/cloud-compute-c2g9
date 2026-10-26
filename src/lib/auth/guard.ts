import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import type { AuthUser, Role } from "./types";
import { verifyToken } from "./token";
import { fetchProfileWithDeduping } from "./profile-cache";

export async function authenticateUser(request: Request): Promise<AuthUser> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";

  if (!token) {
    throw new ApiError(401, "Cần đăng nhập");
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new ApiError(500, "Chưa cấu hình Supabase Auth URL và Anon Key");
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifiedUser = await verifyToken(token, supabase);
  const profile = await fetchProfileWithDeduping(verifiedUser.id);

  return {
    id: verifiedUser.id,
    role: profile.role,
    email: verifiedUser.email,
  };
}

export function requireRoles(user: AuthUser, allowedRoles: Role[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new ApiError(403, "Không đủ quyền truy cập");
  }
}
