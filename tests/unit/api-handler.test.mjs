import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Unit: Server-side Higher-Order Route Handler (createApiHandler)", () => {
  const handlerFilePath = path.resolve(process.cwd(), "src/lib/api/handler.ts");
  const authServerFilePath = path.resolve(process.cwd(), "src/lib/auth/server.ts");

  it("should enforce 'server-only' at line 1 in src/lib/api/handler.ts", () => {
    assert.ok(fs.existsSync(handlerFilePath), "handler.ts must exist");
    const content = fs.readFileSync(handlerFilePath, "utf8");
    const firstLine = content.split(/\r?\n/)[0].trim();
    assert.strictEqual(firstLine, 'import "server-only";');
  });

  it("should export createApiHandler and core types from handler.ts", () => {
    const content = fs.readFileSync(handlerFilePath, "utf8");
    assert.ok(
      content.includes("export function createApiHandler"),
      "handler.ts must export createApiHandler function"
    );
    assert.ok(
      content.includes("export interface ApiHandlerContext"),
      "handler.ts must export ApiHandlerContext interface"
    );
    assert.ok(
      content.includes("export interface ApiHandlerOptions"),
      "handler.ts must export ApiHandlerOptions interface"
    );
  });

  it("should re-export createApiHandler from auth server facade", () => {
    const content = fs.readFileSync(authServerFilePath, "utf8");
    assert.ok(
      content.includes("createApiHandler"),
      "auth/server.ts must re-export createApiHandler"
    );
  });

  it("should verify telemetry and header injection contracts in createApiHandler source", () => {
    const content = fs.readFileSync(handlerFilePath, "utf8");
    assert.ok(
      content.includes('headers.set("x-request-id"'),
      "Must inject x-request-id header"
    );
    assert.ok(
      content.includes('headers.set("x-response-time"'),
      "Must inject x-response-time header"
    );
    assert.ok(
      content.includes('headers.set("Server-Timing"'),
      "Must inject Server-Timing header"
    );
    assert.ok(
      content.includes("handleApiError(error)"),
      "Must catch all exceptions and delegate to handleApiError"
    );
    assert.ok(
      content.includes("authenticateUser(request)"),
      "Must call authenticateUser when auth is enabled"
    );
    assert.ok(
      content.includes("requireRoles(user, options.roles)"),
      "Must call requireRoles when roles are configured"
    );
  });
});
