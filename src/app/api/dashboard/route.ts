import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

export async function GET(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin", "staff", "viewer"]);

    const [summaryResult, historyResult] = await Promise.all([
      query(`
        select
          count(*)::int as total_products,
          coalesce(sum(stock_quantity), 0)::bigint as total_units,
          coalesce(sum(stock_quantity * cost_price), 0)::numeric as inventory_value,
          count(*) filter(where stock_quantity = 0)::int as out_of_stock,
          count(*) filter(where stock_quantity > 0 and stock_quantity < minimum_stock)::int as low_stock
        from public.products
        where deleted_at is null
      `),
      query(`
        select date_trunc('day', created_at)::date as day, type, sum(quantity)::int as quantity
        from public.stock_movements
        where created_at >= now() - interval '30 days'
        group by 1, 2
        order by 1
      `),
    ]);

    return NextResponse.json({
      summary: summaryResult.rows[0] || {
        total_products: 0,
        total_units: 0,
        inventory_value: 0,
        out_of_stock: 0,
        low_stock: 0,
      },
      history: historyResult.rows,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
