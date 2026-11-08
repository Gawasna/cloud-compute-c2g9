export const dynamic = "force-dynamic";

export async function GET() {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "CloudStock Telemetry Trigger API",
      description:
        "Interactive OpenAPI interface to simulate and dispatch various Telemetry error events across Sentry Cloud and self-hosted Bugsink on HP Node.",
      version: "1.0.0",
      contact: {
        name: "CloudStock DevOps Team",
      },
    },
    servers: [
      {
        url: "/",
        description: "Current environment endpoint",
      },
    ],
    components: {
      securitySchemes: {
        SecretKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "x-telemetry-debug-secret",
          description: "Required only in production environment (TELEMETRY_DEBUG_SECRET).",
        },
        SecretKeyQuery: {
          type: "apiKey",
          in: "query",
          name: "secret",
          description: "Alternative query parameter secret for testing in production.",
        },
      },
      schemas: {
        TelemetryTriggerResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "dispatched" },
            mode: {
              type: "string",
              enum: ["loose", "strict", "api_500", "api_4xx", "unhandled"],
              example: "loose",
            },
            eventId: { type: "string", example: "4a28f89c629f45df90209ab47a95b871" },
            error: {
              type: "object",
              properties: {
                name: { type: "string", example: "MockLooseTelemetryError" },
                message: { type: "string", example: "[Mock Telemetry] Triggered LOOSE error event" },
              },
            },
            rateLimit: {
              type: "object",
              properties: {
                remaining: { type: "integer", example: 4 },
                retryAfter: { type: "integer", example: 60 },
              },
            },
            targets: {
              type: "object",
              properties: {
                bugsinkConfigured: { type: "boolean", example: true },
                sentryConfigured: { type: "boolean", example: true },
                expectedDestination: { type: "string", example: "Bugsink Only" },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Forbidden: Telemetry debug endpoint is protected on production." },
          },
        },
        RateLimitResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Too Many Requests: Rate limit exceeded for event mode 'loose'." },
            mode: { type: "string", example: "loose" },
            remaining: { type: "integer", example: 0 },
            retryAfter: { type: "integer", example: 52 },
          },
        },
      },
    },
    paths: {
      "/api/debug/telemetry": {
        get: {
          summary: "Trigger mock error via GET (Quick Browser / Webhook trigger)",
          description:
            "Dispatches mock error event. In production, requires secret key and applies 5x/IP rate limit per event mode.",
          security: [{ SecretKeyHeader: [] }, { SecretKeyQuery: [] }],
          parameters: [
            {
              name: "mode",
              in: "query",
              required: true,
              schema: {
                type: "string",
                enum: ["loose", "strict", "api_500", "api_4xx", "unhandled"],
                default: "loose",
              },
              description:
                "Telemetry routing mode: 'loose' -> Bugsink only; 'strict' -> Sentry + Bugsink; 'api_500' -> simulated 500 error; 'api_4xx' -> simulated 400 error; 'unhandled' -> server throw.",
            },
            {
              name: "message",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Optional custom error message to populate stack trace / event title.",
            },
            {
              name: "secret",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Secret token (only needed on production).",
            },
          ],
          responses: {
            "200": {
              description: "Telemetry error successfully dispatched",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TelemetryTriggerResponse" },
                },
              },
            },
            "400": {
              description: "Validation or Client Error simulated via handleApiError",
            },
            "403": {
              description: "Forbidden: Invalid or missing secret token in production",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "429": {
              description: "Too Many Requests: Rate limit exceeded (5 requests / IP / event type / minute)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RateLimitResponse" },
                },
              },
            },
            "500": {
              description: "Internal Server Error simulated via handleApiError",
            },
          },
        },
        post: {
          summary: "Trigger mock error via POST (Standard API client / Swagger execution)",
          description:
            "Dispatches mock error event. In production, requires secret key and applies 5x/IP rate limit per event mode.",
          security: [{ SecretKeyHeader: [] }, { SecretKeyQuery: [] }],
          parameters: [
            {
              name: "mode",
              in: "query",
              required: true,
              schema: {
                type: "string",
                enum: ["loose", "strict", "api_500", "api_4xx", "unhandled"],
                default: "loose",
              },
            },
            {
              name: "message",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Telemetry error successfully dispatched",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TelemetryTriggerResponse" },
                },
              },
            },
            "400": {
              description: "Simulated validation 400 error",
            },
            "403": {
              description: "Forbidden in production without secret",
            },
            "429": {
              description: "Rate limit exceeded (5x / IP / event type)",
            },
            "500": {
              description: "Simulated 500 error",
            },
          },
        },
      },
    },
  };

  return Response.json(spec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
