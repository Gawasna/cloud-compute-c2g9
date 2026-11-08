import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { buildSecurityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          isProd: process.env.NODE_ENV === "production",
          // The browser no longer talks to Supabase Auth directly (login goes through /api/auth/*),
          // so Supabase is intentionally NOT whitelisted in connect-src.
          telemetryDsns: [process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_BUGSINK_DSN],
        }),
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG || "gawasu",
  project: process.env.SENTRY_PROJECT || "cloudstock",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: "/monitoring-tunnel",
  widenClientFileUpload: true,
});
