import * as Sentry from "@sentry/nextjs";

export * from "./multiplexed-transport";

/**
 * Captures a non-critical / loose error event.
 * Routed to Bugsink to avoid consuming Sentry quota.
 */
export function captureLooseError(
  error: unknown,
  context?: Record<string, unknown>
): string {
  return Sentry.withScope((scope) => {
    scope.setTag("telemetry.strict", "false");
    scope.setLevel("error");
    if (context) {
      scope.setExtras(context);
    }
    return Sentry.captureException(error);
  });
}

/**
 * Captures a critical / production-breaking error event.
 * Routed with strict priority to both Sentry Cloud and Bugsink.
 */
export function captureStrictError(
  error: unknown,
  context?: Record<string, unknown>
): string {
  return Sentry.withScope((scope) => {
    scope.setTag("telemetry.strict", "true");
    scope.setLevel("fatal");
    if (context) {
      scope.setExtras(context);
    }
    return Sentry.captureException(error);
  });
}
