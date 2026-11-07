/**
 * CSRF defence for cookie-authenticated requests (layer 2, on top of SameSite=Strict).
 * Requests that carry an explicit `Authorization` header are not CSRF-able (browsers never add that
 * header cross-site), so only cookie-only state-changing requests are checked.
 */
export interface CsrfInput {
  method: string;
  origin: string | null;
  host: string | null;
  secFetchSite: string | null;
  hasAuthorizationHeader: boolean;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isRequestAllowedCsrf(input: CsrfInput): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true;
  if (input.hasAuthorizationHeader) return true;

  // Modern browsers always send Sec-Fetch-Site; trust it when present.
  if (input.secFetchSite) return input.secFetchSite === "same-origin";

  // Fallback: compare the Origin header with our own host.
  if (input.origin && input.host) {
    try {
      return new URL(input.origin).host === input.host;
    } catch {
      return false;
    }
  }
  return false;
}
