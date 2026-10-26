import "server-only";

// 1. Domain Types
export type { Role, AuthUser, VerifiedTokenUser, UserProfile } from "./types";

// 2. HTTP Presentation & Shared Validation
export { ApiError, handleApiError } from "@/lib/api/errors";
export { isValidUuid } from "@/lib/utils/validation";

// 3. Cryptographic Token Mechanism & State Lifecycle
export { getJwks, verifyToken } from "./token";
export { profileCache, inFlightProfiles, fetchProfileWithDeduping } from "./profile-cache";
export { getSupabaseAdminClient } from "./admin";

// 4. Security & Authorization Policies
export { authenticateUser, requireRoles } from "./guard";
