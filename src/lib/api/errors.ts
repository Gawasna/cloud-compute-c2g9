import "server-only";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { ApiError, toErrorResult } from "./api-error";

export { ApiError };

export function handleApiError(error: unknown): NextResponse {
  const result = toErrorResult(error);
  if (result.report) {
    // Full details go to telemetry/server logs only, never to the HTTP response.
    console.error("[api] unexpected error:", error);
    try {
      Sentry.captureException(error);
    } catch {
      /* telemetry must never break the request */
    }
  }
  return NextResponse.json({ message: result.message }, { status: result.status });
}
