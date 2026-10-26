import "server-only";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError } from "@/lib/api/errors";
import type { VerifiedTokenUser } from "./types";

const globalForJwks = globalThis as unknown as {
  __jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
};

export function getJwks(): ReturnType<typeof createRemoteJWKSet> | null {
  if (!globalForJwks.__jwks) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return null;
    globalForJwks.__jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }
  return globalForJwks.__jwks;
}

export async function verifyToken(
  token: string,
  supabaseFallbackClient: SupabaseClient
): Promise<VerifiedTokenUser> {
  const jwks = getJwks();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (jwks && url) {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: `${url}/auth/v1`,
        audience: "authenticated",
        algorithms: ["ES256", "RS256", "HS256"],
      });

      if (payload.sub && typeof payload.sub === "string") {
        return {
          id: payload.sub,
          email: typeof payload.email === "string" ? payload.email : undefined,
        };
      }
    } catch {
      // Fallback to getUser on any JWKS verification failure
    }
  }

  // Safe fallback to Supabase Auth Gateway
  const { data, error } = await supabaseFallbackClient.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError(401, "Token không hợp lệ");
  }

  return {
    id: data.user.id,
    email: data.user.email,
  };
}
