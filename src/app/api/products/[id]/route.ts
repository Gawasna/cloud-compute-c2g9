import "server-only";
import { NextResponse } from "next/server";
import { createApiHandler, ApiError, isValidUuid } from "@/lib/auth/server";
import { query } from "@/lib/db/client";
import { invalidateInventoryCaches } from "@/lib/cache/redis";

export const PATCH = createApiHandler<{ id: string }>(
  async (request, { params }) => {
    const { id } = params;
    if (!isValidUuid(id)) {
      throw new ApiError(400, "Mã sản phẩm không hợp lệ (yêu cầu định dạng UUID)");
    }

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
    if (!categoryId || !unitId || !isValidUuid(categoryId) || !isValidUuid(unitId)) {
      throw new ApiError(400, "Danh mục hoặc đơn vị tính không hợp lệ (yêu cầu định dạng UUID)");
    }
    if (isNaN(costPrice) || costPrice < 0) {
      throw new ApiError(400, "Giá vốn phải lớn hơn hoặc bằng 0");
    }
    if (isNaN(minimumStock) || minimumStock < 0 || !Number.isInteger(minimumStock)) {
      throw new ApiError(400, "Định mức tồn tối thiểu phải là số nguyên không âm");
    }

    const res = await query(
      `update public.products set name = $1, sku = $2, category_id = $3, unit_id = $4, cost_price = $5, minimum_stock = $6, updated_at = now()
       where id = $7 and deleted_at is null returning *`,
      [name, sku, categoryId, unitId, costPrice, minimumStock, id]
    );

    if (!res.rowCount) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    invalidateInventoryCaches().catch((err) => {
      console.warn("[Cache Invalidation] Error evicting inventory cache on product update:", err);
    });

    return NextResponse.json(res.rows[0]);
  },
  { roles: ["admin"] }
);

export const DELETE = createApiHandler<{ id: string }>(
  async (_request, { params }) => {
    const { id } = params;
    if (!isValidUuid(id)) {
      throw new ApiError(400, "Mã sản phẩm không hợp lệ (yêu cầu định dạng UUID)");
    }

    const res = await query(
      "update public.products set deleted_at = now() where id = $1 and deleted_at is null returning id",
      [id]
    );

    if (!res.rowCount) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    invalidateInventoryCaches().catch((err) => {
      console.warn("[Cache Invalidation] Error evicting inventory cache on product delete:", err);
    });

    return NextResponse.json({ deleted: true });
  },
  { roles: ["admin"] }
);
