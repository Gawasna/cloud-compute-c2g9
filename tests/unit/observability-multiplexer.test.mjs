import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidTelemetryDsn,
  evaluateEnvelopeRoutes,
} from "../../src/lib/observability/multiplexed-transport.ts";

describe("Unit: Observability Multiplexed Transport Routing Logic", () => {
  const SENTRY_DSN = "https://public_key@o123456.ingest.sentry.io/789012";
  const BUGSINK_DSN = "http://bugsink_key_12345@127.0.0.1:35800/1";

  describe("isValidTelemetryDsn()", () => {
    it("should reject falsy or empty values", () => {
      assert.strictEqual(isValidTelemetryDsn(undefined), false);
      assert.strictEqual(isValidTelemetryDsn(null), false);
      assert.strictEqual(isValidTelemetryDsn(""), false);
      assert.strictEqual(isValidTelemetryDsn("   "), false);
    });

    it("should reject placeholder DSNs from template configs", () => {
      assert.strictEqual(
        isValidTelemetryDsn(
          "https://your-public-key@o000000.ingest.sentry.io/0000000"
        ),
        false
      );
      assert.strictEqual(
        isValidTelemetryDsn("http://your-bugsink-key@127.0.0.1:35800/1"),
        false
      );
    });

    it("should accept valid Sentry and Bugsink DSNs", () => {
      assert.strictEqual(isValidTelemetryDsn(SENTRY_DSN), true);
      assert.strictEqual(isValidTelemetryDsn(BUGSINK_DSN), true);
      assert.strictEqual(
        isValidTelemetryDsn("http://key@100.103.109.18:35800/2"),
        true
      );
    });
  });

  describe("evaluateEnvelopeRoutes()", () => {
    const dualConfig = {
      sentryDsn: SENTRY_DSN,
      bugsinkDsn: BUGSINK_DSN,
      isSentryValid: true,
      isBugsinkValid: true,
      primaryDsn: SENTRY_DSN,
    };

    const bugsinkOnlyConfig = {
      sentryDsn: "",
      bugsinkDsn: BUGSINK_DSN,
      isSentryValid: false,
      isBugsinkValid: true,
      primaryDsn: BUGSINK_DSN,
    };

    const sentryOnlyConfig = {
      sentryDsn: SENTRY_DSN,
      bugsinkDsn: "",
      isSentryValid: true,
      isBugsinkValid: false,
      primaryDsn: SENTRY_DSN,
    };

    it("should route loose error to Bugsink ONLY when dual sinks are active (quota-safe)", () => {
      const mockParam = {
        envelope: [{}, []],
        getEvent: (types) =>
          types.includes("event")
            ? {
                level: "error",
                message: "Standard loose error",
                tags: { "telemetry.strict": "false" },
              }
            : undefined,
      };

      const routes = evaluateEnvelopeRoutes(mockParam, dualConfig);
      assert.deepStrictEqual(routes, [BUGSINK_DSN]);
    });

    it("should route strict error (level=fatal) to BOTH Sentry Cloud and Bugsink", () => {
      const mockParam = {
        envelope: [{}, []],
        getEvent: (types) =>
          types.includes("event")
            ? {
                level: "fatal",
                message: "Fatal system outage",
              }
            : undefined,
      };

      const routes = evaluateEnvelopeRoutes(mockParam, dualConfig);
      assert.ok(routes.includes(BUGSINK_DSN), "Must include Bugsink");
      assert.ok(routes.includes(SENTRY_DSN), "Must include Sentry Cloud");
      assert.strictEqual(routes.length, 2);
    });

    it("should route strict error with telemetry.strict=true tag to BOTH sinks", () => {
      const mockParam = {
        envelope: [{}, []],
        getEvent: (types) =>
          types.includes("event")
            ? {
                level: "error",
                message: "Critical payment failure",
                tags: { "telemetry.strict": "true" },
              }
            : undefined,
      };

      const routes = evaluateEnvelopeRoutes(mockParam, dualConfig);
      assert.ok(routes.includes(BUGSINK_DSN));
      assert.ok(routes.includes(SENTRY_DSN));
      assert.strictEqual(routes.length, 2);
    });

    it("should route to Sentry as fallback when Bugsink is not configured", () => {
      const mockParam = {
        envelope: [{}, []],
        getEvent: (types) =>
          types.includes("event")
            ? {
                level: "error",
                message: "Regular error without Bugsink active",
              }
            : undefined,
      };

      const routes = evaluateEnvelopeRoutes(mockParam, sentryOnlyConfig);
      assert.deepStrictEqual(routes, [SENTRY_DSN]);
    });

    it("should route to Bugsink when only Bugsink is active (e.g. dev mode)", () => {
      const mockParam = {
        envelope: [{}, []],
        getEvent: (types) =>
          types.includes("event")
            ? {
                level: "error",
                message: "Dev mode mock error",
              }
            : undefined,
      };

      const routes = evaluateEnvelopeRoutes(mockParam, bugsinkOnlyConfig);
      assert.deepStrictEqual(routes, [BUGSINK_DSN]);
    });

    it("should route transaction (APM trace) to Sentry ONLY, never to Bugsink", () => {
      const mockParam = {
        envelope: [{}, []],
        getEvent: (types) =>
          types.includes("transaction")
            ? {
                type: "transaction",
                transaction: "GET /api/products",
              }
            : undefined,
      };

      const routes = evaluateEnvelopeRoutes(mockParam, dualConfig);
      assert.deepStrictEqual(routes, [SENTRY_DSN]);
    });

    it("should drop transaction (return empty array) when Sentry is not configured", () => {
      const mockParam = {
        envelope: [{}, []],
        getEvent: (types) =>
          types.includes("transaction")
            ? {
                type: "transaction",
                transaction: "GET /api/health",
              }
            : undefined,
      };

      const routes = evaluateEnvelopeRoutes(mockParam, bugsinkOnlyConfig);
      assert.deepStrictEqual(
        routes,
        [],
        "Bugsink must never receive transaction envelopes"
      );
    });
  });
});
