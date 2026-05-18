import { Router, type IRouter } from "express";
import { z } from "zod";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import { detectConflicts, transferConflictDonation } from "../../services/conflict.service";
import { saveDonationTransfers } from "../../services/transfer.service";
import { db } from "@workspace/db";
import { kesimAlanlariTable, donationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const transferSchema = z.object({
  donationId: z.string().min(1),
  sourceKesimAlaniId: z.string().min(1),
  targetKesimAlaniId: z.string().min(1),
  transferAnimal: z.boolean().optional().default(false),
  animalGroupId: z.string().optional(),
  batchId: z.string().optional(),
});

const router: IRouter = Router();

router.get("/catisma-tespiti", asyncHandler(async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const result = await detectConflicts(projectId);
  res.json({ conflicts: result.conflicts, totalConflicts: result.totalConflicts });
}));

router.post("/catisma-tespiti/transfer", asyncHandler(async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { sourceKesimAlaniId, targetKesimAlaniId, donationId } = parsed.data;
  if (sourceKesimAlaniId === targetKesimAlaniId) {
    res.status(400).json({ error: ERROR_MESSAGES.SAME_SOURCE_TARGET });
    return;
  }

  const result = await transferConflictDonation(parsed.data);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const batchId = parsed.data.batchId ?? crypto.randomUUID();

  const [sourceKA, donation, targetKA] = await Promise.all([
    db.select({ name: kesimAlanlariTable.name }).from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, sourceKesimAlaniId)).then(r => r[0]),
    db.select({ name: donationsTable.name, shareCount: donationsTable.shareCount }).from(donationsTable).where(eq(donationsTable.id, donationId)).then(r => r[0]),
    db.select({ name: kesimAlanlariTable.name, projectId: kesimAlanlariTable.projectId }).from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, targetKesimAlaniId)).then(r => r[0]),
  ]);

  if (targetKA?.projectId) {
    await saveDonationTransfers([{
      id: crypto.randomUUID(),
      projectId: targetKA.projectId,
      donationId,
      donorName: donation?.name ?? "",
      donorDescription: "",
      fromKesimAlaniId: sourceKesimAlaniId,
      fromKesimAlaniName: sourceKA?.name ?? "",
      toKesimAlaniId: targetKesimAlaniId,
      toKesimAlaniName: targetKA.name ?? "",
      removedFromSource: true,
      shareCount: donation?.shareCount ?? 1,
      transferType: "donation",
      batchId,
      createdAt: new Date().toISOString(),
    }]);
  }

  res.json({ success: true, source: result.source, target: result.target, batchId });
  refreshProjectStats();
}));

export default router;
