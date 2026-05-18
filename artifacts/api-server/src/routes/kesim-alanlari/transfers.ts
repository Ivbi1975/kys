import { Router, type IRouter } from "express";
import { z } from "zod";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import {
  moveDonations,
  moveAnimalGroup,
  saveDonationTransfers,
  getTransferLog,
  getPendingEditRequests,
} from "../../services/transfer.service";
import { checkTransferConflicts, logConflicts, fetchConflictLog } from "../../services/conflict-log.service";
import { auditLog } from "../../services/audit-log.service";
import { db } from "@workspace/db";
import { kesimAlanlariTable, donationTransfersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

async function getKAInfo(kaId: string): Promise<{ projectId: string | null; name: string | null }> {
  const [ka] = await db.select({ projectId: kesimAlanlariTable.projectId, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.id, kaId));
  return { projectId: ka?.projectId ?? null, name: ka?.name ?? null };
}

router.post("/kesim-alanlari/move-donations", asyncHandler(async (req, res) => {
  const parsed = z.object({
    donationIds: z.array(z.string()).min(1),
    sourceKesimAlaniId: z.string(),
    targetKesimAlaniId: z.string(),
    force: z.boolean().optional().default(false),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { sourceKesimAlaniId, targetKesimAlaniId, force } = parsed.data;
  if (sourceKesimAlaniId === targetKesimAlaniId) {
    res.status(400).json({ error: ERROR_MESSAGES.SAME_SOURCE_TARGET });
    return;
  }

  const [sourceKAForProjectId] = await db.select({ projectId: kesimAlanlariTable.projectId }).from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, sourceKesimAlaniId));
  const resolvedProjectId = sourceKAForProjectId?.projectId ?? undefined;
  const conflictCheck = await checkTransferConflicts(parsed.data.donationIds, sourceKesimAlaniId, targetKesimAlaniId, resolvedProjectId);

  if (conflictCheck.hasConflicts && !force) {
    const sourceKAForBlock = sourceKAForProjectId;
    if (sourceKAForBlock?.projectId) {
      await logConflicts(
        sourceKAForBlock.projectId,
        conflictCheck.conflicts,
        sourceKesimAlaniId,
        conflictCheck.sourceKesimAlaniName,
        targetKesimAlaniId,
        conflictCheck.targetKesimAlaniName,
        "blocked",
      ).catch(() => {});
    }
    res.status(409).json({
      error: "transfer_conflict",
      conflicts: conflictCheck.conflicts,
      sourceKesimAlaniName: conflictCheck.sourceKesimAlaniName,
      targetKesimAlaniName: conflictCheck.targetKesimAlaniName,
    });
    return;
  }

  const result = await moveDonations(parsed.data);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      source_not_found: ERROR_MESSAGES.SOURCE_KESIM_NOT_FOUND,
      target_not_found: ERROR_MESSAGES.TARGET_KESIM_NOT_FOUND,
      different_project: ERROR_MESSAGES.MUST_BE_SAME_PROJECT,
      no_valid_donors: ERROR_MESSAGES.NO_VALID_DONORS,
      all_donors_in_locked_groups: "Tüm bağışçılar kilitli veya kesilmiş gruplara ait. Transfer yapılamaz.",
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }

  if (conflictCheck.hasConflicts && force && conflictCheck.conflicts.length > 0) {
    const [sourceKA] = await db.select({ projectId: kesimAlanlariTable.projectId }).from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, sourceKesimAlaniId));
    if (sourceKA?.projectId) {
      await logConflicts(
        sourceKA.projectId,
        conflictCheck.conflicts,
        sourceKesimAlaniId,
        conflictCheck.sourceKesimAlaniName,
        targetKesimAlaniId,
        conflictCheck.targetKesimAlaniName,
        "forced",
      ).catch(() => {});
    }
  }

  res.json({ success: true, count: result.count, skipped: result.skipped, movedIds: result.movedIds });
  refreshProjectStats();

  getKAInfo(targetKesimAlaniId).then(({ projectId, name: targetName }) => {
    getKAInfo(sourceKesimAlaniId).then(({ name: sourceName }) => {
      auditLog({
        action: "move",
        entityType: "donation",
        req,
        projectId: projectId ?? undefined,
        targetKesimAlaniId,
        affectedCount: result.count,
        metadata: {
          sourceKesimAlaniId,
          sourceKesimAlaniName: sourceName,
          targetKesimAlaniName: targetName,
          skipped: result.skipped,
        },
      });
    });
  });
}));

