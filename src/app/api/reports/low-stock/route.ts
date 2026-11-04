import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

export async function GET(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin", "viewer"]);

    const res = await query(`
      select id, name, sku, stock_quantity, minimum_stock,
        greatest(minimum_stock - stock_quantity, 0) as shortage,
        case when stock_quantity = 0 then 'OUT' else 'LOW' end as status
      from public.products
      where deleted_at is null and (stock_quantity = 0 or stock_quantity < minimum_stock)
      order by (stock_quantity = 0) desc, shortage desc, name
    `);

    return NextResponse.json(res.rows);
  } catch (error) {
    return handleApiError(error);
  }
}
