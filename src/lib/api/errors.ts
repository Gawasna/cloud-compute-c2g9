import "server-only";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ message: error.message }, { status: error.statusCode });
  }

  if (error instanceof Error) {
    const pgError = error as Error & { code?: string };
    if (pgError.code === "23505") {
      return NextResponse.json(
        { message: "Dữ liệu bị trùng lặp (SKU hoặc mã đã tồn tại)." },
        { status: 409 }
      );
    }
    if (pgError.code === "23503") {
      return NextResponse.json(
        { message: "Dữ liệu đang được liên kết bởi bản ghi khác hoặc tham chiếu không hợp lệ." },
        { status: 409 }
      );
    }

    const message = pgError.message || "Lỗi máy chủ nội bộ";
    return NextResponse.json({ message }, { status: 500 });
  }

  return NextResponse.json({ message: "Lỗi máy chủ nội bộ" }, { status: 500 });
}
