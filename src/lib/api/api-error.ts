/**
 * Dependency-free error model (no `next/*`, no `server-only`) so it can be unit-tested
 * directly by the Node test runner. `handleApiError` in ./errors.ts wraps it into a NextResponse.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  /** Messages of exposed errors are written for end users and are safe to return. */
  readonly expose = true;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export interface ErrorResult {
  status: number;
  message: string;
  /** True when the original error is unexpected and must be reported to telemetry. */
  report: boolean;
}

const GENERIC_SERVER_ERROR = "Lỗi máy chủ nội bộ. Vui lòng thử lại sau.";

function isExposedError(error: unknown): error is Error & { statusCode: number } {
  if (!(error instanceof Error)) return false;
  const e = error as Error & { statusCode?: unknown; expose?: unknown };
  return e.expose === true && typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 500;
}

/**
 * Maps any thrown value to a safe HTTP result.
 * - Expected, user-facing errors (4xx) keep their message.
 * - Known PostgreSQL constraint codes get a friendly 409.
 * - Everything else becomes a generic 500: internal messages (SQL, hostnames, stack hints)
 *   are never returned to the client.
 */
export function toErrorResult(error: unknown): ErrorResult {
  if (error instanceof ApiError) {
    return { status: error.statusCode, message: error.message, report: error.statusCode >= 500 };
  }
  if (isExposedError(error)) {
    return { status: error.statusCode, message: error.message, report: false };
  }
  const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
  if (code === "23505") {
    return { status: 409, message: "Dữ liệu bị trùng lặp (SKU hoặc mã đã tồn tại).", report: false };
  }
  if (code === "23503") {
    return {
      status: 409,
      message: "Dữ liệu đang được liên kết bởi bản ghi khác hoặc tham chiếu không hợp lệ.",
      report: false,
    };
  }
  if (code === "23514") {
    return { status: 400, message: "Dữ liệu vi phạm ràng buộc hợp lệ của hệ thống.", report: false };
  }
  return { status: 500, message: GENERIC_SERVER_ERROR, report: true };
}
