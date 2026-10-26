import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { __dbPool: Pool | undefined };

function getCertificate(): string | undefined {
  const certPath = process.env.DATABASE_SSL_CA_PATH || "certs/prod-ca-2021.crt";
  const absolutePath = isAbsolute(certPath)
    ? certPath
    : resolve(/*turbopackIgnore: true*/ process.cwd(), certPath);
  if (existsSync(absolutePath)) {
    return readFileSync(absolutePath, "utf8");
  }
  return undefined;
}

export function getDbPool(): Pool {
  if (!globalForDb.__dbPool) {
    const ca = getCertificate();
    const connectionString = process.env.DATABASE_URL;
    const maxPool = Math.max(1, Number(process.env.DATABASE_POOL_SIZE) || 5);

    globalForDb.__dbPool = new Pool({
      connectionString,
      ssl: ca
        ? { ca, rejectUnauthorized: true }
        : connectionString && connectionString.includes("sslmode=require")
          ? { rejectUnauthorized: false }
          : undefined,
      max: maxPool,
      idleTimeoutMillis: Math.max(
        10000,
        Number(process.env.DATABASE_IDLE_TIMEOUT) || 300000
      ),
      connectionTimeoutMillis: 5000,
    });
  }
  return globalForDb.__dbPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number | null }> {
  const pool = getDbPool();
  const res = await pool.query<T>(text, params);
  return { rows: res.rows, rowCount: res.rowCount };
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
