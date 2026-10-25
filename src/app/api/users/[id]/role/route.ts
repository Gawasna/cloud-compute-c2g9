import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError, ApiError, type Role } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin"]);

    const { id } = await params;
    if (user.id === id) {
      throw new ApiError(400, "Không thể tự đổi vai trò");
    }

    const body = await request.json().catch(() => ({}));
    const role = body.role as Role;

    if (!["admin", "staff", "viewer"].includes(role)) {
      throw new ApiError(400, "Vai trò không hợp lệ");
    }

    const res = await query<{ id: string; role: Role }>(
      "update public.profiles set role = $1 where id = $2 returning id, role",
      [role, id]
    );

    if (!res.rowCount) {
      throw new ApiError(404, "Tài khoản không tồn tại");
    }

    return NextResponse.json(res.rows[0]);
  } catch (error) {
    return handleApiError(error);
  }
}
