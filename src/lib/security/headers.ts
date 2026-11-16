/**
 * Security response headers, built as a pure function so it can be unit-tested.
 * CSP keeps 'unsafe-inline' for scripts/styles because Next.js App Router injects inline
 * bootstrap scripts; moving to nonce-based CSP requires dynamic rendering for every page.
 * bảo vệ website trước một số loại tấn công phổ biến như:
 * XSS (Cross-Site Scripting): chèn mã JavaScript độc hại.
 * Clickjacking: nhúng website vào iframe giả mạo để lừa người dùng.
 * MIME sniffing: trình duyệt tự suy đoán kiểu nội dung không an toàn.
 * Rò rỉ thông tin URL thông qua Referrer.
 */
export const DEFAULT_MEDIA_WORKER_ORIGIN = "https://cc-media-worker.hunglepy05.workers.dev";

export interface HeaderEnv {
  isProd: boolean;
  supabaseUrl?: string;
  telemetryDsns?: Array<string | undefined>;
  mediaOrigins?: Array<string | undefined>;
  reportUri?: string;
}

function originOf(value: string | undefined): string | null { 
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

// CSP là cơ chế giúp trình duyệt kiểm soát những nguồn tài nguyên mà website được phép tải hoặc kết nối.
export function buildContentSecurityPolicy(env: HeaderEnv): string {
  const mediaOrigins = new Set<string>();
  const configuredMedia = env.mediaOrigins ?? [DEFAULT_MEDIA_WORKER_ORIGIN];
  for (const item of configuredMedia) {
    const o = originOf(item);
    if (o) mediaOrigins.add(o);
  }
  if (mediaOrigins.size === 0) {
    mediaOrigins.add(DEFAULT_MEDIA_WORKER_ORIGIN);
  }

  const connect = new Set<string>(["'self'", "https://*.ingest.sentry.io", "https://*.sentry.io"]);
  const supabase = originOf(env.supabaseUrl);
  if (supabase) connect.add(supabase);
  for (const dsn of env.telemetryDsns ?? []) {
    const o = originOf(dsn);
    if (o) connect.add(o);
  }
  for (const media of mediaOrigins) {
    connect.add(media);
  }
  if (!env.isProd) {
    connect.add("ws:");
    connect.add("http://localhost:*");
  }

  const script = ["'self'", "'unsafe-inline'", ...(env.isProd ? [] : ["'unsafe-eval'"])];
  const imgSrc = ["'self'", "data:", "blob:", ...mediaOrigins];
  const reportUri = env.reportUri ?? "/api/csp-report";

  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${[...connect].join(" ")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-to csp-endpoint",
    `report-uri ${reportUri}`,
    ...(env.isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function buildSecurityHeaders(env: HeaderEnv): Array<{ key: string; value: string }> {
  const reportUri = env.reportUri ?? "/api/csp-report";
  const headers = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(env) },
    { key: "Reporting-Endpoints", value: `csp-endpoint="${reportUri}"` },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];
  if (env.isProd) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
