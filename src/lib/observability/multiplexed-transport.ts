import {
  makeMultiplexedTransport,
  type BaseTransportOptions,
  type Transport,
  type Envelope,
  type Event,
  type EnvelopeItemType,
} from "@sentry/core";
import { makeFetchTransport } from "@sentry/react";

export interface TelemetryConfig {
  sentryDsn: string | undefined;
  bugsinkDsn: string | undefined;
  isSentryValid: boolean;
  isBugsinkValid: boolean;
  primaryDsn: string | undefined;
}

/**
 * Validates whether a DSN is a legitimate endpoint rather than an unconfigured placeholder.
 */
export function isValidTelemetryDsn(dsn: string | undefined | null): boolean {
  if (!dsn || typeof dsn !== "string") {
    return false;
  }
  const trimmed = dsn.trim();
  if (
    trimmed.length === 0 ||
    trimmed.includes("o000000.ingest.sentry.io") ||
    trimmed.includes("your-public-key") ||
    trimmed.includes("your-bugsink-key") ||
    trimmed.includes("your-") ||
    trimmed.includes("example.com")
  ) {
    return false;
  }

  // Sentry DSN standard structure: http(s)://<key>@<host>[:port]/<project_id>
  return /^(https?):\/\/[^@\s]+@[^/\s]+(?::\d+)?\/[^\s]+$/.test(trimmed);
}

/**
 * Resolves active telemetry configuration from environment variables.
 */
export function resolveTelemetryConfig(): TelemetryConfig {
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  const bugsinkDsn = (
    process.env.BUGSINK_DSN ||
    process.env.NEXT_PUBLIC_BUGSINK_DSN
  )?.trim();

  const isSentryValid = isValidTelemetryDsn(sentryDsn);
  const isBugsinkValid = isValidTelemetryDsn(bugsinkDsn);

  // Sentry SDK requires a valid primary DSN to initialize the transport system.
  const primaryDsn = isSentryValid
    ? sentryDsn
    : isBugsinkValid
      ? bugsinkDsn
      : undefined;

  return {
    sentryDsn,
    bugsinkDsn,
    isSentryValid,
    isBugsinkValid,
    primaryDsn,
  };
}

/**
 * Extracts an event from an envelope based on matched item types.
 */
export function extractEventFromEnvelope(
  envelope: Envelope,
  types: EnvelopeItemType[]
): Event | undefined {
  const items = envelope[1];
  if (!Array.isArray(items)) return undefined;

  for (const item of items) {
    if (Array.isArray(item) && item[0]) {
      const itemHeader = item[0] as { type?: EnvelopeItemType };
      if (itemHeader.type && types.includes(itemHeader.type)) {
        return item[1] as Event;
      }
    }
  }
  return undefined;
}

/**
 * Evaluates envelope routing destinations based on MASTER_INFRA.puml invariant:
 * - Loose errors -> Bugsink (all errors)
 * - Strict errors -> Sentry (quota-safe subset: fatal, tagged strict, or when Bugsink is absent)
 * - Traces / replays -> Sentry only (Bugsink accepts errors only)
 */
export function evaluateEnvelopeRoutes(
  param: {
    envelope: Envelope;
    getEvent: (types?: EnvelopeItemType[]) => Event | undefined;
  },
  config: TelemetryConfig
): string[] {
  const { sentryDsn, bugsinkDsn, isSentryValid, isBugsinkValid } = config;

  // 1. Error Event Handling
  const errorEvent = param.getEvent(["event"]);
  if (errorEvent) {
    const targets: string[] = [];

    // Loose Rule: Bugsink receives all error events
    if (isBugsinkValid && bugsinkDsn) {
      targets.push(bugsinkDsn);
    }

    // Strict Rule: Sentry receives fatal errors, explicit strict tags, or acts as fallback
    const isExplicitStrict =
      errorEvent.level === "fatal" ||
      errorEvent.tags?.["telemetry.strict"] === "true" ||
      Boolean(errorEvent.extra?.["telemetry.strict"]) ||
      process.env.SENTRY_STRICT_ALL === "true";

    const shouldSendToSentry = isExplicitStrict || !isBugsinkValid;

    if (shouldSendToSentry && isSentryValid && sentryDsn) {
      targets.push(sentryDsn);
    }

    return targets;
  }

  // 2. Non-Error Telemetry (Transactions, APM traces, Replays, Profiles)
  // MASTER_INFRA Invariant: Send traces / replays to Sentry only; Bugsink accepts errors only.
  const nonErrorEvent = param.getEvent([
    "transaction",
    "replay_event",
    "profile",
  ]);
  if (nonErrorEvent) {
    if (isSentryValid && sentryDsn) {
      return [sentryDsn];
    }
    // Do NOT send non-error events to Bugsink
    return [];
  }

  // Default fallback
  return isSentryValid && sentryDsn ? [sentryDsn] : [];
}

/**
 * Factory creating a multiplexed transport wrapper for any base transport.
 */
export function createMultiplexedTelemetryTransport<
  TO extends BaseTransportOptions = BaseTransportOptions,
>(
  createBaseTransport?: (options: TO) => Transport
): (options: TO) => Transport {
  return (options: TO) => {
    const config = resolveTelemetryConfig();
    const baseFactory =
      createBaseTransport ||
      ((opts: TO) => makeFetchTransport(opts as Parameters<typeof makeFetchTransport>[0]));

    const multiplexedFactory = makeMultiplexedTransport(
      baseFactory,
      (param) => evaluateEnvelopeRoutes(param, config)
    );

    const transport = multiplexedFactory(options);

    return {
      ...transport,
      send: async (envelope: Envelope) => {
        // Guard: If Sentry is not configured and only Bugsink is active,
        // intercept and suppress non-error envelopes so Bugsink is never polluted.
        if (!config.isSentryValid) {
          const nonError = extractEventFromEnvelope(envelope, [
            "transaction",
            "replay_event",
            "profile",
          ]);
          if (nonError) {
            return { statusCode: 200 };
          }
        }
        return transport.send(envelope);
      },
    };
  };
}
