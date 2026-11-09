import "server-only";
import { NextResponse } from "next/server";
import { createApiHandler, ApiError, isValidUuid } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

export const PATCH = createApiHandler<{ id: string }>(
  async (request, { params }) => {
    const { id } = params;
    if (!isValidUuid(id)) {
      throw new ApiError(400, "Mã danh mục không hợp lệ (yêu cầu định dạng UUID)");
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!name || name.length > 100) {
      throw new ApiError(400, "Tên danh mục không hợp lệ (tối đa 100 ký tự)");
    }

    const res = await query("update public.categories set name = $1 where id = $2 returning *", [name, id]);
    if (!res.rowCount) {
      throw new ApiError(404, "Không tìm thấy danh mục");
    }
    return NextResponse.json(res.rows[0]);
  },
  { roles: ["admin"] }
);

export const DELETE = createApiHandler<{ id: string }>(
  async (_request, { params }) => {
    const { id } = params;
    if (!isValidUuid(id)) {
      throw new ApiError(400, "Mã danh mục không hợp lệ (yêu cầu định dạng UUID)");
    }

    const res = await query("delete from public.categories where id = $1", [id]);
    if (!res.rowCount) {
      throw new ApiError(404, "Không tìm thấy danh mục");
    }

    return NextResponse.json({ deleted: true });
  },
  { roles: ["admin"] }
);
