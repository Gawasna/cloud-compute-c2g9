import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";

export type Role = "admin" | "staff" | "viewer";

export interface AuthUser {
  id: string;
  role: Role;
  email?: string;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new ApiError(500, "Chưa cấu hình dịch vụ quản lý tài khoản (SUPABASE_SERVICE_ROLE_KEY).");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError(401, "Token không hợp lệ");
  }

  const res = await query<{ role: Role; is_active: boolean }>(
    "select role, is_active from public.profiles where id = $1",
    [data.user.id]
  );

  const profile = res.rows[0];
  if (!profile) {
    throw new ApiError(403, "Tài khoản chưa được cấp vai trò");
  }

  if (!profile.is_active) {
    throw new ApiError(403, "Tài khoản đã bị vô hiệu hóa");
  }

  return {
    id: data.user.id,
    role: profile.role,
    email: data.user.email,
  };
}

export function requireRoles(user: AuthUser, allowedRoles: Role[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new ApiError(403, "Không đủ quyền truy cập");
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ message: error.message }, { status: error.statusCode });
  }

  const err = error as { code?: string; message?: string };
  if (err.code === "23505") {
    return NextResponse.json({ message: "Dữ liệu bị trùng lặp (SKU hoặc mã đã tồn tại)." }, { status: 409 });
  }

  const message = err.message || "Lỗi máy chủ nội bộ";
  return NextResponse.json({ message }, { status: 500 });
}
