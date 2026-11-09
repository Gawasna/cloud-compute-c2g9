import "server-only";
import { NextResponse } from "next/server";
import { createApiHandler, ApiError } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

export const GET = createApiHandler(
  async () => {
    const res = await query("select * from public.categories order by name");
    return NextResponse.json(res.rows);
  },
  { roles: ["admin", "staff", "viewer"] }
);

export const POST = createApiHandler(
  async (request) => {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();

    if (!name || name.length > 100) {
      throw new ApiError(400, "Tên danh mục không hợp lệ (tối đa 100 ký tự)");
    }

    const res = await query("insert into public.categories(name) values($1) returning *", [name]);
    return NextResponse.json(res.rows[0], { status: 201 });
  },
  { roles: ["admin"] }
);
