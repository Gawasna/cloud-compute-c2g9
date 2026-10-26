import "server-only";

export type Role = "admin" | "staff" | "viewer";

export interface AuthUser {
  id: string;
  role: Role;
  email?: string;
}

export interface VerifiedTokenUser {
  id: string;
  email?: string;
}

export interface UserProfile {
  role: Role;
  is_active: boolean;
}
