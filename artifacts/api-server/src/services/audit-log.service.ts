import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, desc, lt, sql } from "drizzle-orm";
import type { Request } from "express";
import { logger } from "../lib/logger";

const API_KEY = process.env.API_KEY || "";
const ADMIN_KEY = process.env.ADMIN_KEY || "";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "archive"
  | "unarchive"
  | "toggle_kesildi"
  | "split"
  | "merge"
  | "lock"
  | "unlock"
  | "import"
  | "export"
  | "repair"
  | "move";

export type AuditEntityType =
  | "donation"
  | "animal_group"
  | "project"
  | "kesim_alani"
  | "settings"
  | "backup";

export interface AuditLogParams {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  req?: Request;
  sourceType?: string;
  sourceIdentifier?: string;
  ipAddress?: string;
}

function detectSourceType(req?: Request): { sourceType: string; sourceIdentifier: string | null } {
  if (!req) return { sourceType: "system", sourceIdentifier: null };

  const apiKey = req.headers["x-api-key"] as string | undefined;
  const adminKey = req.headers["x-admin-key"] as string | undefined;

  if (adminKey && ADMIN_KEY && adminKey === ADMIN_KEY) {
    return { sourceType: "admin_key", sourceIdentifier: adminKey.slice(0, 8) };
  }

  if (apiKey && API_KEY && apiKey === API_KEY) {
    return { sourceType: "api_key", sourceIdentifier: apiKey.slice(0, 8) };
  }

  const path = req.path || "";
  if (path.startsWith("/tracking/") || path.includes("/tracking/")) {
    const tokenMatch = path.match(/\/tracking\/([a-f0-9]+)/);
    return {
      sourceType: "tracking_token",
      sourceIdentifier: tokenMatch ? tokenMatch[1].slice(0, 8) : null,
    };
  }

  return { sourceType: "api_key", sourceIdentifier: null };
}

export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    const { sourceType: detectedType, sourceIdentifier: detectedId } = detectSourceType(params.req);

    await db.insert(auditLogsTable).values({
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      entityName: params.entityName || null,
      oldValue: params.oldValue !== undefined ? params.oldValue : null,
      newValue: params.newValue !== undefined ? params.newValue : null,
      sourceType: params.sourceType || detectedType,
      sourceIdentifier: params.sourceIdentifier || detectedId,
      ipAddress: params.ipAddress || (params.req?.ip ?? null),
    });
  } catch (err) {
    logger.error({ err, action: params.action, entityType: params.entityType }, "Failed to write audit log");
  }
}

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: number;
}

export async function listAuditLogs(filters: AuditLogFilters) {
  const conditions = [];

  if (filters.entityType) {
    conditions.push(eq(auditLogsTable.entityType, filters.entityType));
  }
  if (filters.action) {
    conditions.push(eq(auditLogsTable.action, filters.action));
  }
  if (filters.entityId) {
    conditions.push(eq(auditLogsTable.entityId, filters.entityId));
  }
  if (filters.startDate) {
    conditions.push(gte(auditLogsTable.createdAt, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    conditions.push(lte(auditLogsTable.createdAt, new Date(filters.endDate)));
  }
  if (filters.cursor) {
    conditions.push(lt(auditLogsTable.id, filters.cursor));
  }

  const limit = Math.min(Math.max(filters.limit || 50, 1), 200);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = where
    ? await db.select().from(auditLogsTable).where(where).orderBy(desc(auditLogsTable.id)).limit(limit + 1)
    : await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.id)).limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return { items, hasMore, nextCursor };
}

const AUDIT_LOG_RETENTION_DAYS = 180;

export async function purgeOldAuditLogs(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AUDIT_LOG_RETENTION_DAYS);

  const result = await db.delete(auditLogsTable)
    .where(lt(auditLogsTable.createdAt, cutoff));

  const deleted = result.rowCount ?? 0;
  if (deleted > 0) {
    logger.info({ deleted, cutoffDate: cutoff.toISOString() }, "Purged old audit logs");
  }
  return deleted;
}

let purgeInterval: ReturnType<typeof setInterval> | null = null;

export function startAuditLogPurgeScheduler() {
  if (purgeInterval) return;
  purgeOldAuditLogs().catch(() => {});
  purgeInterval = setInterval(() => {
    purgeOldAuditLogs().catch(() => {});
  }, 24 * 60 * 60 * 1000);
}
