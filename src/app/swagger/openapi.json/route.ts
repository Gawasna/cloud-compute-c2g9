export const dynamic = "force-dynamic";

export async function GET() {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "CloudStock Telemetry Trigger API",
      description:
        "Comprehensive OpenAPI 3.0.3 documentation for CloudStock Enterprise Cloud Inventory Management & Telemetry Multiplexing System (Sentry Cloud + Bugsink HP Node).",
      version: "1.0.0",
      contact: {
        name: "CloudStock Engineering Team",
      },
    },
    servers: [
      {
        url: "/",
        description: "Current environment endpoint (Direct / Vercel Edge)",
      },
    ],
    tags: [
      { name: "Telemetry & Debug", description: "Telemetry error trigger & multiplexing diagnostics" },
      { name: "Auth", description: "Authentication, session grant, JWT cookies & profile" },
      { name: "Products", description: "Inventory items, SKU management, pricing & stock" },
      { name: "Categories", description: "Product categories hierarchy" },
      { name: "Units", description: "Standard measurement units" },
      { name: "Stock Movements", description: "Atomic stock inbound, outbound and adjustment transactions" },
      { name: "Reports & Analytics", description: "Phase 6 Serverless business intelligence & export" },
      { name: "Users", description: "RBAC user administration (Admin only)" },
      { name: "Health & System", description: "System status & database probe" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your Supabase JWT session token or authenticate via cookies.",
        },
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
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "admin@cloudstock.dev" },
            password: { type: "string", format: "password", example: "Password123!" },
          },
        },
        ProductItem: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            sku: { type: "string", example: "WH-APP-001" },
            name: { type: "string", example: "Industrial Router 5G" },
            categoryId: { type: "string", format: "uuid" },
            unitId: { type: "string", format: "uuid" },
            currentStock: { type: "number", example: 120 },
            minimumStock: { type: "number", example: 20 },
            costPrice: { type: "number", example: 2500000 },
          },
        },
        MovementInput: {
          type: "object",
          required: ["productId", "type", "quantity"],
          properties: {
            productId: { type: "string", format: "uuid" },
            type: { type: "string", enum: ["IN", "OUT", "ADJUST"] },
            quantity: { type: "number", minimum: 1, example: 10 },
            note: { type: "string", example: "Nhập kho đợt 1 tháng 11" },
          },
        },
      },
    },
    paths: {
      "/api/debug/telemetry": {
        get: {
          tags: ["Telemetry & Debug"],
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
                "Error severity mode:\n- loose: Non-critical, Bugsink only\n- strict: Fatal/P0, Sentry + Bugsink\n- api_500: Server exception via handleApiError\n- api_4xx: Bad Request 400\n- unhandled: Unhandled rejection",
            },
            {
              name: "message",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Optional custom message for telemetry event",
            },
            {
              name: "secret",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Production secret key (TELEMETRY_DEBUG_SECRET)",
            },
          ],
          responses: {
            "200": {
              description: "Telemetry event captured and dispatched successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TelemetryTriggerResponse" },
                },
              },
            },
            "400": {
              description: "Invalid error mode parameter",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Unauthorized on production environment (Invalid or missing secret)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "429": {
              description: "Rate limit exceeded (5 requests/minute per IP per event mode)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RateLimitResponse" },
                },
              },
            },
            "500": {
              description: "Simulated internal server error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
        post: {
          tags: ["Telemetry & Debug"],
          summary: "Trigger mock error via POST (JSON payload trigger)",
          description:
            "Dispatches mock error event with optional JSON payload. Rate limited and protected on production.",
          security: [{ SecretKeyHeader: [] }, { SecretKeyQuery: [] }],
          parameters: [
            {
              name: "mode",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["loose", "strict", "api_500", "api_4xx", "unhandled"],
                default: "loose",
              },
              description: "Fallback mode query param if not specified in body",
            },
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    mode: {
                      type: "string",
                      enum: ["loose", "strict", "api_500", "api_4xx", "unhandled"],
                      default: "loose",
                    },
                    message: {
                      type: "string",
                      example: "Custom test error payload triggered from Swagger UI",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Telemetry event captured and dispatched successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TelemetryTriggerResponse" },
                },
              },
            },
            "403": {
              description: "Unauthorized on production environment",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "429": {
              description: "Rate limit exceeded",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RateLimitResponse" },
                },
              },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Authenticate user and issue session cookies",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Login successful, cookies set" },
            "400": { description: "Invalid credentials or malformed input" },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Revoke session and clear cookies",
          responses: {
            "200": { description: "Logged out successfully" },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get current authenticated user profile and role",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "User session details" },
            "401": { description: "Not authenticated" },
          },
        },
      },
      "/api/products": {
        get: {
          tags: ["Products"],
          summary: "List inventory products with pagination and search",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "search", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Paginated product list" },
          },
        },
        post: {
          tags: ["Products"],
          summary: "Create a new inventory product (Admin only)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductItem" },
              },
            },
          },
          responses: {
            "201": { description: "Product created" },
            "403": { description: "Forbidden - requires Admin role" },
          },
        },
      },
      "/api/products/{id}": {
        get: {
          tags: ["Products"],
          summary: "Get product details by UUID",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Product details" },
            "404": { description: "Product not found" },
          },
        },
        put: {
          tags: ["Products"],
          summary: "Update product by UUID (Admin only)",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ProductItem" } } },
          },
          responses: {
            "200": { description: "Product updated" },
          },
        },
        delete: {
          tags: ["Products"],
          summary: "Soft delete product (Admin only)",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Product deleted" },
          },
        },
      },
      "/api/categories": {
        get: {
          tags: ["Categories"],
          summary: "List all product categories",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Category list" } },
        },
        post: {
          tags: ["Categories"],
          summary: "Create new category (Admin only)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: { name: { type: "string" }, description: { type: "string" } },
                },
              },
            },
          },
          responses: { "201": { description: "Category created" } },
        },
      },
      "/api/units": {
        get: {
          tags: ["Units"],
          summary: "List measurement units",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Units list" } },
        },
      },
      "/api/movements": {
        get: {
          tags: ["Stock Movements"],
          summary: "List stock movement history",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 50 } }],
          responses: { "200": { description: "Movement records" } },
        },
        post: {
          tags: ["Stock Movements"],
          summary: "Perform atomic stock inbound/outbound/adjustment",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/MovementInput" } } },
          },
          responses: {
            "201": { description: "Stock movement recorded successfully" },
            "400": { description: "Insufficient stock or invalid input" },
          },
        },
      },
      "/api/reports/overview": {
        get: {
          tags: ["Reports & Analytics"],
          summary: "Overview statistics (Total inventory, value, low stock count)",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Overview metrics" } },
        },
      },
      "/api/reports/low-stock": {
        get: {
          tags: ["Reports & Analytics"],
          summary: "List products under minimum threshold",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Low stock items" } },
        },
      },
      "/api/reports/movements": {
        get: {
          tags: ["Reports & Analytics"],
          summary: "Aggregated movements over a time period",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "period", in: "query", schema: { type: "string", enum: ["7d", "30d", "90d"], default: "30d" } },
          ],
          responses: { "200": { description: "Movement aggregation" } },
        },
      },
      "/api/reports/trend": {
        get: {
          tags: ["Reports & Analytics"],
          summary: "Stock intake & outgoing trends",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Trend time series" } },
        },
      },
      "/api/reports/export": {
        get: {
          tags: ["Reports & Analytics"],
          summary: "Export inventory report as CSV/Spreadsheet",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "CSV file download stream" } },
        },
      },
      "/api/dashboard": {
        get: {
          tags: ["Reports & Analytics"],
          summary: "Aggregated dashboard metrics for current role",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Dashboard summary" } },
        },
      },
      "/api/users": {
        get: {
          tags: ["Users"],
          summary: "List system users and roles (Admin only)",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Users list" } },
        },
        post: {
          tags: ["Users"],
          summary: "Create a new user account (Admin only)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password", "displayName", "role"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                    displayName: { type: "string" },
                    role: { type: "string", enum: ["admin", "staff", "viewer"] },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "User created" } },
        },
      },
      "/api/users/{id}/role": {
        patch: {
          tags: ["Users"],
          summary: "Update user role (Admin only)",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["role"],
                  properties: { role: { type: "string", enum: ["admin", "staff", "viewer"] } },
                },
              },
            },
          },
          responses: { "200": { description: "Role updated" } },
        },
      },
      "/api/users/{id}/status": {
        patch: {
          tags: ["Users"],
          summary: "Activate or deactivate user account (Admin only)",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["isActive"],
                  properties: { isActive: { type: "boolean" } },
                },
              },
            },
          },
          responses: { "200": { description: "Status updated" } },
        },
      },
      "/api/health": {
        get: {
          tags: ["Health & System"],
          summary: "System health check and database connectivity",
          responses: {
            "200": { description: "Healthy" },
            "503": { description: "Database unreachable" },
          },
        },
      },
    },
  };

  return Response.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
