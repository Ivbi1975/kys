import { Router, type IRouter } from "express";
import { asyncHandler } from "../middleware/error-handler";
import { listAuditLogs } from "../services/audit-log.service";
import { db } from "@workspace/db";
import { auditLogsTable, donationTransfersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { moveDonations, saveDonationTransfers } from "../services/transfer.service";
import { refreshProjectStats } from "./projects";

const router: IRouter = Router();

router.get("/audit-logs", asyncHandler(async (req, res) => {
  const filters = {
    entityType: typeof req.query.entityType === "string" ? req.query.entityType : undefined,
    action: typeof req.query.action === "string" ? req.query.action : undefined,
    entityId: typeof req.query.entityId === "string" ? req.query.entityId : undefined,
    startDate: typeof req.query.startDate === "string" ? req.query.startDate : undefined,
    endDate: typeof req.query.endDate === "string" ? req.query.endDate : undefined,
    limit: Number(req.query.limit) || 50,
    cursor: req.query.cursor ? Number(req.query.cursor) : undefined,
    projectId: typeof req.query.projectId === "string" ? req.query.projectId : undefined,
    kesimAlaniId: typeof req.query.kesimAlaniId === "string" ? req.query.kesimAlaniId : undefined,
    poolScope: req.query.poolScope === "1" || req.query.poolScope === "true",
  };

  const result = await listAuditLogs(filters);
  res.json(result);
}));

router.get("/projects/:projectId/audit-logs", asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const scope = typeof req.query.scope === "string" ? req.query.scope : "all";
  const kesimAlaniId = typeof req.query.kesimAlaniId === "string" ? req.query.kesimAlaniId : undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;

  const filters: Parameters<typeof listAuditLogs>[0] = {
    projectId,
    limit,
    cursor,
    action,
    startDate,
    endDate,
  };

  if (scope === "havuz") {
    filters.poolScope = true;
  } else if (scope === "kesim" && kesimAlaniId) {
    filters.kesimAlaniId = kesimAlaniId;
  } else if (kesimAlaniId) {
    filters.kesimAlaniId = kesimAlaniId;
  }

  const result = await listAuditLogs(filters);
  res.json(result);
}));

router.post("/projects/:projectId/audit-logs/:logId/undo", asyncHandler(async (req, res) => {
  const { projectId, logId } = req.params;
  const logIdNum = Number(logId);

  if (isNaN(logIdNum)) {
    res.status(400).json({ error: "Geçersiz log ID" });
    return;
  }

  const [logEntry] = await db.select()
    .from(auditLogsTable)
    .where(and(
      eq(auditLogsTable.id, logIdNum),
      eq(auditLogsTable.projectId, projectId),
    ));

  if (!logEntry) {
    res.status(404).json({ error: "Log kaydı bulunamadı" });
    return;
  }

  const meta = logEntry.metadata as Record<string, unknown> | null;
  const batchId = meta?.batchId as string | undefined;
  const alreadyUndone = meta?.undone === true;

  if (alreadyUndone) {
    res.status(409).json({ error: "Bu işlem zaten geri alındı" });
    return;
  }

  if (logEntry.action !== "bulk_transfer" || !batchId) {
    res.status(400).json({ error: "Bu işlem geri alınamaz" });
    return;
  }

  const batchEntries = await db.select()
    .from(donationTransfersTable)
    .where(and(
      eq(donationTransfersTable.batchId, batchId),
      eq(donationTransfersTable.projectId, projectId),
    ));

  if (batchEntries.length === 0) {
    res.status(404).json({ error: "Geri alınacak transfer kaydı bulunamadı" });
    return;
  }

  const groups = new Map<string, { fromKaId: string; toKaId: string; donationIds: string[] }>();
  for (const entry of batchEntries) {
    const fromKaId = entry.fromKesimAlaniId;
    const toKaId = entry.toKesimAlaniId;
    const donationId = entry.donationId;
    if (!fromKaId || !toKaId || !donationId) continue;
    const key = `${fromKaId}::${toKaId}`;
    if (!groups.has(key)) groups.set(key, { fromKaId, toKaId, donationIds: [] });
    groups.get(key)!.donationIds.push(donationId);
  }

  if (groups.size === 0) {
    res.status(400).json({ error: "Geri alınacak geçerli kayıt bulunamadı" });
    return;
  }

  let totalCount = 0;
  const undoLogEntries: Parameters<typeof saveDonationTransfers>[0] = [];
  const now = new Date();

  for (const { fromKaId, toKaId, donationIds } of groups.values()) {
    const result = await moveDonations({
      donationIds,
      sourceKesimAlaniId: toKaId,
      targetKesimAlaniId: fromKaId,
    });
    if (!result.ok) continue;
    totalCount += result.count;
    if (result.movedIds.length > 0) {
      for (const donation of batchEntries.filter(e => result.movedIds.includes(e.donationId ?? ""))) {
        undoLogEntries.push({
          id: crypto.randomUUID(),
          projectId,
          donationId: donation.donationId ?? "",
          donorName: donation.donorName ?? "",
          donorDescription: donation.donorDescription ?? "",
          fromKesimAlaniId: toKaId,
          fromKesimAlaniName: donation.toKesimAlaniName ?? "",
          toKesimAlaniId: fromKaId,
          toKesimAlaniName: donation.fromKesimAlaniName ?? "",
          removedFromSource: true,
          shareCount: donation.shareCount ?? 1,
          transferType: "undo",
          batchId: crypto.randomUUID(),
          createdAt: now.toISOString(),
        });
      }
    }
  }

  if (totalCount === 0) {
    res.status(409).json({ error: "Geri alınacak bağış bulunamadı — bağışlar zaten taşınmış olabilir" });
    return;
  }

  if (undoLogEntries.length > 0) {
    await saveDonationTransfers(undoLogEntries);
  }

  await db.update(auditLogsTable)
    .set({ metadata: { ...meta, undone: true, undoneAt: now.toISOString() } })
    .where(eq(auditLogsTable.id, logIdNum));

  refreshProjectStats();
  res.json({ success: true, count: totalCount });
}));

export default router;
