/**
 * HttpOnly session cookies (pure helpers, no `next/*`, unit-testable).
 *
 * - Access token cookie: sent on every same-site request, lives as long as the token (expires_in).
 * - Refresh token cookie: scoped to /api/auth so it is ONLY sent to the login/refresh/logout endpoints.
 * - httpOnly: JavaScript (and therefore any XSS payload) can never read these tokens.
 * - sameSite=strict: the browser never attaches them to cross-site requests (CSRF defence layer 1).
 * - secure: HTTPS only in production (browsers accept Secure cookies on http://localhost in dev).
 */
export const ACCESS_COOKIE = "cs_at";
export const REFRESH_COOKIE = "cs_rt";
export const REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const MAX_ACCESS_AGE = 60 * 60 * 24; // never trust an absurd expires_in

export interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "strict";
  path: string;
  maxAge: number;
}
export interface CookieSpec {
  name: string;
  value: string;
  options: CookieOptions;
}
export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export function buildSessionCookies(tokens: TokenSet, isProd: boolean): CookieSpec[] {
  const accessAge = Math.min(Math.max(Math.floor(Number(tokens.expires_in) || 3600), 60), MAX_ACCESS_AGE);
  return [
    {
      name: ACCESS_COOKIE,
      value: tokens.access_token,
      options: { httpOnly: true, secure: isProd, sameSite: "strict", path: "/", maxAge: accessAge },
    },
    {
      name: REFRESH_COOKIE,
      value: tokens.refresh_token,
      options: { httpOnly: true, secure: isProd, sameSite: "strict", path: REFRESH_COOKIE_PATH, maxAge: REFRESH_MAX_AGE },
    },
  ];
}

/** Expiring cookies with the SAME name/path so the browser actually removes them. */
export function buildClearCookies(isProd: boolean): CookieSpec[] {
  return [
    { name: ACCESS_COOKIE, value: "", options: { httpOnly: true, secure: isProd, sameSite: "strict", path: "/", maxAge: 0 } },
    { name: REFRESH_COOKIE, value: "", options: { httpOnly: true, secure: isProd, sameSite: "strict", path: REFRESH_COOKIE_PATH, maxAge: 0 } },
  ];
}

/** Reads one cookie value from a raw `Cookie` header. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    const raw = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(raw) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
