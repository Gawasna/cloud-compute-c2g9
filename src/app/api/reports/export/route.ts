import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

function escapeCsvCell(input: unknown): string {
  const plain = String(input ?? "");
  // Chống CSV formula injection khi mở trong spreadsheet software (Excel, Calc)
  const safe = /^[\s\u0000-\u001f]*[=+@\-]/.test(plain) ? `'${plain}` : plain;
  return `"${safe.replace(/"/g, '""')}"`;
}

function encodeCsv(columns: string[], rows: unknown[][]): string {
  const header = columns.map(escapeCsvCell).join(",");
  const body = rows.map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");
  return "\ufeff" + header + (body ? "\r\n" + body : "");
}

export async function GET(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin", "viewer"]);

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") || "inventory";

    if (!["inventory", "low-stock", "movements"].includes(kind)) {
      return NextResponse.json({ message: "Loại báo cáo không hợp lệ" }, { status: 400 });
    }

    let columns: string[] = [];
    let rows: unknown[][] = [];

    if (kind === "inventory") {
      const res = await query(
        `select p.sku, p.name, c.name as category, u.symbol as unit,
          p.stock_quantity, p.minimum_stock, p.cost_price, (p.stock_quantity * p.cost_price) as inventory_value
        from public.products p
        join public.categories c on c.id = p.category_id
        join public.units u on u.id = p.unit_id
        where p.deleted_at is null
        order by p.sku`
      );
      columns = ["SKU", "Tên sản phẩm", "Danh mục", "Đơn vị", "Tồn kho", "Ngưỡng tối thiểu", "Giá vốn (VND)", "Giá trị tồn (VND)"];
      rows = res.rows.map((x) => [
        x.sku,
        x.name,
        x.category,
        x.unit,
        x.stock_quantity,
        x.minimum_stock,
        x.cost_price,
        x.inventory_value,
      ]);
    } else if (kind === "low-stock") {
      const res = await query(
        `select sku, name, stock_quantity, minimum_stock,
          greatest(minimum_stock - stock_quantity, 0) as shortage,
          case when stock_quantity = 0 then 'Hết hàng' else 'Sắp hết' end as status
        from public.products
        where deleted_at is null and (stock_quantity = 0 or stock_quantity < minimum_stock)
        order by stock_quantity, sku`
      );
      columns = ["SKU", "Tên sản phẩm", "Tồn kho", "Ngưỡng tối thiểu", "Cần bổ sung", "Trạng thái"];
      rows = res.rows.map((x) => [
        x.sku,
        x.name,
        x.stock_quantity,
        x.minimum_stock,
        x.shortage,
        x.status,
      ]);
    } else {
      const res = await query(
        `select m.created_at, p.sku, p.name, m.type, m.quantity, m.balance_after,
          coalesce(pr.display_name, '') as actor, coalesce(m.note, '') as note
        from public.stock_movements m
        join public.products p on p.id = m.product_id
        left join public.profiles pr on pr.id = m.performed_by
        order by m.created_at desc, m.id desc`
      );
      columns = ["Thời gian (UTC)", "SKU", "Tên sản phẩm", "Loại", "Số lượng", "Tồn sau giao dịch", "Người thực hiện", "Ghi chú"];
      rows = res.rows.map((x) => [
        new Date(x.created_at).toISOString(),
        x.sku,
        x.name,
        x.type,
        x.quantity,
        x.balance_after,
        x.actor,
        x.note,
      ]);
    }

    const csvContent = encodeCsv(columns, rows);
    const dateStr = new Date().toISOString().slice(0, 10);

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cloudstock-${kind}-${dateStr}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
