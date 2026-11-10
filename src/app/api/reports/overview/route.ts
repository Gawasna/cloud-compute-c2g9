import "server-only";
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/auth/server";
import { query } from "@/lib/db/client";
import { getOrSetCache } from "@/lib/cache/redis";

export const GET = createApiHandler(
  async () => {
    const { data, cached } = await getOrSetCache("cache:reports:overview", async () => {
      const result = await query(
        `select count(*)::int as total_products,
          coalesce(sum(stock_quantity), 0)::bigint as total_units,
          coalesce(sum(stock_quantity * cost_price), 0)::numeric as inventory_value,
          count(*) filter(where stock_quantity = 0)::int as out_of_stock,
          count(*) filter(where stock_quantity > 0 and stock_quantity < minimum_stock)::int as low_stock
        from public.products
        where deleted_at is null`
      );
      return result.rows[0];
    });

    const response = NextResponse.json(data);
    response.headers.set("X-Cache", cached ? "HIT" : "MISS");
    return response;
  },
  { roles: ["admin", "viewer"] }
);
