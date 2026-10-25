import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError, ApiError } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin"]);

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const sku = String(body.sku || "").trim().toUpperCase();
    const categoryId = String(body.categoryId || "").trim();
    const unitId = String(body.unitId || "").trim();
    const costPrice = Number(body.costPrice);
    const minimumStock = Number(body.minimumStock);

    if (!name || name.length > 160) {
      throw new ApiError(400, "Tên sản phẩm không hợp lệ");
    }
    if (!sku || sku.length > 40) {
      throw new ApiError(400, "Mã SKU không hợp lệ");
    }
    if (!categoryId || !unitId) {
      throw new ApiError(400, "Thiếu danh mục hoặc đơn vị tính");
    }
    if (isNaN(costPrice) || costPrice < 0) {
      throw new ApiError(400, "Giá vốn phải lớn hơn hoặc bằng 0");
    }
    if (isNaN(minimumStock) || minimumStock < 0 || !Number.isInteger(minimumStock)) {
      throw new ApiError(400, "Định mức tồn tối thiểu phải là số nguyên không âm");
    }

    try {
      const res = await query(
        `update public.products set name = $1, sku = $2, category_id = $3, unit_id = $4, cost_price = $5, minimum_stock = $6, updated_at = now()
         where id = $7 and deleted_at is null returning *`,
        [name, sku, categoryId, unitId, costPrice, minimumStock, id]
      );

      if (!res.rowCount) {
        throw new ApiError(404, "Không tìm thấy sản phẩm");
      }
      return NextResponse.json(res.rows[0]);
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        throw new ApiError(409, "SKU trùng");
      }
      throw e;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin"]);

    const { id } = await params;
    const res = await query(
      "update public.products set deleted_at = now() where id = $1 and deleted_at is null returning id",
      [id]
    );

    if (!res.rowCount) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
