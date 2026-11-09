import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Unit: Client-side HOF and Error Boundary Architecture", () => {
  const clientHandlerPath = path.resolve(process.cwd(), "src/lib/api/client-handler.ts");
  const errorBoundaryPath = path.resolve(process.cwd(), "src/components/ui/ErrorBoundary.tsx");
  const uiIndexPath = path.resolve(process.cwd(), "src/components/ui/index.ts");

  it("should verify client-handler.ts does NOT import server-only", () => {
    assert.ok(fs.existsSync(clientHandlerPath), "client-handler.ts must exist");
    const content = fs.readFileSync(clientHandlerPath, "utf8");
    assert.strictEqual(
      content.includes('server-only'),
      false,
      "client-handler.ts must never import server-only"
    );
    assert.ok(
      content.includes("export function withClientHandler"),
      "Must export withClientHandler HOF"
    );
    assert.ok(
      content.includes("export async function safeAsync"),
      "Must export safeAsync utility"
    );
    assert.ok(
      content.includes("captureLooseError"),
      "Must route caught client errors to captureLooseError"
    );
  });

  it("should verify ErrorBoundary.tsx is a client component and exports SafeBoundary and withErrorBoundary", () => {
    assert.ok(fs.existsSync(errorBoundaryPath), "ErrorBoundary.tsx must exist");
    const content = fs.readFileSync(errorBoundaryPath, "utf8");
    const firstLine = content.split(/\r?\n/)[0].trim();
    assert.strictEqual(firstLine, '"use client";', "ErrorBoundary must be marked with 'use client'");

    assert.ok(
      content.includes("class SafeBoundary extends Component"),
      "Must define SafeBoundary React component class"
    );
    assert.ok(
      content.includes("componentDidCatch"),
      "Must implement componentDidCatch lifecycle"
    );
    assert.ok(
      content.includes("export function withErrorBoundary"),
      "Must export withErrorBoundary HOC"
    );
    assert.ok(
      content.includes("captureLooseError"),
      "Must log render exceptions via captureLooseError"
    );
  });

  it("should re-export SafeBoundary and withErrorBoundary from src/components/ui/index.ts", () => {
    const content = fs.readFileSync(uiIndexPath, "utf8");
    assert.ok(
      content.includes("SafeBoundary") && content.includes("withErrorBoundary"),
      "ui/index.ts must export SafeBoundary and withErrorBoundary"
    );
  });
});
