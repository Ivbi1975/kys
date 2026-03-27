import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const poolMax = Math.max(1, Number(process.env.DB_POOL_MAX) || 10);

const connectionString = process.env.DATABASE_URL!.replace(
  /[?&]sslmode=[^&]*/g,
  (match) => (match.startsWith("?") ? "?" : ""),
).replace(/\?$/, "");

function resolveSsl(): boolean | { rejectUnauthorized: boolean } {
  const dbSsl = process.env.DB_SSL;
  if (dbSsl === "false" || dbSsl === "0") return false;
  if (dbSsl === "insecure") return { rejectUnauthorized: false };
  if (dbSsl === "true" || dbSsl === "1") return { rejectUnauthorized: true };
  return process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : false;
}

const sslConfig = resolveSsl();

export const pool = new Pool({
  connectionString,
  max: poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
  ssl: sslConfig,
});

pool.on("error", (err) => {
  console.error("Unexpected pool error:", err.message);
  ensureMinConnections().catch(() => {});
});

const MIN_POOL_SIZE = 2;

async function ensureMinConnections() {
  const deficit = MIN_POOL_SIZE - pool.totalCount;
  if (deficit <= 0) return;
  const clients: pg.PoolClient[] = [];
  for (let i = 0; i < deficit; i++) {
    clients.push(await pool.connect());
  }
  for (const c of clients) c.release();
}

let poolLogInterval: ReturnType<typeof setInterval> | null = null;

export function startPoolMonitoring(intervalMs = 20_000) {
  if (poolLogInterval) return;
  const sslLabel = sslConfig === false ? "disabled" : typeof sslConfig === "object" && !sslConfig.rejectUnauthorized ? "enabled (insecure)" : "enabled (verified)";
  console.log(`[DB Pool] Configured max=${poolMax}, ssl=${sslLabel}`);
  ensureMinConnections().catch((err) =>
    console.error("Pool warm-up failed:", err.message),
  );
  poolLogInterval = setInterval(() => {
    ensureMinConnections().catch(() => {});
    const active = pool.totalCount - pool.idleCount;
    console.log(
      `[DB Pool] total=${pool.totalCount} active=${active} idle=${pool.idleCount} waiting=${pool.waitingCount}`,
    );
  }, intervalMs);
  poolLogInterval.unref();
}

export async function shutdownPool(): Promise<void> {
  if (poolLogInterval) {
    clearInterval(poolLogInterval);
    poolLogInterval = null;
  }
  await pool.end();
}

export const db = drizzle(pool, { schema });

export * from "./schema";
