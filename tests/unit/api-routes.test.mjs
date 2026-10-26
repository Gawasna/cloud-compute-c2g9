import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("Unit: Next.js API Route Handlers Integrity & Security", () => {
  const routes = [
    "src/app/api/auth/me/route.ts",
    "src/app/api/products/route.ts",
    "src/app/api/products/[id]/route.ts",
    "src/app/api/categories/route.ts",
    "src/app/api/categories/[id]/route.ts",
    "src/app/api/units/route.ts",
    "src/app/api/movements/route.ts",
    "src/app/api/dashboard/route.ts",
    "src/app/api/reports/low-stock/route.ts",
    "src/app/api/reports/movements/route.ts",
    "src/app/api/users/route.ts",
    "src/app/api/users/[id]/role/route.ts",
    "src/app/api/users/[id]/status/route.ts",
  ];

  it("should have all required migrated API route files existing", () => {
    for (const route of routes) {
      assert.strictEqual(
        existsSync(resolve(process.cwd(), route)),
        true,
        `Route handler file must exist: ${route}`
      );
    }
  });

  it("should enforce 'server-only' import at line 1 in all route handlers and server libs", () => {
    const allServerFiles = [
      ...routes,
      "src/lib/db/client.ts",
      "src/lib/auth/server.ts",
      "src/lib/auth/admin.ts",
      "src/lib/auth/guard.ts",
      "src/lib/auth/profile-cache.ts",
      "src/lib/auth/token.ts",
      "src/lib/auth/types.ts",
      "src/lib/api/errors.ts",
      "src/lib/utils/validation.ts",
    ];

    for (const file of allServerFiles) {
      const content = readFileSync(resolve(process.cwd(), file), "utf8");
      const lines = content.split(/\r?\n/);
      assert.strictEqual(
        lines[0].trim(),
        'import "server-only";',
        `File ${file} must have 'import "server-only";' at line 1`
      );
    }
  });

  it("should ensure backend directory is completely removed", () => {
    assert.strictEqual(
      existsSync(resolve(process.cwd(), "backend")),
      false,
      "backend directory must not exist"
    );
  });

  it("should verify safe email regex and ReDoS resistance in user route", () => {
    const userRouteContent = readFileSync(
      resolve(process.cwd(), "src/app/api/users/route.ts"),
      "utf8"
    );

    // Ensure the old vulnerable pattern is NOT present
    assert.strictEqual(
      userRouteContent.includes("/^\\S+@\\S+\\.\\S+$/"),
      false,
      "Vulnerable regex pattern must be eliminated"
    );

    // Ensure safe regex or validation logic is present
    assert.ok(
      userRouteContent.includes("isValidEmail") || userRouteContent.includes("SAFE_EMAIL_REGEX"),
      "Safe email validator function must be implemented"
    );
  });

  it("should ensure default client API base URLs use relative /api path", () => {
    const cloudstockApi = readFileSync(
      resolve(process.cwd(), "src/lib/api/cloudstock.ts"),
      "utf8"
    );
    assert.ok(
      cloudstockApi.includes("'/api'"),
      "BASE URL in cloudstock.ts must default to /api"
    );

    const clientAuth = readFileSync(
      resolve(process.cwd(), "src/lib/auth/client.ts"),
      "utf8"
    );
    assert.ok(
      clientAuth.includes("'/api'"),
      "apiUrl in client.ts must default to /api"
    );
  });

  it("should ensure globalThis singleton pattern in db client and auth admin client", () => {
    const dbClient = readFileSync(
      resolve(process.cwd(), "src/lib/db/client.ts"),
      "utf8"
    );
    assert.ok(
      dbClient.includes("globalThis as unknown as { __dbPool: Pool | undefined }"),
      "db client must use globalThis singleton to prevent HMR connection leak"
    );
    assert.ok(
      dbClient.includes("DATABASE_POOL_SIZE"),
      "db client must support configurable DATABASE_POOL_SIZE"
    );

    const authAdmin = readFileSync(
      resolve(process.cwd(), "src/lib/auth/admin.ts"),
      "utf8"
    );
    assert.ok(
      authAdmin.includes("globalThis as unknown as") && authAdmin.includes("__supabaseAdmin: SupabaseClient | undefined"),
      "auth admin client must use globalThis singleton for getSupabaseAdminClient"
    );

    const authServer = readFileSync(
      resolve(process.cwd(), "src/lib/auth/server.ts"),
      "utf8"
    );
    assert.ok(
      authServer.includes("getSupabaseAdminClient"),
      "auth server facade must export getSupabaseAdminClient"
    );
  });

  it("should verify UUID validation helper and error code mappings in auth server", () => {
    const validationModule = readFileSync(
      resolve(process.cwd(), "src/lib/utils/validation.ts"),
      "utf8"
    );
    assert.ok(
      validationModule.includes("export function isValidUuid"),
      "validation utility must export isValidUuid validator"
    );

    const errorsModule = readFileSync(
      resolve(process.cwd(), "src/lib/api/errors.ts"),
      "utf8"
    );
    assert.ok(
      errorsModule.includes('"23505"'),
      "handleApiError must map PostgreSQL unique violation 23505 to 409"
    );
    assert.ok(
      errorsModule.includes('"23503"'),
      "handleApiError must map PostgreSQL foreign key violation 23503 to 409"
    );

    const authServer = readFileSync(
      resolve(process.cwd(), "src/lib/auth/server.ts"),
      "utf8"
    );
    assert.ok(
      authServer.includes("isValidUuid") && authServer.includes("handleApiError"),
      "auth server facade must re-export isValidUuid and handleApiError for backwards compatibility"
    );
  });

  it("should verify routes enforce isValidUuid for UUID identifiers", () => {
    const productRoute = readFileSync(
      resolve(process.cwd(), "src/app/api/products/route.ts"),
      "utf8"
    );
    assert.ok(
      productRoute.includes("isValidUuid(categoryId)") && productRoute.includes("isValidUuid(unitId)"),
      "products route must validate categoryId and unitId UUID format"
    );

    const movementRoute = readFileSync(
      resolve(process.cwd(), "src/app/api/movements/route.ts"),
      "utf8"
    );
    assert.ok(
      movementRoute.includes("isValidUuid(productId)"),
      "movements route must validate productId UUID format"
    );
  });

  it("should enforce warm database pool with at least 5-minute idle timeout", () => {
    const dbClient = readFileSync(
      resolve(process.cwd(), "src/lib/db/client.ts"),
      "utf8"
    );
    assert.ok(
      dbClient.includes("300000"),
      "db client pool must configure at least 300000ms (5min) idleTimeoutMillis to prevent handshake spikes"
    );
  });

  it("should verify local JWKS verification and promise in-flight coalescing in auth server", () => {
    const tokenModule = readFileSync(
      resolve(process.cwd(), "src/lib/auth/token.ts"),
      "utf8"
    );
    assert.ok(
      tokenModule.includes("createRemoteJWKSet") && tokenModule.includes("jwtVerify"),
      "auth token module must use jose JWKS for local token verification"
    );
    assert.ok(
      tokenModule.includes('audience: "authenticated"'),
      "local JWT verify must enforce audience: 'authenticated' to reject anon keys"
    );

    const profileCacheModule = readFileSync(
      resolve(process.cwd(), "src/lib/auth/profile-cache.ts"),
      "utf8"
    );
    assert.ok(
      profileCacheModule.includes("__inFlightProfiles"),
      "profile cache module must implement in-flight promise coalescing to eliminate cache stampede"
    );

    const authServer = readFileSync(
      resolve(process.cwd(), "src/lib/auth/server.ts"),
      "utf8"
    );
    assert.ok(
      authServer.includes("verifyToken") && authServer.includes("authenticateUser"),
      "auth server facade must export verification and authentication APIs"
    );
  });
});
