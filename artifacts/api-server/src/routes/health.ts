import { Router, type IRouter } from "express";
import { cacheStats } from "../lib/cache";
import { pool, getPoolStats } from "@workspace/db";

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

  const poolStats = getPoolStats();
  const cache = cacheStats();
  const status = dbOk ? "ok" : "degraded";

  res.status(200).json({
    status,
    db: {
      connected: dbOk,
      latencyMs: dbLatencyMs,
      pool: poolStats,
    },
    cache,
    uptime: Math.floor(process.uptime()),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

router.get("/cache-stats", (_req, res) => {
  res.json(cacheStats());
});

export default router;
