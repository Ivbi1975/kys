import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { timingSafeCompare } from "../lib/signed-url";

const VYS_API_KEY = process.env.VYS_API_KEY || "";
const IS_DEV = process.env.NODE_ENV === "development";

export function vysApiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!VYS_API_KEY) {
    if (IS_DEV) {
      logger.warn("VYS_API_KEY not set — VYS auth disabled in development mode.");
      next();
      return;
    }
    res.status(503).json({ error: "Sunucu yapılandırma hatası. VYS_API_KEY ayarlanmamış." });
    return;
  }

  const headerKey = req.headers["x-api-key"] as string | undefined;

  if (!headerKey) {
    res.status(401).json({ error: "Kimlik doğrulama gerekli. X-API-Key header eksik." });
    return;
  }

  if (!timingSafeCompare(headerKey, VYS_API_KEY)) {
    logger.warn({ path: req.path, ip: req.ip }, "Invalid VYS API key attempt");
    res.status(401).json({ error: "Geçersiz VYS API anahtarı." });
    return;
  }

  next();
}
