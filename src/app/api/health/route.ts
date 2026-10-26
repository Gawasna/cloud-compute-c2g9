import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_TIMEOUT_MS = 4000;

interface DatabaseHealth {
  status: "connected" | "unconfigured" | "error";
  latency_ms: number | null;
  error?: string;
}

/**
 * Production Health & Supabase Keep-Alive Route Handler
 * Endpoint: GET /api/health
 * 
 * Functions:
 * 1. Responds to external watchdog heartbeats (e.g., Uptime Kuma on HP Node).
 * 2. Actively pings Supabase PostgREST to generate DB query activity,
 *    preventing Supabase Free Tier auto-pause after 7 days of inactivity.
 */
export async function GET() {
  const startTime = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let dbHealth: DatabaseHealth = {
    status: "unconfigured",
    latency_ms: null,
  };

  if (supabaseUrl && anonKey && !supabaseUrl.includes("your-project-ref")) {
    const pingStart = Date.now();
    try {
      // Actively queries Supabase PostgREST gateway to keep connection alive
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        cache: "no-store",
      });

      const latency = Date.now() - pingStart;

      // HTTP 200 (schema spec) or 404 indicates PostgREST and backend DB are actively responding
      if (response.ok || response.status === 200 || response.status === 404) {
        dbHealth = {
          status: "connected",
          latency_ms: latency,
        };
      } else {
        dbHealth = {
          status: "error",
          latency_ms: latency,
          error: `Supabase returned unexpected HTTP status: ${response.status}`,
        };
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Database ping failed";
      dbHealth = {
        status: "error",
        latency_ms: Date.now() - pingStart,
        error: errorMessage,
      };
    }
  }

  const isHealthy = dbHealth.status !== "error";
  const httpStatus = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      database: dbHealth,
    },
    { status: httpStatus }
  );
}
