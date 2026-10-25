import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

export async function GET(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin", "viewer"]);

    const res = await query(`
      select date_trunc('day', created_at)::date as day, type, sum(quantity)::int as quantity
      from public.stock_movements
      group by 1, 2
      order by 1 desc
      limit 120
    `);

    return NextResponse.json(res.rows);
  } catch (error) {
    return handleApiError(error);
  }
}
