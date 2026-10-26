import "server-only";
import { query } from "@/lib/db/client";
import { ApiError } from "@/lib/api/errors";
import type { Role, UserProfile } from "./types";

const globalForProfileCache = globalThis as unknown as {
  __profileCache: Map<string, { role: Role; is_active: boolean; expiresAt: number }> | undefined;
  __inFlightProfiles: Map<string, Promise<UserProfile | null>> | undefined;
};

if (!globalForProfileCache.__profileCache) {
  globalForProfileCache.__profileCache = new Map();
}
if (!globalForProfileCache.__inFlightProfiles) {
  globalForProfileCache.__inFlightProfiles = new Map();
}

export const profileCache = globalForProfileCache.__profileCache;
export const inFlightProfiles = globalForProfileCache.__inFlightProfiles;

export async function fetchProfileWithDeduping(userId: string): Promise<UserProfile> {
  const now = Date.now();
  const cached = profileCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return { role: cached.role, is_active: cached.is_active };
  }

  let inFlight = inFlightProfiles.get(userId);
  if (!inFlight) {
    inFlight = query<UserProfile>(
      "select role, is_active from public.profiles where id = $1",
      [userId]
    )
      .then((res) => res.rows[0] || null)
      .finally(() => {
        inFlightProfiles.delete(userId);
      });

    inFlightProfiles.set(userId, inFlight);
  }

  const profile = await inFlight;
  if (!profile) {
    throw new ApiError(403, "Tài khoản chưa được cấp vai trò");
  }

  if (!profile.is_active) {
    throw new ApiError(403, "Tài khoản đã bị vô hiệu hóa");
  }

  // Only cache valid profiles with 30-second TTL
  profileCache.set(userId, {
    role: profile.role,
    is_active: profile.is_active,
    expiresAt: now + 30_000,
  });

  return profile;
}
