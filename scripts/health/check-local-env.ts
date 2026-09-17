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
import dns from "node:dns/promises";

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
    key: "DIRECT_POOLER_URL",
    category: "database",
    requiredForDev: false,
    description: "Fallback Session Pooler for IPv4-only networks (Port 5432)",
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
 * Extracts the hostname from a database connection URI
 */
function extractHostname(connectionString?: string): string | null {
  if (!connectionString) return null;
  try {
    const sanitized = connectionString.replace(/^postgres:\/\//, "postgresql://");
    const parsed = new URL(sanitized);
    return parsed.hostname;
  } catch {
    const match = connectionString.match(/@([^:/]+)(?::\d+)?/);
    return match ? match[1] : null;
  }
}

interface NetworkDiagnosis {
  directHost: string | null;
  directIpv6Resolved: boolean;
  poolerHost: string | null;
  poolerIpv4Resolved: boolean;
  routingMode: "DIRECT_IPV6" | "POOLER_IPV4_FALLBACK" | "UNRESOLVED";
  summary: string;
}

/**
 * Performs DNS resolution checks to detect whether current workstation
 * is on an IPv4-only network or dual-stack IPv6 network.
 */
async function checkNetworkConnectivity(
  directUrl?: string,
  poolerUrl?: string
): Promise<NetworkDiagnosis> {
  const directHost = extractHostname(directUrl);
  const poolerHost = extractHostname(poolerUrl);

  let directIpv6Resolved = false;
  let poolerIpv4Resolved = false;

  if (directHost) {
    try {
      const v6 = await dns.resolve6(directHost);
      if (v6 && v6.length > 0) {
        directIpv6Resolved = true;
      }
    } catch {
      directIpv6Resolved = false;
    }
  }

  if (poolerHost) {
    try {
      const v4 = await dns.resolve4(poolerHost);
      if (v4 && v4.length > 0) {
        poolerIpv4Resolved = true;
      }
    } catch {
      poolerIpv4Resolved = false;
    }
  }

  let routingMode: NetworkDiagnosis["routingMode"] = "UNRESOLVED";
  let summary = "";

  if (directIpv6Resolved) {
    routingMode = "DIRECT_IPV6";
    summary = "IPv6 dual-stack detected. Direct connection is viable (optimal for migrations, zero proxy hop).";
  } else if (poolerIpv4Resolved) {
    routingMode = "POOLER_IPV4_FALLBACK";
    summary = "IPv4-only network detected (e.g. school/public WiFi). Direct host lacks IPv6 routing; Session Pooler (port 5432) active.";
  } else {
    routingMode = "UNRESOLVED";
    summary = "Database host DNS resolution failed. Check network access or DNS settings.";
  }

  return {
    directHost,
    directIpv6Resolved,
    poolerHost,
    poolerIpv4Resolved,
    routingMode,
    summary,
  };
}

/**
 * CLI execution entrypoint
 */
async function main(): Promise<void> {
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

  // Load active env values for network preflight
  const rootDir = process.cwd();
  const envFiles = [".env.local", ".env.development", ".env"];
  let fileEnv: Record<string, string> = {};
  for (const envFile of envFiles) {
    const p = path.resolve(rootDir, envFile);
    if (fs.existsSync(p)) {
      fileEnv = { ...fileEnv, ...parseEnvFile(p) };
    }
  }

  const directUrl = process.env.DIRECT_URL ?? fileEnv.DIRECT_URL;
  const poolerUrl =
    process.env.DIRECT_POOLER_URL ??
    fileEnv.DIRECT_POOLER_URL ??
    process.env.DATABASE_URL ??
    fileEnv.DATABASE_URL;

  console.log("[NETWORK PREFLIGHT] Probing DNS & IPv4/IPv6 Routing...");
  const net = await checkNetworkConnectivity(directUrl, poolerUrl);

  console.log(`Direct Host     : ${net.directHost ?? "Not configured"}`);
  console.log(`  - IPv6 AAAA   : ${net.directIpv6Resolved ? "PASS (Resolved)" : "UNAVAILABLE (No IPv6 route)"}`);
  console.log(`Pooler Host     : ${net.poolerHost ?? "Not configured"}`);
  console.log(`  - IPv4 A      : ${net.poolerIpv4Resolved ? "PASS (Resolved)" : "FAIL"}`);
  console.log(`Routing Profile : [${net.routingMode}]`);
  console.log(`Diagnosis       : ${net.summary}`);

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
  main().catch((err) => {
    console.error("Diagnostic error:", err);
  });
}
