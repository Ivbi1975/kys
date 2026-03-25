import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { cacheStats } from "../lib/cache";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/cache-stats", (_req, res) => {
  res.json(cacheStats());
});

export default router;
