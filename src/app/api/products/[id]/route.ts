import "server-only";
import { NextResponse } from "next/server";
import { createApiHandler, ApiError, isValidUuid } from "@/lib/auth/server";
import { query } from "@/lib/db/client";
import { invalidateInventoryCaches } from "@/lib/cache/redis";

export const GET = createApiHandler<{ id: string }>(
  async (_request, { params }) => {
    const { id } = params;
    if (!isValidUuid(id)) {
      throw new ApiError(400, "Invalid product ID (UUID format required)");
    }

    const res = await query(
      `select p.*, c.name as category_name, c.name_en as category_name_en, u.symbol as unit_symbol, u.symbol_en as unit_symbol_en
       from public.products p
       join public.categories c on c.id = p.category_id
       join public.units u on u.id = p.unit_id
       where p.id = $1 and p.deleted_at is null`,
      [id]
    );

    if (!res.rowCount) {
      throw new ApiError(404, "Product not found");
    }

    return NextResponse.json(res.rows[0]);
  },
  { roles: ["admin", "staff", "viewer"] }
);

export const PATCH = createApiHandler<{ id: string }>(
  async (request, { params }) => {
    const { id } = params;
    if (!isValidUuid(id)) {
      throw new ApiError(400, "Invalid product ID (UUID format required)");
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const nameEn = String(body.nameEn || body.name_en || "").trim() || null;
    const sku = String(body.sku || "").trim().toUpperCase();
    const categoryId = String(body.categoryId || "").trim();
    const unitId = String(body.unitId || "").trim();
    const costPrice = Number(body.costPrice);
    const minimumStock = Number(body.minimumStock);
    const hasImageField = "imageUrl" in body || "image_url" in body;
    const imageUrl = hasImageField
      ? (body.imageUrl || body.image_url ? String(body.imageUrl || body.image_url).trim() : null)
      : undefined;

    if (!name || name.length > 160) {
      throw new ApiError(400, "Invalid product name");
    }
    if (nameEn && nameEn.length > 160) {
      throw new ApiError(400, "Invalid English product name");
    }
    if (imageUrl && imageUrl.length > 500) {
      throw new ApiError(400, "Invalid image URL (maximum 500 characters)");
    }
    if (!sku || sku.length > 40) {
      throw new ApiError(400, "Invalid SKU");
    }
    if (!categoryId || !unitId || !isValidUuid(categoryId) || !isValidUuid(unitId)) {
      throw new ApiError(400, "Invalid category or unit ID (UUID format required)");
    }
    if (isNaN(costPrice) || costPrice < 0) {
      throw new ApiError(400, "Cost price must be greater than or equal to 0");
    }
    if (isNaN(minimumStock) || minimumStock < 0 || !Number.isInteger(minimumStock)) {
      throw new ApiError(400, "Minimum stock must be a non-negative integer");
    }

    const res = await query(
      `update public.products
       set name = $1, name_en = $2, sku = $3, category_id = $4, unit_id = $5, cost_price = $6, minimum_stock = $7,
           image_url = case when $8::boolean then $9 else image_url end,
           updated_at = now()
       where id = $10 and deleted_at is null returning *`,
      [name, nameEn, sku, categoryId, unitId, costPrice, minimumStock, hasImageField, imageUrl || null, id]
    );

    if (!res.rowCount) {
      throw new ApiError(404, "Product not found");
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
      throw new ApiError(400, "Invalid product ID (UUID format required)");
    }

    const res = await query(
      "update public.products set deleted_at = now() where id = $1 and deleted_at is null returning id",
      [id]
    );

    if (!res.rowCount) {
      throw new ApiError(404, "Product not found");
    }

    invalidateInventoryCaches().catch((err) => {
      console.warn("[Cache Invalidation] Error evicting inventory cache on product delete:", err);
    });

    return NextResponse.json({ deleted: true });
  },
  { roles: ["admin"] }
);
