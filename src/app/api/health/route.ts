import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Production Health Route Handler
 * Endpoint: GET /api/health
 * Target for external heartbeat monitoring (e.g. GitHub Actions Cron, Uptime monitors).
 * Strictly isolated from local developer diagnostic tooling.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
