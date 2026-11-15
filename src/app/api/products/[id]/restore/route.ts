import "server-only";
import { NextResponse } from "next/server";
import { createApiHandler, ApiError, isValidUuid } from "@/lib/auth/server";
import { query } from "@/lib/db/client";
import { invalidateInventoryCaches } from "@/lib/cache/redis";

async function handleRestore(_request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!isValidUuid(id)) {
    throw new ApiError(400, "Invalid product ID (UUID expected)");
  }

  const res = await query(
    `update public.products
     set deleted_at = null, updated_at = now()
     where id = $1 and deleted_at is not null
     returning id, sku, name, name_en, stock_quantity`,
    [id]
  );

  if (!res.rowCount) {
    throw new ApiError(404, "Archived product not found");
  }

  invalidateInventoryCaches().catch((err) => {
    console.warn("[Cache Invalidation] Error evicting inventory cache on product restore:", err);
  });

  return NextResponse.json({
    restored: true,
    product: res.rows[0],
  });
}

export const PATCH = createApiHandler<{ id: string }>(handleRestore, { roles: ["admin"] });
export const POST = createApiHandler<{ id: string }>(handleRestore, { roles: ["admin"] });
