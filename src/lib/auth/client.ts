/** Browser-only Supabase password auth; no privileged keys are ever exposed. */
export type Role = 'admin' | 'staff' | 'viewer';
export type Identity = { id: string; role: Role; email: string };
type Session = { access_token: string; refresh_token: string; expires_at: number; email: string };
const storageKey = 'cloudstock-auth-session-v1';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '/api';

function requireConfig() {
  if (!supabaseUrl || !anonKey || supabaseUrl.includes('your-project-ref')) {
    throw new Error('Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local.');
  }
}
function remember(payload: Record<string, unknown>, fallbackEmail: string): Session {
  const session: Session = {
    access_token: String(payload.access_token || ''),
    refresh_token: String(payload.refresh_token || ''),
    expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
    email: String((payload.user as { email?: string } | undefined)?.email || fallbackEmail),
  };
  if (!session.access_token || !session.refresh_token) throw new Error('Supabase không trả về phiên đăng nhập hợp lệ.');
  sessionStorage.setItem(storageKey, JSON.stringify(session));
  return session;
}
function current(): Session | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as Session : null;
  } catch { return null; }
}
export function clearSession() { sessionStorage.removeItem(storageKey); }
async function authRequest(path: string, body: Record<string, string>) {
  requireConfig();
  const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(payload.msg || payload.error_description || payload.message || 'Không thể xác thực tài khoản.');
    if (response.status === 400 && /invalid login credentials/i.test(message)) throw new Error('Email hoặc mật khẩu không chính xác.');
    throw new Error(message);
  }
  return payload as Record<string, unknown>;
}
export async function login(email: string, password: string) {
  const payload = await authRequest('token?grant_type=password', { email, password });
  remember(payload, email);
}
export async function getAccessToken(): Promise<string | null> {
  const session = current();
  if (!session) return null;
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session.access_token;
  try {
    const payload = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    return remember(payload, session.email).access_token;
  } catch {
    clearSession();
    return null;
  }
}
export async function getIdentity(): Promise<Identity | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const response = await fetch(`${apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (response.status === 401) { clearSession(); return null; }
  if (response.status === 403) throw new Error('Tài khoản chưa được cấp vai trò trong bảng profiles.');
  if (!response.ok) throw new Error(`Không xác minh được vai trò từ máy chủ (HTTP ${response.status}).`);
  const data: { id: string; role: Role } = await response.json();
  if (!['admin', 'staff', 'viewer'].includes(data.role)) throw new Error('Vai trò tài khoản không hợp lệ.');
  return { ...data, email: current()?.email || '' };
}
export async function logout() {
  const token = await getAccessToken();
  try {
    if (token && supabaseUrl && anonKey) await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
  } finally { clearSession(); }
}
