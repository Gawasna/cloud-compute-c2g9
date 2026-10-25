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
});
