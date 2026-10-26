import "server-only";
import { NextResponse } from "next/server";
import {
  authenticateUser,
  requireRoles,
  handleApiError,
  ApiError,
  getSupabaseAdminClient,
  isValidUuid,
} from "@/lib/auth/server";
import { query } from "@/lib/db/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin"]);

    const { id } = await params;
    if (!isValidUuid(id)) {
      throw new ApiError(400, "Mã tài khoản không hợp lệ (yêu cầu định dạng UUID)");
    }
    if (user.id === id) {
      throw new ApiError(400, "Không thể tự khóa hoặc mở khóa tài khoản");
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body.isActive !== "boolean") {
      throw new ApiError(400, "Trạng thái isActive phải là giá trị boolean");
    }

    const isActive = body.isActive;
    const existing = await query<{ id: string; is_active: boolean }>(
      "select id, is_active from public.profiles where id = $1",
      [id]
    );

    if (!existing.rowCount) {
      throw new ApiError(404, "Tài khoản không tồn tại");
    }

    const admin = getSupabaseAdminClient();
    const { error: banError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: isActive ? "none" : "876000h",
    });

    if (banError) {
      throw new ApiError(500, "Không thay đổi được trạng thái tài khoản trên Auth Service");
    }

    try {
      const result = await query<{ id: string; is_active: boolean }>(
        "update public.profiles set is_active = $1 where id = $2 returning id, is_active",
        [isActive, id]
      );
      return NextResponse.json(result.rows[0]);
    } catch (dbError) {
      // Rollback Supabase Auth ban status if DB update fails
      await admin.auth.admin.updateUserById(id, {
        ban_duration: existing.rows[0].is_active ? "none" : "876000h",
      });
      throw dbError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
