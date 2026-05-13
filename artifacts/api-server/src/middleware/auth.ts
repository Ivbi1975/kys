import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { timingSafeCompare, verifyPhotoToken } from "../lib/signed-url";
import { verifySessionToken, isSessionTokenShape } from "../lib/session-token";

const API_KEY = process.env.API_KEY || "";
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const IS_DEV = process.env.NODE_ENV === "development";

const PUBLIC_PATH_PREFIXES = [
  "/tracking/",
  "/healthz",
  "/cache-stats",
  "/auth/login",
];

const PHOTO_SERVE_PATTERN = /^\/kesim-alanlari\/[^/]+\/group\/[^/]+\/photos\/[^/]+$/;

function isPublicPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isPhotoServeGet(req: Request): boolean {
  return req.method === "GET" && PHOTO_SERVE_PATTERN.test(req.path);
}

function verifyPhotoAuth(req: Request): boolean {
  const ptoken = req.query["ptoken"] as string | undefined;
  const exp = req.query["exp"] as string | undefined;
  if (!ptoken || !exp || !API_KEY) return false;
  return verifyPhotoToken(ptoken, exp, API_KEY).valid;
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

  const headerKey = req.headers["x-api-key"] as string | undefined;
  const authHeader = req.headers["authorization"] as string | undefined;
  const bearerToken = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : undefined;
  const candidate = bearerToken || headerKey;

  if (candidate) {
    if (isSessionTokenShape(candidate)) {
      const result = verifySessionToken(candidate, SESSION_SECRET);
      if (!result.valid) {
        logger.warn({ path: req.path, ip: req.ip, reason: result.reason }, "Invalid session token");
        res.status(401).json({ error: "Geçersiz veya süresi dolmuş oturum." });
        return;
      }
      next();
      return;
    }
    if (!timingSafeCompare(candidate, API_KEY)) {
      logger.warn({ path: req.path, ip: req.ip }, "Invalid API key attempt");
      res.status(401).json({ error: "Geçersiz API anahtarı." });
      return;
    }
    next();
    return;
  }

  if (isPhotoServeGet(req) && verifyPhotoAuth(req)) {
    next();
    return;
  }

  res.status(401).json({ error: "Kimlik doğrulama gerekli. Oturum token veya X-API-Key header eksik." });
}

const ADMIN_ONLY_PATHS = [
  "/integrity/repair",
  "/backup/import",
];

function isAdminOnlyPath(path: string): boolean {
  return ADMIN_ONLY_PATHS.some((p) => path.startsWith(p));
}

export function adminKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminOnlyPath(req.path)) {
    next();
    return;
  }

  if (!ADMIN_KEY) {
    if (IS_DEV) {
      logger.warn("ADMIN_KEY not set — admin auth disabled in development mode.");
      next();
      return;
    }
    res.status(503).json({ error: "Sunucu yapılandırma hatası. ADMIN_KEY ayarlanmamış." });
    return;
  }

  const providedKey = req.headers["x-admin-key"] as string | undefined;

  if (!providedKey || !timingSafeCompare(providedKey, ADMIN_KEY)) {
    logger.warn({ path: req.path, ip: req.ip }, "Unauthorized admin endpoint access attempt");
    res.status(403).json({ error: "Bu işlem için yönetici yetkisi gerekli." });
    return;
  }

  next();
}
