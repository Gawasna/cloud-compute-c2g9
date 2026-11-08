import "server-only";
import { NextResponse } from "next/server";
import { captureLooseError, captureStrictError } from "@/lib/observability";
import { ApiError, toErrorResult } from "./api-error";

export { ApiError };

export function handleApiError(error: unknown): NextResponse {
  const result = toErrorResult(error);

  if (result.report) {
    // Unexpected internal / 500 error: report to Sentry (strict)
    console.error("[api] unexpected error:", error);
    try {
      captureStrictError(error, {
        source: "handleApiError.internal",
        statusCode: result.status,
      });
    } catch {
      /* telemetry must never break the request */
    }
  } else if (result.status >= 400 && result.status !== 404 && result.status !== 401) {
    // Expected client or business validation errors: record in Bugsink (loose)
    try {
      captureLooseError(error, {
        source: "handleApiError.loose",
        statusCode: result.status,
      });
    } catch {
      /* telemetry must never break the request */
    }
  }

  return NextResponse.json({ message: result.message }, { status: result.status });
}
