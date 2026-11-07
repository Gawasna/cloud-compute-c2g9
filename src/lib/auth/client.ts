/**
 * Browser-side auth helpers.
 *
 * Tokens are NEVER visible to JavaScript: login/refresh/logout go through /api/auth/* and the server
 * stores the session in HttpOnly cookies. This module only knows the user's identity (id, role, email).
 */
export type Role = 'admin' | 'staff' | 'viewer';
export type Identity = { id: string; role: Role; email: string };

// Cookie auth requires same-origin requests, so the API base is always the relative /api.
const apiUrl = '/api';

async function readMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => ({}));
  return typeof payload.message === 'string' && payload.message ? payload.message : fallback;
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(await readMessage(response, 'Không thể xác thực tài khoản.'));
}

let refreshing: Promise<boolean> | null = null;

/** Asks the server to renew the access cookie. Concurrent callers share one request (refresh tokens rotate). */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${apiUrl}/auth/refresh`, { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
      .then(r => r.ok)
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

/** fetch() with cookies; on 401 it renews the session once and retries. */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const run = () => fetch(input, { ...init, credentials: 'same-origin', cache: 'no-store' });
  let response = await run();
  if (response.status === 401 && await refreshSession()) response = await run();
  return response;
}

export async function getIdentity(): Promise<Identity | null> {
  const response = await authedFetch(`${apiUrl}/auth/me`);
  if (response.status === 401) return null;
  if (response.status === 403) throw new Error('Tài khoản chưa được cấp vai trò trong bảng profiles.');
  if (!response.ok) throw new Error(`Không xác minh được vai trò từ máy chủ (HTTP ${response.status}).`);
  const data: { id: string; role: Role; email?: string } = await response.json();
  if (!['admin', 'staff', 'viewer'].includes(data.role)) throw new Error('Vai trò tài khoản không hợp lệ.');
  return { id: data.id, role: data.role, email: data.email || '' };
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${apiUrl}/auth/logout`, { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
  } catch { /* the server clears the cookies; nothing else to do client-side */ }
}
