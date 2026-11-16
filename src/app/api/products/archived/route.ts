import "server-only";
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/auth/server";
import { query } from "@/lib/db/client";
import { toSearchPattern } from "@/lib/utils/sql";

export const GET = createApiHandler(
  async (request, { searchParams }) => {
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;

    const baseQuery = `from public.products p
      join public.categories c on c.id = p.category_id
      join public.units u on u.id = p.unit_id
      where p.deleted_at is not null and (
        p.name ilike $1 or
        coalesce(p.name_en, '') ilike $1 or
        p.sku ilike $1 or
        c.name ilike $1 or
        coalesce(c.name_en, '') ilike $1
      )`;
    const terms = [toSearchPattern(searchParams.get("search"))];

    const [itemsResult, countResult] = await Promise.all([
      query(
        `select p.id, p.name, p.name_en, p.sku, p.stock_quantity, p.deleted_at, p.image_url,
          c.name as category_name, c.name_en as category_name_en,
          u.symbol as unit_symbol, u.symbol_en as unit_symbol_en
         ${baseQuery}
         order by p.deleted_at desc, p.id desc
         limit $2 offset $3`,
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
  { roles: ["admin"] }
);
