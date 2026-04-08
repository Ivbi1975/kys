import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");
const dbLog = {
  debug: logLevel === "debug" ? (...a: unknown[]) => process.stdout.write(`[DB Pool] ${a.join(" ")}\n`) : () => {},
  info: (...a: unknown[]) => process.stdout.write(`[DB Pool] ${a.join(" ")}\n`),
  warn: (...a: unknown[]) => process.stderr.write(`[DB Pool] WARN ${a.join(" ")}\n`),
  error: (...a: unknown[]) => process.stderr.write(`[DB Pool] ERROR ${a.join(" ")}\n`),
};

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const poolMax = Math.max(1, Number(process.env.DB_POOL_MAX) || 10);

const connectionString = process.env.DATABASE_URL!
  .replace(/([?&])sslmode=[^&]*/g, "$1")
  .replace(/&&+/g, "&")
  .replace(/\?&/, "?")
  .replace(/[?&]$/, "");

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
  dbLog.error("Unexpected pool error:", err.message);
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
const POOL_WARN_THRESHOLD = 3;
let consecutiveWaiting = 0;

export function startPoolMonitoring(intervalMs = 20_000) {
  if (poolLogInterval) return;
  const sslLabel = sslConfig === false ? "disabled" : typeof sslConfig === "object" && !sslConfig.rejectUnauthorized ? "enabled (insecure)" : "enabled (verified)";
  dbLog.info(`Configured max=${poolMax}, ssl=${sslLabel}`);
  ensureMinConnections().catch((err) =>
    dbLog.error("Warm-up failed:", err.message),
  );
  poolLogInterval = setInterval(() => {
    const active = pool.totalCount - pool.idleCount;
    const waiting = pool.waitingCount;

    ensureMinConnections().catch(() => {});

    if (waiting > 0) {
      consecutiveWaiting++;
      if (consecutiveWaiting >= POOL_WARN_THRESHOLD) {
        dbLog.warn(
          `Pool exhaustion detected! waiting=${waiting} for ${consecutiveWaiting} consecutive checks. total=${pool.totalCount} active=${active} idle=${pool.idleCount}`,
        );
      }
    } else {
      consecutiveWaiting = 0;
    }

    const utilization = poolMax > 0 ? Math.round((active / poolMax) * 100) : 0;
    dbLog.debug(
      `total=${pool.totalCount} active=${active} idle=${pool.idleCount} waiting=${waiting} utilization=${utilization}%`,
    );
  }, intervalMs);
  poolLogInterval.unref();
}

export function getPoolStats() {
  const active = pool.totalCount - pool.idleCount;
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    active,
    waiting: pool.waitingCount,
    max: poolMax,
    utilization: poolMax > 0 ? Math.round((active / poolMax) * 100) : 0,
  };
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
