/**
 * Edge-compatible Web Application Firewall (WAF) & Virtual Patching filter.
 * Designed to inspect incoming HTTP requests at the edge before hitting handlers.
 * Runs in Next.js Edge proxy with zero external dependencies and sub-millisecond overhead.
 */

export interface WafInspectionResult {
  allowed: boolean;
  rule?: string;
  reason?: string;
}

// Pre-compiled regex patterns for threat detection
const PATH_TRAVERSAL_PATTERN = /(?:\.{2}[/\\])|(?:\.{2}$)|(?:%2e%2e)|(?:%252e%252e)|(?:etc\/(?:passwd|shadow))|(?:windows\/win\.ini)/i;
const NULL_BYTE_PATTERN = /(?:%00|\x00)/;

// High-confidence SQL injection patterns in URL path or query string
const SQLI_PATTERNS = [
  /\bunion\s+(?:all\s+)?select\b/i,
  /\bselect\b.+\bfrom\b.+(?:information_schema|pg_catalog|pg_tables)\b/i,
  /\b(?:waitfor\s+delay|pg_sleep|sleep\s*\(|benchmark\s*\()/i,
  /(?:'|\%27)\s*--/i,
  /\b(?:or|and)\b\s+(?:'[^']*'?|\d+)\s*=\s*(?:'[^']*'?|\d+)/i,
];

// Cross-Site Scripting (XSS) & HTML injection patterns in query string
const XSS_PATTERNS = [
  /<\s*script\b[^>]*>/i,
  /javascript\s*:/i,
  /data:text\/html/i,
  /\bon(?:error|load|click|mouseover|submit)\s*=/i,
  /\beval\s*\(/i,
];

// Common automated vulnerability scanner and exploit toolkit User-Agents
const SCANNER_UA_PATTERN =
  /\b(?:sqlmap|nikto|acunetix|nmap|masscan|wpscan|dirbuster|gobuster|nessus|openvas|havij)\b/i;

// Probes for hidden configuration or sensitive system files
const SENSITIVE_PROBE_PATTERN =
  /^\/(?:\.env|\.git|\.aws|\.ssh|wp-admin|phpmyadmin|actuator|server-status)/i;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function inspectRequestWaf(request: {
  url: string;
  headers: Headers | Record<string, string | string[] | undefined>;
}): WafInspectionResult {
  const rawUrl = request.url;
  const decodedUrl = safeDecode(rawUrl);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return {
      allowed: false,
      rule: "MALFORMED_URL",
      reason: "Malformed request URL.",
    };
  }

  const rawPath = parsedUrl.pathname;
  const decodedPath = safeDecode(rawPath);
  const rawQuery = parsedUrl.search;
  const decodedQuery = safeDecode(rawQuery);

  // 1. Path Traversal & Null Byte checks
  if (
    PATH_TRAVERSAL_PATTERN.test(rawUrl) ||
    PATH_TRAVERSAL_PATTERN.test(decodedUrl) ||
    PATH_TRAVERSAL_PATTERN.test(rawPath) ||
    PATH_TRAVERSAL_PATTERN.test(decodedPath) ||
    PATH_TRAVERSAL_PATTERN.test(rawQuery) ||
    PATH_TRAVERSAL_PATTERN.test(decodedQuery)
  ) {
    return {
      allowed: false,
      rule: "PATH_TRAVERSAL",
      reason: "Path traversal sequence detected.",
    };
  }

  if (NULL_BYTE_PATTERN.test(rawUrl) || NULL_BYTE_PATTERN.test(rawQuery) || NULL_BYTE_PATTERN.test(rawPath)) {
    return {
      allowed: false,
      rule: "NULL_BYTE",
      reason: "Null byte injection detected.",
    };
  }

  // 2. Sensitive Probe Paths
  if (SENSITIVE_PROBE_PATTERN.test(decodedPath)) {
    return {
      allowed: false,
      rule: "SENSITIVE_PROBE",
      reason: "Target path matches sensitive resource probe.",
    };
  }

  // 3. User-Agent Scanner & Exploit Toolkit check
  let userAgent = "";
  if (typeof request.headers.get === "function") {
    userAgent = request.headers.get("user-agent") ?? "";
  } else {
    const ua = (request.headers as Record<string, string | string[] | undefined>)["user-agent"];
    userAgent = Array.isArray(ua) ? ua.join(" ") : ua ?? "";
  }

  if (userAgent && SCANNER_UA_PATTERN.test(userAgent)) {
    return {
      allowed: false,
      rule: "SCANNER_USER_AGENT",
      reason: "Suspicious security scanner User-Agent detected.",
    };
  }

  // 4. SQL Injection Patterns in Query String & Path
  for (const pattern of SQLI_PATTERNS) {
    if (
      pattern.test(rawQuery) ||
      pattern.test(decodedQuery) ||
      pattern.test(rawPath) ||
      pattern.test(decodedPath) ||
      pattern.test(rawUrl) ||
      pattern.test(decodedUrl)
    ) {
      return {
        allowed: false,
        rule: "SQL_INJECTION",
        reason: "SQL injection signature detected.",
      };
    }
  }

  // 5. Cross-Site Scripting (XSS) Patterns in Query String
  for (const pattern of XSS_PATTERNS) {
    if (
      pattern.test(rawQuery) ||
      pattern.test(decodedQuery) ||
      pattern.test(rawUrl) ||
      pattern.test(decodedUrl)
    ) {
      return {
        allowed: false,
        rule: "XSS_INJECTION",
        reason: "Cross-site scripting signature detected.",
      };
    }
  }

  return { allowed: true };
}
