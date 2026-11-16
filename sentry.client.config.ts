// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  resolveTelemetryConfig,
  createMultiplexedTelemetryTransport,
} from "./src/lib/observability/multiplexed-transport";
import { captureLooseError } from "./src/lib/observability";

const { primaryDsn, isSentryValid } = resolveTelemetryConfig();

Sentry.init({
  dsn: primaryDsn,
  environment: process.env.NODE_ENV || "development",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: isSentryValid ? 1.0 : 0.0,

  transport: createMultiplexedTelemetryTransport(),

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});

if (typeof window !== "undefined") {
  window.addEventListener("securitypolicyviolation", (event) => {
    try {
      captureLooseError(
        new Error(
          `Content Security Policy violation: Blocked ${event.blockedURI} by directive '${event.violatedDirective}'`
        ),
        {
          directive: event.violatedDirective,
          blockedUri: event.blockedURI,
          sourceFile: event.sourceFile,
          lineNumber: event.lineNumber,
          columnNumber: event.columnNumber,
          statusCode: event.statusCode,
        }
      );
    } catch {
      // telemetry safety
    }
  });
}
