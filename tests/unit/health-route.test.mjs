import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");

describe("Unit: Production Health Route & Keep-Alive Integrity", () => {
  const routeFilePath = path.join(ROOT_DIR, "src/app/api/health/route.ts");

  it("should have route.ts existing and strictly enforcing dynamic execution", () => {
    assert.ok(fs.existsSync(routeFilePath), "src/app/api/health/route.ts must exist");
    const content = fs.readFileSync(routeFilePath, "utf8");

    assert.ok(
      content.includes('export const dynamic = "force-dynamic"'),
      "Health route must be force-dynamic to bypass cache"
    );
    assert.ok(
      content.includes("export async function GET"),
      "Health route must export async GET handler"
    );
  });

  it("should contain active Supabase PostgREST keep-alive mechanism", () => {
    const content = fs.readFileSync(routeFilePath, "utf8");

    assert.ok(
      content.includes("NEXT_PUBLIC_SUPABASE_URL"),
      "Health route must inspect NEXT_PUBLIC_SUPABASE_URL"
    );
    assert.ok(
      content.includes("/rest/v1/"),
      "Health route must perform active ping against /rest/v1/ PostgREST endpoint"
    );
    assert.ok(
      content.includes("AbortSignal.timeout"),
      "Health route must protect against hanging sockets using AbortSignal.timeout"
    );
    assert.ok(
      content.includes("database"),
      "Health route response payload must include database status field"
    );
  });
});
