import * as Sentry from "@sentry/nextjs";
import {
  captureLooseError,
  captureStrictError,
  resolveTelemetryConfig,
} from "@/lib/observability";

export const dynamic = "force-dynamic";

async function handleMockTelemetry(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "Forbidden: Telemetry mock endpoint is disabled in production." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode")?.toLowerCase() === "strict" ? "strict" : "loose";

  const error = new Error(
    `[Mock Telemetry] Triggered ${mode.toUpperCase()} error event at ${new Date().toISOString()}`
  );
  error.name = mode === "strict" ? "MockStrictTelemetryError" : "MockLooseTelemetryError";

  const context = {
    source: "api/debug/telemetry",
    mode,
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || "development",
  };

  let eventId: string;
  if (mode === "strict") {
    eventId = captureStrictError(error, context);
  } else {
    eventId = captureLooseError(error, context);
  }

  // Ensure envelope is dispatched through transport before returning response
  await Sentry.flush(3000);

  const config = resolveTelemetryConfig();

  return Response.json({
    status: "dispatched",
    mode,
    eventId,
    error: {
      name: error.name,
      message: error.message,
    },
    targets: {
      bugsinkConfigured: config.isBugsinkValid,
      sentryConfigured: config.isSentryValid,
    },
  });
}

export async function GET(req: Request) {
  return handleMockTelemetry(req);
}

export async function POST(req: Request) {
  return handleMockTelemetry(req);
}