router.post("/kesim-alanlari/move-animal-group", asyncHandler(async (req, res) => {
  const parsed = z.object({
    animalGroupId: z.string().min(1),
    sourceKesimAlaniId: z.string().min(1),
    targetKesimAlaniId: z.string().min(1),
    lastUpdatedAt: z.string().optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { sourceKesimAlaniId, targetKesimAlaniId } = parsed.data;
  if (sourceKesimAlaniId === targetKesimAlaniId) {
    res.status(400).json({ error: ERROR_MESSAGES.SAME_SOURCE_TARGET });
    return;
  }

  try {
    const result = await moveAnimalGroup(parsed.data);
    if (!result.ok) {
      const errorMap: Record<string, string> = {
        source_not_found: ERROR_MESSAGES.SOURCE_KESIM_NOT_FOUND,
        target_not_found: ERROR_MESSAGES.TARGET_KESIM_NOT_FOUND,
        different_project: ERROR_MESSAGES.MUST_BE_SAME_PROJECT,
        group_not_in_source: ERROR_MESSAGES.GROUP_NOT_IN_SOURCE,
        group_locked: ERROR_MESSAGES.GROUP_LOCKED,
        group_kesildi: ERROR_MESSAGES.GROUP_KESILDI,
      };
      res.status(result.status).json({ error: errorMap[result.error] || result.error });
      return;
    }

    res.json({ success: true, animalGroupId: result.animalGroupId, newAnimalNo: result.newAnimalNo });

    getKAInfo(targetKesimAlaniId).then(({ projectId, name: targetName }) => {
      getKAInfo(sourceKesimAlaniId).then(({ name: sourceName }) => {
        auditLog({
          action: "move",
          entityType: "animal_group",
          entityId: parsed.data.animalGroupId,
          req,
          projectId: projectId ?? undefined,
          targetKesimAlaniId,
          affectedCount: 1,
          metadata: {
            sourceKesimAlaniId,
            sourceKesimAlaniName: sourceName,
            targetKesimAlaniName: targetName,
            newAnimalNo: result.newAnimalNo,
          },
        });
      });
    });
  } catch (err: any) {
    if (err?.message === "concurrent_modification") {
      res.status(409).json({ error: "Bu hayvan grubu başka biri tarafından değiştirilmiş. Lütfen sayfayı yenileyip tekrar deneyin." });
      return;
    }
    throw err;
  }
  refreshProjectStats();
}));

router.post("/donation-transfers", asyncHandler(async (req, res) => {
  const bodySchema = z.object({
    entries: z.array(z.object({
      id: z.string().min(1),
      projectId: z.string().min(1),
      donationId: z.string(),
      donorName: z.string(),
      donorDescription: z.string(),
      fromKesimAlaniId: z.string(),
      fromKesimAlaniName: z.string(),
      toKesimAlaniId: z.string(),
      toKesimAlaniName: z.string(),
      removedFromSource: z.boolean(),
      shareCount: z.number().int().min(1),
      transferType: z.enum(["donation", "animalGroup", "undo"]).default("donation"),
      animalGroupId: z.string().optional(),
      animalNo: z.number().int().optional(),
      batchId: z.string().optional(),
      createdAt: z.string(),
    })).min(1),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid entries", details: parsed.error.issues });
    return;
  }

  const result = await saveDonationTransfers(parsed.data.entries);
  res.json({ success: true, count: result.count });

  const entries = parsed.data.entries;
  if (entries.length > 0) {
    const projectId = entries[0].projectId;
    auditLog({
      action: "transfer",
      entityType: "donation",
      req,
      projectId,
      affectedCount: entries.length,
      metadata: {
        entries: entries.map(e => ({
          donorName: e.donorName,
          fromKesimAlaniName: e.fromKesimAlaniName,
          toKesimAlaniName: e.toKesimAlaniName,
          transferType: e.transferType,
        })),
      },
    });
  }
}));

router.post("/kesim-alanlari/undo-transfer", asyncHandler(async (req, res) => {
  const parsed = z.object({
    batchId: z.string().min(1),
    projectId: z.string().min(1),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { batchId, projectId } = parsed.data;

  const batchEntries = await db.select()
    .from(donationTransfersTable)
    .where(and(
      eq(donationTransfersTable.batchId, batchId),
      eq(donationTransfersTable.projectId, projectId),
    ));

  if (batchEntries.length === 0) {
    res.status(404).json({ error: "Geri alınacak işlem bulunamadı" });
    return;
  }

  // Group entries by (fromKA, toKA) pair — each group is undone independently so
  // mixed-source batches (e.g. pool + direct) are handled correctly.
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
    // Undo: move back from toKA → fromKA (reverse of original direction)
    const result = await moveDonations({
      donationIds,
      sourceKesimAlaniId: toKaId,
      targetKesimAlaniId: fromKaId,
    });

    if (!result.ok) continue; // skip groups that can't be undone (e.g. KA deleted)

    totalCount += result.count;

    if (result.movedIds.length > 0) {
      const [fromInfo, toInfo] = await Promise.all([
        getKAInfo(fromKaId),
        getKAInfo(toKaId),
      ]);
      for (const id of result.movedIds) {
        undoLogEntries.push({
          id: crypto.randomUUID(),
          projectId,
          donationId: id,
          donorName: "",
          donorDescription: "Geri alındı",
          fromKesimAlaniId: toKaId,
          fromKesimAlaniName: toInfo.name || "",
          toKesimAlaniId: fromKaId,
          toKesimAlaniName: fromInfo.name || "",
          removedFromSource: true,
          shareCount: 1,
          transferType: "undo",
          createdAt: now.toISOString(),
        });
      }
    }
  }

  if (undoLogEntries.length > 0) {
    await saveDonationTransfers(undoLogEntries);
  }

  res.json({ success: true, count: totalCount });
  refreshProjectStats();

  auditLog({
    action: "move",
    entityType: "donation",
    req,
    projectId,
    affectedCount: totalCount,
    metadata: { undone: true, batchId },
  });
}));

router.get("/projects/:projectId/transfer-log", asyncHandler(async (req, res) => {
  const result = await getTransferLog(req.params.projectId);
  res.json(result.data);
}));

router.get("/projects/:projectId/conflict-log", asyncHandler(async (req, res) => {
  const log = await fetchConflictLog(req.params.projectId);
  res.json(log);
}));

router.get("/projects/:projectId/pending-edit-requests", asyncHandler(async (req, res) => {
  const result = await getPendingEditRequests(req.params.projectId);
  res.json({ count: result.count, requests: result.requests });
}));

export default router;
