import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Unit: API Error Handler & Telemetry Integration", () => {
  const errorsFilePath = path.resolve(process.cwd(), "src/lib/api/errors.ts");
  const globalErrorPath = path.resolve(process.cwd(), "src/app/global-error.tsx");
  const errorPath = path.resolve(process.cwd(), "src/app/error.tsx");

  it("should enforce 'server-only' at line 1 in src/lib/api/errors.ts", () => {
    assert.ok(fs.existsSync(errorsFilePath), "errors.ts must exist");
    const content = fs.readFileSync(errorsFilePath, "utf8");
    const firstLine = content.split(/\r?\n/)[0].trim();
    assert.strictEqual(firstLine, 'import "server-only";');
  });

  it("should integrate captureStrictError and captureLooseError in handleApiError", () => {
    const content = fs.readFileSync(errorsFilePath, "utf8");
    assert.ok(
      content.includes('import { captureLooseError, captureStrictError } from "@/lib/observability"'),
      "Must import observability capture methods"
    );
    assert.ok(
      content.includes("captureStrictError(error"),
      "Must call captureStrictError for 500 / unexpected internal error"
    );
    assert.ok(
      content.includes("captureLooseError("),
      "Must call captureLooseError for business / duplicate / validation errors"
    );
  });

  it("should properly re-export or declare ApiError with status code and message", () => {
    const content = fs.readFileSync(errorsFilePath, "utf8");
    const apiErrorContent = fs.readFileSync(path.resolve(process.cwd(), "src/lib/api/api-error.ts"), "utf8");
    assert.ok(
      content.includes("export { ApiError }") || content.includes("export class ApiError extends Error"),
      "Must export ApiError"
    );
    assert.ok(
      apiErrorContent.includes("export class ApiError extends Error"),
      "Must declare ApiError class in api-error.ts"
    );
    assert.ok(
      apiErrorContent.includes("this.statusCode = statusCode"),
      "Must assign statusCode property"
    );
    assert.ok(
      apiErrorContent.includes('this.name = "ApiError"'),
      "Must name error as ApiError"
    );
  });

  it("should verify global-error.tsx is a valid App Router root error boundary", () => {
    assert.ok(fs.existsSync(globalErrorPath), "src/app/global-error.tsx must exist");
    const content = fs.readFileSync(globalErrorPath, "utf8");

    assert.ok(content.includes('"use client"'), "Must be a client component");
    assert.ok(content.includes("captureStrictError(error"), "Must capture strict fatal error to Sentry");
    assert.ok(content.includes("<html"), "Must render <html> tag in global-error");
    assert.ok(content.includes("<body"), "Must render <body> tag in global-error");
    assert.ok(content.includes("reset()"), "Must provide reset callback");
  });

  it("should verify error.tsx is a valid route-level error boundary", () => {
    assert.ok(fs.existsSync(errorPath), "src/app/error.tsx must exist");
    const content = fs.readFileSync(errorPath, "utf8");

    assert.ok(content.includes('"use client"'), "Must be a client component");
    assert.ok(content.includes("captureLooseError(error"), "Must capture route error");
    assert.ok(content.includes("reset()"), "Must provide reset callback");
  });
});
