import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError } from "@/lib/auth/server";
import { query, withTransaction } from "@/lib/db/client";
import { applyStockMovement, parseMovementInput } from "@/server/services/stock";

export async function GET(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin", "staff"]);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

    const res = await query(
      `select m.*, p.name as product_name, p.sku, pr.role as actor_role, pr.display_name as actor_name
       from public.stock_movements m
       join public.products p on p.id = m.product_id
       left join public.profiles pr on pr.id = m.performed_by
       order by m.created_at desc limit $1`,
      [limit]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin", "staff"]);

    const body = await request.json().catch(() => ({}));
    const input = parseMovementInput(body);

    const movement = await withTransaction((client) => applyStockMovement(client, input, user.id));

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
