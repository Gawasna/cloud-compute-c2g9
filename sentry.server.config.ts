// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
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

  transport: createMultiplexedTelemetryTransport(Sentry.makeNodeTransport),

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
