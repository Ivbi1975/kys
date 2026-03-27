import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { kesimAlanlariTable, projectsTable } from "@workspace/db/schema";
import { eq, isNull, isNotNull } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import {
  requireActiveKesimAlani,
  getFullKesimAlani,
  getFullKesimAlaniList,
  getCachedKAList,
  setCachedKAList,
  invalidateKACache,
  saveDonations,
  saveAnimalGroups,
  diffUpdateDonations,
  diffUpdateGroups,
  type DonationPayload,
  type AnimalGroupPayload,
} from "../../services/kesim-alani.service";

const donationPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional().default(""),
  description: z.string().optional().default(""),
  donationType: z.string().optional().default(""),
  shareCount: z.number().int().min(1).optional().default(1),
  vekalet: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  excluded: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
});

const animalGroupPayloadSchema = z.object({
  id: z.string().min(1),
  animalNo: z.number().int().optional().default(0),
  colorTag: z.string().optional().default(""),
  locked: z.boolean().optional().default(false),
  notes: z.string().optional().default(""),
  kesildi: z.boolean().optional(),
  donations: z.array(donationPayloadSchema).optional().default([]),
});

const createKesimAlaniSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().optional(),
  kesimListeId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  donations: z.array(donationPayloadSchema).optional().default([]),
  animalGroups: z.array(animalGroupPayloadSchema).optional().default([]),
});

const updateKesimAlaniSchema = z.object({
  name: z.string().min(1).optional(),
  kesimListeId: z.string().optional().nullable(),
  donations: z.array(donationPayloadSchema).optional(),
  animalGroups: z.array(animalGroupPayloadSchema).optional(),
});

const moveKesimAlaniSchema = z.object({
  projectId: z.string().nullable().optional(),
});

const router: IRouter = Router();

router.get("/kesim-alanlari", asyncHandler(async (req, res) => {
  const includeDeleted = req.query.includeDeleted === "true";
  const { cached, cacheKey } = getCachedKAList(includeDeleted);
  if (cached) { res.json(cached); return; }

  const whereClause = includeDeleted ? undefined : isNull(kesimAlanlariTable.deletedAt);

  let rows;
  if (whereClause) {
    rows = await db.select().from(kesimAlanlariTable)
      .where(whereClause)
      .orderBy(kesimAlanlariTable.createdAt);
  } else {
    rows = await db.select().from(kesimAlanlariTable)
      .orderBy(kesimAlanlariTable.createdAt);
  }

  const results = await getFullKesimAlaniList(rows);
  setCachedKAList(cacheKey, results);
  res.json(results);
}));

router.get("/kesim-alanlari/deleted", asyncHandler(async (_req, res) => {
  const rows = await db.select().from(kesimAlanlariTable)
    .where(isNotNull(kesimAlanlariTable.deletedAt))
    .orderBy(kesimAlanlariTable.createdAt);

  const results = await getFullKesimAlaniList(rows);
  res.json(results);
}));

router.get("/kesim-alanlari/:id", asyncHandler(async (req, res) => {
  const result = await getFullKesimAlani(req.params.id);
  if (!result) {
    res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND });
    return;
  }
  res.json(result);
}));

router.post("/kesim-alanlari", asyncHandler(async (req, res) => {
  const parsed = createKesimAlaniSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id, name, createdAt, kesimListeId, projectId: rawProjectId, donations, animalGroups } = parsed.data;
  const projectId = rawProjectId || null;

  await db.transaction(async (tx) => {
    await tx.insert(kesimAlanlariTable).values({
      id,
      name,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
      projectId,
      trackingToken: crypto.randomBytes(16).toString("hex"),
      kesimListeId: kesimListeId ?? null,
    });

    if (donations.length > 0) {
      await saveDonations(tx, id, donations as DonationPayload[]);
    }

    if (animalGroups.length > 0) {
      await saveAnimalGroups(tx, id, animalGroups as AnimalGroupPayload[]);
    }
  });

  const result = await getFullKesimAlani(id);
  invalidateKACache();
  res.status(201).json(result);
  refreshProjectStats();
}));

router.put("/kesim-alanlari/:id/move", asyncHandler(async (req, res) => {
  const parsed = moveKesimAlaniSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id } = req.params;
  const { projectId } = parsed.data;
  const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
  if (!existing) {
    res.status(404).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }
  if (projectId) {
    const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!proj) {
      res.status(404).json({ error: ERROR_MESSAGES.TARGET_PROJECT_NOT_FOUND });
      return;
    }
  }
  await db.update(kesimAlanlariTable).set({ projectId: projectId || null }).where(eq(kesimAlanlariTable.id, id));
  const result = await getFullKesimAlani(id);
  invalidateKACache();
  res.json(result);
  refreshProjectStats();
}));

router.put("/kesim-alanlari/:id", asyncHandler(async (req, res) => {
  const parsed = updateKesimAlaniSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id } = req.params;
  const { name, kesimListeId, donations, animalGroups } = parsed.data;

  const kaCheck = await requireActiveKesimAlani(id);
  if (kaCheck.error) {
    res.status(kaCheck.status).json({ error: kaCheck.error });
    return;
  }

  await db.transaction(async (tx) => {
    const kaUpdates: Record<string, string | null> = {};
    if (name !== undefined) kaUpdates.name = name;
    if (kesimListeId !== undefined) kaUpdates.kesimListeId = kesimListeId ?? null;
    if (Object.keys(kaUpdates).length > 0) {
      await tx.update(kesimAlanlariTable).set(kaUpdates).where(eq(kesimAlanlariTable.id, id));
    }

    if (donations !== undefined) {
      await diffUpdateDonations(tx, id, donations as DonationPayload[]);
    }
    if (animalGroups !== undefined) {
      await diffUpdateGroups(tx, id, animalGroups as AnimalGroupPayload[]);
    }
  });

  const result = await getFullKesimAlani(id);
  invalidateKACache();
  res.json(result);
  refreshProjectStats();
}));

router.delete("/kesim-alanlari/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const permanent = req.query.permanent === "true";

  const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
  if (!existing) {
    res.status(404).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }

  if (permanent) {
    await db.delete(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
  } else {
    await db.update(kesimAlanlariTable)
      .set({ deletedAt: new Date() })
      .where(eq(kesimAlanlariTable.id, id));
  }

  invalidateKACache();
  res.json({ success: true });
  refreshProjectStats();
}));

router.post("/kesim-alanlari/:id/restore", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
  if (!existing) {
    res.status(404).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }

  if (!existing.deletedAt) {
    res.status(400).json({ error: ERROR_MESSAGES.ALREADY_ACTIVE });
    return;
  }

  await db.update(kesimAlanlariTable)
    .set({ deletedAt: null })
    .where(eq(kesimAlanlariTable.id, id));

  const result = await getFullKesimAlani(id);
  invalidateKACache();
  res.json(result);
  refreshProjectStats();
}));

export default router;
