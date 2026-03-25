import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 2,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
});

pool.on("error", (err) => {
  console.error("Unexpected pool error:", err.message);
});

let poolLogInterval: ReturnType<typeof setInterval> | null = null;

export function startPoolMonitoring(intervalMs = 60_000) {
  if (poolLogInterval) return;
  poolLogInterval = setInterval(() => {
    console.log(
      `[DB Pool] total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`,
    );
  }, intervalMs);
  poolLogInterval.unref();
}

export const db = drizzle(pool, { schema });

export * from "./schema";
