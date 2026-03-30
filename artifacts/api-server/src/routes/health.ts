import { Router, type IRouter } from "express";
import { cacheStats } from "../lib/cache";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  let dbOk = false;
  let dbLatencyMs = -1;
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    dbLatencyMs = Date.now() - start;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const poolStats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    active: pool.totalCount - pool.idleCount,
    waiting: pool.waitingCount,
  };

  const status = dbOk ? "ok" : "degraded";
  const statusCode = dbOk ? 200 : 503;

  res.status(statusCode).json({
    status,
    db: {
      connected: dbOk,
      latencyMs: dbLatencyMs,
      pool: poolStats,
    },
    uptime: Math.floor(process.uptime()),
  });
});

router.get("/cache-stats", (_req, res) => {
  res.json(cacheStats());
});

export default router;
