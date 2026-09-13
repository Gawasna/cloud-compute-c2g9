/**
 * Developer Local Environment Diagnostics Script
 * Location: scripts/health/check-local-env.ts
 *
 * Purpose: Validate local developer workstation configuration, required environment
 * variables, and database connectivity strings prior to running development servers.
 *
 * Architectural Boundary:
 * This script is strictly for local developer operations and CI diagnostic gates.
 * It is completely isolated from the production /api/health Route Handler.
 */

import fs from "node:fs";
import path from "node:path";

interface EnvVariableCheck {
  key: string;
  category: "browser" | "server" | "database" | "observability" | "cache";
  requiredForDev: boolean;
  description: string;
}

const TRACKED_VARIABLES: EnvVariableCheck[] = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    category: "browser",
    requiredForDev: true,
    description: "Supabase Project URL (Browser-safe)",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    category: "browser",
    requiredForDev: true,
    description: "Supabase Anonymous Client Key (Browser-safe)",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    category: "server",
    requiredForDev: false,
    description: "Privileged Service Role Key (Server-only)",
  },
  {
    key: "DATABASE_URL",
    category: "database",
    requiredForDev: true,
    description: "Supavisor Pooled Connection String (Runtime queries)",
  },
  {
    key: "DIRECT_URL",
    category: "database",
    requiredForDev: true,
    description: "Direct PostgreSQL Connection String (Migrations)",
  },
  {
    key: "NEXT_PUBLIC_SENTRY_DSN",
    category: "observability",
    requiredForDev: false,
    description: "Sentry Ingestion DSN (Browser & Server)",
  },
  {
    key: "SENTRY_AUTH_TOKEN",
    category: "observability",
    requiredForDev: false,
    description: "Sentry Source Map Release Auth Token (CI/CD only)",
  },
];

interface DiagnosticResult {
  passed: boolean;
  variableKey: string;
  category: string;
  status: "CONFIGURED" | "MISSING" | "PLACEHOLDER";
  message: string;
}

/**
 * Parses simple dotenv file content into key-value pairs
 */
function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

/**
 * Executes local environment diagnostics
 */
export function runDiagnostics(): { allCriticalPresent: boolean; results: DiagnosticResult[] } {
  const rootDir = process.cwd();
  const envFiles = [".env.local", ".env.development", ".env"];
  let fileEnv: Record<string, string> = {};

  for (const envFile of envFiles) {
    const p = path.resolve(rootDir, envFile);
    if (fs.existsSync(p)) {
      fileEnv = { ...fileEnv, ...parseEnvFile(p) };
    }
  }

  const results: DiagnosticResult[] = [];
  let allCriticalPresent = true;

  for (const item of TRACKED_VARIABLES) {
    const val = process.env[item.key] ?? fileEnv[item.key];

    if (!val || val.trim() === "") {
      const isMissing = item.requiredForDev;
      if (isMissing) {
        allCriticalPresent = false;
      }
      results.push({
        passed: !item.requiredForDev,
        variableKey: item.key,
        category: item.category,
        status: "MISSING",
        message: item.requiredForDev
          ? `Required for local development: ${item.description}`
          : `Optional: ${item.description}`,
      });
    } else if (val.includes("your-") || val.includes("placeholder") || val.includes("example")) {
      results.push({
        passed: true,
        variableKey: item.key,
        category: item.category,
        status: "PLACEHOLDER",
        message: `Template placeholder detected: ${item.description}`,
      });
    } else {
      results.push({
        passed: true,
        variableKey: item.key,
        category: item.category,
        status: "CONFIGURED",
        message: `Valid configuration detected: ${item.description}`,
      });
    }
  }

  return { allCriticalPresent, results };
}

/**
 * CLI execution entrypoint
 */
function main(): void {
  console.log("=================================================");
  console.log("  Local Developer Environment Diagnostics Tool  ");
  console.log("=================================================");
  console.log(`Node.js Runtime : ${process.version}`);
  console.log(`Platform        : ${process.platform} (${process.arch})`);
  console.log(`Timestamp       : ${new Date().toISOString()}`);
  console.log("-------------------------------------------------");

  const { allCriticalPresent, results } = runDiagnostics();

  for (const res of results) {
    const tag = `[${res.status}]`.padEnd(14);
    const key = res.variableKey.padEnd(32);
    console.log(`${tag} ${key} -> ${res.message}`);
  }

  console.log("-------------------------------------------------");

  const envExampleExists = fs.existsSync(path.resolve(process.cwd(), ".env.example"));
  console.log(`.env.example template available: ${envExampleExists ? "YES" : "NO"}`);

  if (!allCriticalPresent) {
    console.warn("\nWarning: Some required development environment variables are missing.");
    console.warn("Please copy .env.example to .env.local and configure your Supabase credentials.");
  } else {
    console.log("\nDiagnostics passed: Environment configuration is ready for development.");
  }
}

if (process.env.NODE_ENV !== "test") {
  main();
}
