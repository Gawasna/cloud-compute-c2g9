import { withScope, captureException, flush } from "@sentry/core";
import { resolveTelemetryConfig } from "@/lib/observability/multiplexed-transport";
import { RateLimiter, getClientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

function captureLoose(error: unknown, context?: Record<string, unknown>): string {
  return withScope((scope) => {
    scope.setTag("telemetry.strict", "false");
    scope.setLevel("error");
    if (context) scope.setExtras(context);
    return captureException(error);
  });
}

function captureStrict(error: unknown, context?: Record<string, unknown>): string {
  return withScope((scope) => {
    scope.setTag("telemetry.strict", "true");
    scope.setLevel("fatal");
    if (context) scope.setExtras(context);
    return captureException(error);
  });
}

// Global rate limiter instance for telemetry debug endpoint (5 requests per 60s window per key)
const telemetryRateLimiter = new RateLimiter(5, 60_000);

export type TelemetryErrorMode =
  | "loose"
  | "strict"
  | "api_500"
  | "api_4xx"
  | "unhandled";

function isAuthorizedProduction(req: Request): boolean {
  const s =
    req.headers.get("x-telemetry-debug-secret") ||
    new URL(req.url).searchParams.get("secret");
  const expected = process.env.TELEMETRY_DEBUG_SECRET;
  return Boolean(expected && s === expected);
}

async function handleMockTelemetry(req: Request) {
  // Production protection: Require secret token to avoid abuse & protect Sentry quota
  if (process.env.NODE_ENV === "production" && !isAuthorizedProduction(req)) {
    return Response.json({ error: "Forbidden: debug endpoint protected" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rawMode = (searchParams.get("mode") || "loose").toLowerCase();
  const customMessage = searchParams.get("message");

  const validModes: TelemetryErrorMode[] = [
    "loose",
    "strict",
    "api_500",
    "api_4xx",
    "unhandled",
  ];
  const mode: TelemetryErrorMode = validModes.includes(rawMode as TelemetryErrorMode)
    ? (rawMode as TelemetryErrorMode)
    : "loose";

  // Rate Limiting: 5 requests / IP / event type / minute on production
  const clientIp = getClientIp(req.headers);
  const rateLimitKey = `${clientIp}:${mode}`;
  const rateCheck = telemetryRateLimiter.check(rateLimitKey);

  if (process.env.NODE_ENV === "production" && !rateCheck.allowed) {
    return Response.json(
      {
        error: `Too Many Requests: Rate limit exceeded for event mode '${mode}' (Max 5 requests/min per IP).`,
        mode,
        remaining: rateCheck.remaining,
        retryAfter: rateCheck.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateCheck.retryAfter),
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": String(rateCheck.remaining),
        },
      }
    );
  }

  const timestamp = new Date().toISOString();
  const context = {
    source: "api/debug/telemetry",
    mode,
    timestamp,
    clientIp,
    nodeEnv: process.env.NODE_ENV || "development",
  };

  // Branch by Mode
  if (mode === "unhandled") {
    throw new Error(
      customMessage ||
        `[Mock Telemetry] Simulated unhandled server rejection at ${timestamp}`
    );
  }

  if (mode === "api_500") {
    const err = new Error(
      customMessage ||
        `[Mock Telemetry] Simulated internal server 500 error at ${timestamp}`
    );
    err.name = "MockInternalServerError";
    captureStrict(err, { source: "api/debug/telemetry.api_500", statusCode: 500 });
    await flush(3000);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }

  if (mode === "api_4xx") {
    const err = new Error(
      customMessage ||
        `[Mock Telemetry] Simulated client validation 400 error at ${timestamp}`
    );
    err.name = "MockValidationError";
    captureLoose(err, { source: "api/debug/telemetry.api_4xx", statusCode: 400 });
    await flush(3000);
    return Response.json({ message: err.message }, { status: 400 });
  }

  const error = new Error(
    customMessage ||
      `[Mock Telemetry] Triggered ${mode.toUpperCase()} error event at ${timestamp}`
  );
  error.name =
    mode === "strict" ? "MockStrictTelemetryError" : "MockLooseTelemetryError";

  let eventId: string;
  if (mode === "strict") {
    eventId = captureStrict(error, context);
  } else {
    eventId = captureLoose(error, context);
  }

  // Ensure envelope is dispatched through transport before returning response
  await flush(3000);

  const config = resolveTelemetryConfig();

  return Response.json(
    {
      status: "dispatched",
      mode,
      eventId,
      error: {
        name: error.name,
        message: error.message,
      },
      rateLimit: {
        remaining: rateCheck.remaining,
        retryAfter: rateCheck.retryAfter,
      },
      targets: {
        bugsinkConfigured: config.isBugsinkValid,
        sentryConfigured: config.isSentryValid,
        expectedDestination:
          mode === "strict" ? "Sentry Cloud + Bugsink" : "Bugsink Only",
      },
    },
    {
      status: 200,
      headers: {
        "X-RateLimit-Limit": "5",
        "X-RateLimit-Remaining": String(rateCheck.remaining),
      },
    }
  );
}

export async function GET(req: Request) {
  return handleMockTelemetry(req);
}

export async function POST(req: Request) {
  return handleMockTelemetry(req);
}
