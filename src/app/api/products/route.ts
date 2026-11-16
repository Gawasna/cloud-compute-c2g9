import "server-only";
import { NextResponse } from "next/server";
import { createApiHandler, ApiError, isValidUuid } from "@/lib/auth/server";
import { query } from "@/lib/db/client";
import { toSearchPattern } from "@/lib/utils/sql";
import { invalidateInventoryCaches } from "@/lib/cache/redis";

export const GET = createApiHandler(
  async (request, { searchParams }) => {
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;

    const baseQuery = `from public.products p
      join public.categories c on c.id = p.category_id
      join public.units u on u.id = p.unit_id
      where p.deleted_at is null and (
        p.name ilike $1 or
        coalesce(p.name_en, '') ilike $1 or
        p.sku ilike $1 or
        c.name ilike $1 or
        coalesce(c.name_en, '') ilike $1
      )`;
    const terms = [toSearchPattern(searchParams.get("search"))];

    const [itemsResult, countResult] = await Promise.all([
      query(
        `select p.*,
          c.name as category_name, c.name_en as category_name_en,
          u.symbol as unit_symbol, u.symbol_en as unit_symbol_en
         ${baseQuery}
         order by p.created_at desc limit $2 offset $3`,
        [...terms, limit, offset]
      ),
      query<{ count: number }>(`select count(*)::int as count ${baseQuery}`, terms),
    ]);

    return NextResponse.json({
      items: itemsResult.rows,
      total: countResult.rows[0]?.count || 0,
      page,
      limit,
    });
  },
  { roles: ["admin", "staff", "viewer"] }
);

export const POST = createApiHandler(
  async (request) => {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const nameEn = String(body.nameEn || body.name_en || "").trim() || null;
    const sku = String(body.sku || "").trim().toUpperCase();
    const categoryId = String(body.categoryId || "").trim();
    const unitId = String(body.unitId || "").trim();
    const costPrice = Number(body.costPrice);
    const minimumStock = Number(body.minimumStock);
    const imageUrl = body.imageUrl || body.image_url ? String(body.imageUrl || body.image_url).trim() : null;

    if (!name || name.length > 160) {
      throw new ApiError(400, "Invalid product name (maximum 160 characters)");
    }
    if (nameEn && nameEn.length > 160) {
      throw new ApiError(400, "Invalid English product name (maximum 160 characters)");
    }
    if (imageUrl && imageUrl.length > 500) {
      throw new ApiError(400, "Invalid image URL (maximum 500 characters)");
    }
    if (!sku || sku.length > 40) {
      throw new ApiError(400, "Invalid SKU (maximum 40 characters)");
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
      `insert into public.products(name, name_en, sku, category_id, unit_id, cost_price, minimum_stock, image_url)
       values($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [name, nameEn, sku, categoryId, unitId, costPrice, minimumStock, imageUrl]
    );

    invalidateInventoryCaches().catch((err) => {
      console.warn("[Cache Invalidation] Error evicting inventory cache on product creation:", err);
    });

    return NextResponse.json(res.rows[0], { status: 201 });
  },
  { roles: ["admin"] }
);
