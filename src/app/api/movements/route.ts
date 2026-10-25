import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError, ApiError } from "@/lib/auth/server";
import { query, withTransaction } from "@/lib/db/client";

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
    const productId = String(body.productId || "").trim();
    const type = body.type;
    const quantity = Number(body.quantity);
    const note = body.note ? String(body.note).trim() : null;

    if (!productId) {
      throw new ApiError(400, "Mã sản phẩm không hợp lệ");
    }
    if (type !== "IN" && type !== "OUT") {
      throw new ApiError(400, "Loại biến động phải là IN hoặc OUT");
    }
    if (isNaN(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
      throw new ApiError(400, "Số lượng phải là số nguyên dương (tối thiểu 1)");
    }
    if (note && note.length > 500) {
      throw new ApiError(400, "Ghi chú không được vượt quá 500 ký tự");
    }

    const movement = await withTransaction(async (client) => {
      const productRes = await client.query<{ id: string; stock_quantity: number; deleted_at: string | null }>(
        "select id, stock_quantity, deleted_at from public.products where id = $1 for update",
        [productId]
      );

      const product = productRes.rows[0];
      if (!product || product.deleted_at) {
        throw new ApiError(404, "Không tìm thấy sản phẩm");
      }

      const nextStock = product.stock_quantity + (type === "IN" ? quantity : -quantity);
      if (nextStock < 0) {
        throw new ApiError(400, "Không thể xuất quá số lượng tồn kho");
      }

      await client.query("update public.products set stock_quantity = $1, updated_at = now() where id = $2", [
        nextStock,
        productId,
      ]);

      const insertRes = await client.query(
        `insert into public.stock_movements(product_id, type, quantity, balance_after, note, performed_by)
         values($1, $2, $3, $4, $5, $6) returning *`,
        [productId, type, quantity, nextStock, note, user.id]
      );

      return insertRes.rows[0];
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
