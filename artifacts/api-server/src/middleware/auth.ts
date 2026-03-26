import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const API_KEY = process.env.API_KEY || "";
const IS_DEV = process.env.NODE_ENV === "development";

const PUBLIC_PATH_PREFIXES = [
  "/tracking/",
  "/healthz",
  "/cache-stats",
];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (isPublicPath(req.path)) {
    next();
    return;
  }

  if (!API_KEY) {
    if (IS_DEV) {
      logger.warn("API_KEY not set — auth disabled in development mode.");
      next();
      return;
    }
    res.status(503).json({ error: "Sunucu yapılandırma hatası. API_KEY ayarlanmamış." });
    return;
  }

  const providedKey = req.headers["x-api-key"] as string | undefined;

  if (!providedKey) {
    res.status(401).json({ error: "Kimlik doğrulama gerekli. X-API-Key header eksik." });
    return;
  }

  if (providedKey !== API_KEY) {
    logger.warn({ path: req.path, ip: req.ip }, "Invalid API key attempt");
    res.status(401).json({ error: "Geçersiz API anahtarı." });
    return;
  }

  next();
}
