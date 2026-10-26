import "server-only";
import { NextResponse } from "next/server";
import {
  authenticateUser,
  requireRoles,
  handleApiError,
  ApiError,
  getSupabaseAdminClient,
  type Role,
} from "@/lib/auth/server";
import { query } from "@/lib/db/client";

// Safe, non-backtracking email regex avoiding Polynomial ReDoS
const SAFE_EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

function isValidEmail(email: string): boolean {
  if (!email || email.length > 254 || email.length < 5) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain || !domain.includes(".")) return false;
  return SAFE_EMAIL_REGEX.test(email);
}

export async function GET(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin"]);

    const rowsRes = await query<{
      id: string;
      display_name: string;
      role: Role;
      is_active: boolean;
      created_at: string;
    }>("select id, display_name, role, is_active, created_at from public.profiles order by created_at desc");

    const admin = getSupabaseAdminClient();
    const emails = new Map<string, string>();

    if (rowsRes.rows.length > 0) {
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) {
          throw new ApiError(500, "Không tải được danh sách tài khoản từ Auth Service");
        }
        for (const u of data.users) {
          emails.set(u.id, u.email || "");
        }
        const allMapped = rowsRes.rows.every((row) => emails.has(row.id));
        if (allMapped || data.users.length < 1000) break;
      }
    }

    const result = rowsRes.rows.map((row) => ({
      ...row,
      email: emails.get(row.id) || "",
    }));

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin"]);

    const body = await request.json().catch(() => ({}));
    const name = String(body.displayName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = body.role as Role;

    if (!name || name.length > 120) {
      throw new ApiError(400, "Tên người dùng không hợp lệ (tối đa 120 ký tự)");
    }
    if (!isValidEmail(email)) {
      throw new ApiError(400, "Địa chỉ email không đúng định dạng hoặc không an toàn");
    }
    if (!password || password.length < 10) {
      throw new ApiError(400, "Mật khẩu phải có ít nhất 10 ký tự");
    }
    if (!["admin", "staff", "viewer"].includes(role)) {
      throw new ApiError(400, "Vai trò không hợp lệ");
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      throw new ApiError(400, error?.message || "Không thể tạo tài khoản");
    }

    try {
      await query(
        "insert into public.profiles(id, display_name, role, is_active) values($1, $2, $3, true)",
        [data.user.id, name, role]
      );
    } catch (e) {
      // Rollback Supabase Auth user if profile insertion fails
      await admin.auth.admin.deleteUser(data.user.id);
      throw e;
    }

    return NextResponse.json(
      {
        id: data.user.id,
        email,
        display_name: name,
        role,
        is_active: true,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
