// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  resolveTelemetryConfig,
  createMultiplexedTelemetryTransport,
} from "./src/lib/observability/multiplexed-transport";

const { primaryDsn, isSentryValid } = resolveTelemetryConfig();

Sentry.init({
  dsn: primaryDsn,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: isSentryValid ? 1.0 : 0.0,

  transport: createMultiplexedTelemetryTransport(),

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
