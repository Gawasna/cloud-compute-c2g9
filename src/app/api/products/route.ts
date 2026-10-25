import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError, ApiError } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

export async function GET(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin", "staff", "viewer"]);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;

    const baseQuery = `from public.products p join public.categories c on c.id = p.category_id join public.units u on u.id = p.unit_id where p.deleted_at is null and (p.name ilike $1 or p.sku ilike $1)`;
    const terms = [`%${search}%`];

    const [itemsResult, countResult] = await Promise.all([
      query(
        `select p.*, c.name as category_name, u.symbol as unit_symbol ${baseQuery} order by p.created_at desc limit $2 offset $3`,
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
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin"]);

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const sku = String(body.sku || "").trim().toUpperCase();
    const categoryId = String(body.categoryId || "").trim();
    const unitId = String(body.unitId || "").trim();
    const costPrice = Number(body.costPrice);
    const minimumStock = Number(body.minimumStock);

    if (!name || name.length > 160) {
      throw new ApiError(400, "Tên sản phẩm không hợp lệ (tối đa 160 ký tự)");
    }
    if (!sku || sku.length > 40) {
      throw new ApiError(400, "Mã SKU không hợp lệ (tối đa 40 ký tự)");
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
        "insert into public.products(name, sku, category_id, unit_id, cost_price, minimum_stock) values($1, $2, $3, $4, $5, $6) returning *",
        [name, sku, categoryId, unitId, costPrice, minimumStock]
      );
      return NextResponse.json(res.rows[0], { status: 201 });
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
