import "server-only";

/**
 * ORM-neutral database client contract and connection boundary.
 * Separates runtime pooled queries (DATABASE_URL) from direct administrative migrations (DIRECT_URL).
 */
export interface DatabaseClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
}

export interface DatabaseConfig {
  databaseUrl: string;
  directUrl?: string;
  poolSize?: number;
}
