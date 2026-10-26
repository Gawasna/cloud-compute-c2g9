import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";

const globalForAuthAdmin = globalThis as unknown as {
  __supabaseAdmin: SupabaseClient | undefined;
};

export function getSupabaseAdminClient(): SupabaseClient {
  if (!globalForAuthAdmin.__supabaseAdmin) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new ApiError(500, "Chưa cấu hình dịch vụ quản lý tài khoản (SUPABASE_SERVICE_ROLE_KEY).");
    }

    globalForAuthAdmin.__supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return globalForAuthAdmin.__supabaseAdmin;
}
