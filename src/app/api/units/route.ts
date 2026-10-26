import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError, ApiError } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

export async function GET(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin", "staff", "viewer"]);

    const res = await query("select * from public.units order by name");
    return NextResponse.json(res.rows);
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
    const symbol = String(body.symbol || "").trim();

    if (!name || name.length > 60) {
      throw new ApiError(400, "Tên đơn vị tính không hợp lệ (tối đa 60 ký tự)");
    }
    if (!symbol || symbol.length > 20) {
      throw new ApiError(400, "Ký hiệu không hợp lệ (tối đa 20 ký tự)");
    }

    const res = await query("insert into public.units(name, symbol) values($1, $2) returning *", [name, symbol]);
    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
