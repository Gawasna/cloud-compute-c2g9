/**
 * Stock movement domain logic. Kept free of `next/*` so it can be exercised directly by the
 * Node test runner (unit tests with a fake client + integration tests against real PostgreSQL).
 */
export type MovementType = "IN" | "OUT";

export class StockError extends Error {
  readonly statusCode: number;
  readonly expose = true;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "StockError";
    this.statusCode = statusCode;
  }
}

export type Row = Record<string, unknown>;

/** Minimal shape shared by pg.PoolClient and test doubles. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[]; rowCount?: number | null }>;
}

export interface MovementInput {
  productId: string;
  type: MovementType;
  quantity: number;
  note: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QUANTITY = 1_000_000; // stock_quantity is a 32-bit integer; keep a wide safety margin

export function parseMovementInput(body: unknown): MovementInput {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const productId = String(b.productId ?? "").trim();
  const note = b.note ? String(b.note).trim() : null;
  const quantity = typeof b.quantity === "string" && b.quantity.trim() !== "" ? Number(b.quantity) : b.quantity;

  if (!UUID_REGEX.test(productId)) {
    throw new StockError(400, "Mã sản phẩm không hợp lệ (yêu cầu định dạng UUID)");
  }
  if (b.type !== "IN" && b.type !== "OUT") {
    throw new StockError(400, "Loại biến động phải là IN hoặc OUT");
  }
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
    throw new StockError(400, "Số lượng phải là số nguyên dương (tối thiểu 1)");
  }
  if (quantity > MAX_QUANTITY) {
    throw new StockError(400, `Số lượng mỗi phiếu không được vượt quá ${MAX_QUANTITY.toLocaleString("en-US")}`);
  }
  if (note && note.length > 500) {
    throw new StockError(400, "Ghi chú không được vượt quá 500 ký tự");
  }
  return { productId, type: b.type, quantity, note };
}

/**
 * Applies one movement. MUST run inside a transaction (BEGIN ... COMMIT) supplied by the caller:
 * the `FOR UPDATE` row lock serialises concurrent movements on the same product so stock can
 * never go negative and `balance_after` is always consistent.
 */
export async function applyStockMovement(
  client: Queryable,
  input: MovementInput,
  performedBy: string
): Promise<Row> {
  const productRes = await client.query(
    "select id, stock_quantity, deleted_at from public.products where id = $1 for update",
    [input.productId]
  );
  const product = productRes.rows[0] as unknown as { id: string; stock_quantity: number; deleted_at: string | null } | undefined;
  if (!product || product.deleted_at) {
    throw new StockError(404, "Không tìm thấy sản phẩm");
  }

  const nextStock = product.stock_quantity + (input.type === "IN" ? input.quantity : -input.quantity);
  if (nextStock < 0) {
    throw new StockError(400, "Không thể xuất quá số lượng tồn kho");
  }
  if (nextStock > 2_147_483_647) {
    throw new StockError(400, "Số lượng tồn kho vượt quá giới hạn cho phép");
  }

  await client.query("update public.products set stock_quantity = $1, updated_at = now() where id = $2", [
    nextStock,
    input.productId,
  ]);

  const insertRes = await client.query(
    `insert into public.stock_movements(product_id, type, quantity, balance_after, note, performed_by)
     values($1, $2, $3, $4, $5, $6) returning *`,
    [input.productId, input.type, input.quantity, nextStock, input.note, performedBy]
  );
  return insertRes.rows[0];
}
