import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  animalGroupDonationsTable,
  donationTransfersTable,
  trackingNotesTable,
} from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import { eq, inArray, isNull, isNotNull, and } from "drizzle-orm";
import { z } from "zod";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { NoteType, NoteStatus, ERROR_MESSAGES } from "../../lib/constants";

const router: IRouter = Router();

router.post("/kesim-alanlari/move-donations", asyncHandler(async (req, res) => {
  const parsed = z.object({
    donationIds: z.array(z.string()).min(1),
    sourceKesimAlaniId: z.string(),
    targetKesimAlaniId: z.string(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { donationIds, sourceKesimAlaniId, targetKesimAlaniId } = parsed.data;

  if (sourceKesimAlaniId === targetKesimAlaniId) {
    res.status(400).json({ error: ERROR_MESSAGES.SAME_SOURCE_TARGET });
    return;
  }

  const [sourceKA, targetKA] = await Promise.all([
    db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, sourceKesimAlaniId)).then(r => r[0]),
    db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, targetKesimAlaniId)).then(r => r[0]),
  ]);

  if (!sourceKA || sourceKA.deletedAt) {
    res.status(404).json({ error: ERROR_MESSAGES.SOURCE_KESIM_NOT_FOUND });
    return;
  }
  if (!targetKA || targetKA.deletedAt) {
    res.status(404).json({ error: ERROR_MESSAGES.TARGET_KESIM_NOT_FOUND });
    return;
  }

  if (sourceKA.projectId !== targetKA.projectId) {
    res.status(400).json({ error: ERROR_MESSAGES.MUST_BE_SAME_PROJECT });
    return;
  }

  const sourceDonations = await db.select({ id: donationsTable.id })
    .from(donationsTable)
    .where(and(
      inArray(donationsTable.id, donationIds),
      eq(donationsTable.kesimAlaniId, sourceKesimAlaniId),
      isNull(donationsTable.deletedAt),
    ));
  const validIds = sourceDonations.map(d => d.id);

  if (validIds.length === 0) {
    res.status(400).json({ error: ERROR_MESSAGES.NO_VALID_DONORS });
    return;
  }

  await db.transaction(async (tx) => {
    const groupLinks = await tx.select()
      .from(animalGroupDonationsTable)
      .where(inArray(animalGroupDonationsTable.donationId, validIds));

    if (groupLinks.length > 0) {
      await tx.delete(animalGroupDonationsTable)
        .where(inArray(animalGroupDonationsTable.donationId, validIds));
    }

    const existingTarget = await tx.select().from(donationsTable)
      .where(and(eq(donationsTable.kesimAlaniId, targetKesimAlaniId), isNull(donationsTable.deletedAt)));
    const maxSort = existingTarget.length;

    for (let i = 0; i < validIds.length; i++) {
      await tx.update(donationsTable)
        .set({ kesimAlaniId: targetKesimAlaniId, sortOrder: maxSort + i })
        .where(eq(donationsTable.id, validIds[i]));
    }
  });

  res.json({ success: true, count: validIds.length, skipped: donationIds.length - validIds.length });
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
      createdAt: z.string(),
    })).min(1),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid entries", details: parsed.error.issues });
    return;
  }
  const { entries } = parsed.data;
  await db.insert(donationTransfersTable).values(
    entries.map(e => ({ ...e, createdAt: new Date(e.createdAt) }))
  );
  res.json({ success: true, count: entries.length });
}));

router.get("/projects/:projectId/transfer-log", asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const logs = await db.select().from(donationTransfersTable)
    .where(eq(donationTransfersTable.projectId, projectId))
    .orderBy(desc(donationTransfersTable.createdAt));
  res.json(logs);
}));

router.get("/projects/:projectId/pending-edit-requests", asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const kaRows = await db.select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  if (kaRows.length === 0) {
    res.json({ count: 0, requests: [] });
    return;
  }

  const kaIds = kaRows.map(k => k.id);
  const kaNameMap = new Map(kaRows.map(k => [k.id, k.name]));

  const pendingNotes = await db.select().from(trackingNotesTable)
    .where(and(
      inArray(trackingNotesTable.kesimAlaniId, kaIds),
      eq(trackingNotesTable.type, NoteType.EDIT_REQUEST),
      eq(trackingNotesTable.status, NoteStatus.PENDING),
      isNull(trackingNotesTable.deletedAt),
    ))
    .orderBy(desc(trackingNotesTable.createdAt));

  const requests = pendingNotes.map(n => ({
    id: n.id,
    kesimAlaniId: n.kesimAlaniId,
    kesimAlaniName: kaNameMap.get(n.kesimAlaniId) || "",
    animalGroupId: n.animalGroupId,
    fieldName: n.fieldName,
    oldValue: n.oldValue,
    newValue: n.newValue,
    content: n.content,
    createdAt: n.createdAt,
  }));

  res.json({ count: requests.length, requests });
}));

export default router;
