import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError, ApiError, isValidUuid } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin"]);

    const { id } = await params;
    if (!isValidUuid(id)) {
      throw new ApiError(400, "Mã danh mục không hợp lệ (yêu cầu định dạng UUID)");
    }

    const res = await query("delete from public.categories where id = $1", [id]);
    if (!res.rowCount) {
      throw new ApiError(404, "Không tìm thấy danh mục");
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
