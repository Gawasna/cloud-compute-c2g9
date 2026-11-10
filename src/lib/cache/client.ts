/**
 * Upstash Redis / Vercel KV REST Client for Serverless & Edge runtimes.
 * Operates over HTTP REST API using native fetch (zero TCP socket pooling).
 * Implements Cache-Aside pattern with Graceful Degradation on network or configuration failure.
 */

export const DEFAULT_CACHE_TTL = 300; // 5 minutes in seconds

export const INVENTORY_CACHE_KEYS = [
  "cache:reports:trend:day",
  "cache:reports:trend:week",
  "cache:reports:trend:month",
  "cache:dashboard:summary",
  "cache:reports:overview",
] as const;

interface RedisConfig {
  url: string;
  token: string;
}

function getRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/+$/, ""),
    token,
  };
}

/**
 * Executes a Redis command against the Upstash REST API.
 * Automatically catches network errors and aborts after 1500ms to guarantee SLA.
 */
async function executeCommand<T = unknown>(command: (string | number)[]): Promise<T | null> {
  const config = getRedisConfig();
  if (!config) {
    return null;
  }

  try {
    const signal = AbortSignal.timeout(1500);
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal,
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`[Redis Cache] HTTP ${response.status} from Upstash REST API`);
      return null;
    }

    const json = (await response.json()) as { result?: T; error?: string };
    if (json.error) {
      console.warn(`[Redis Cache] Redis command error: ${json.error}`);
      return null;
    }

    return json.result !== undefined ? json.result : null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[Redis Cache] Graceful degradation fallback triggered: ${msg}`);
    return null;
  }
}

/**
 * Retrieves a parsed JSON value from cache.
 * Returns null on cache miss, connection error, or missing configuration.
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const raw = await executeCommand<string | null>(["GET", key]);
  if (raw === null || raw === undefined) {
    return null;
  }

  try {
    if (typeof raw === "string") {
      return JSON.parse(raw) as T;
    }
    return raw as T;
  } catch {
    return null;
  }
}

/**
 * Stores a value in cache with a TTL (default: 300s).
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_CACHE_TTL
): Promise<boolean> {
  const stringified = JSON.stringify(value);
  const result = await executeCommand<string>(["SET", key, stringified, "EX", ttlSeconds]);
  return result === "OK";
}

/**
 * Deletes one or more cache keys.
 */
export async function deleteCache(...keys: string[]): Promise<boolean> {
  if (keys.length === 0) return true;
  const result = await executeCommand<number>(["DEL", ...keys]);
  return typeof result === "number";
}

/**
 * Cache-aside pattern runner.
 * Attempts to read from cache; on miss or error, executes fetcher and caches the result asynchronously.
 */
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_CACHE_TTL
): Promise<{ data: T; cached: boolean }> {
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return { data: cached, cached: true };
  }

  const fresh = await fetcher();
  // Asynchronously populate cache without blocking user response
  setCache(key, fresh, ttlSeconds).catch((err) => {
    console.warn(`[Redis Cache] Failed to populate cache for key ${key}:`, err);
  });

  return { data: fresh, cached: false };
}

/**
 * Proactive Invalidation: Evicts all report trends and dashboard summary keys.
 * Called when stock movements occur or products are modified.
 */
export async function invalidateInventoryCaches(): Promise<boolean> {
  return deleteCache(...INVENTORY_CACHE_KEYS);
}
