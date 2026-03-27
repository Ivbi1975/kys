import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  animalGroupsTable,
  animalGroupDonationsTable,
  animalGroupPhotosTable,
} from "@workspace/db/schema";
import { desc, gt, lt, or, count, asc } from "drizzle-orm";
import { eq, inArray, and } from "drizzle-orm";
import { z } from "zod";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import {
  requireActiveKesimAlani,
  getFullKesimAlani,
  saveAnimalGroups,
  createNotificationLogs,
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

const GROUP_SORT_FIELDS = {
  sortOrder: animalGroupsTable.sortOrder,
  animalNo: animalGroupsTable.animalNo,
} as const;
type GroupSortField = keyof typeof GROUP_SORT_FIELDS;

function parseGroupSortParams(query: Record<string, unknown>) {
  const rawField = typeof query.sortField === "string" ? query.sortField : "sortOrder";
  const sortField: GroupSortField = rawField in GROUP_SORT_FIELDS
    ? (rawField as GroupSortField) : "sortOrder";
  const sortDir = query.sortDir === "desc" ? "desc" as const : "asc" as const;
  return { sortField, sortDir };
}

function buildGroupFilters(kesimAlaniId: string, query: Record<string, unknown>) {
  const conditions = [
    eq(animalGroupsTable.kesimAlaniId, kesimAlaniId),
  ];

  if (query.locked === "true") conditions.push(eq(animalGroupsTable.locked, true));
  if (query.locked === "false") conditions.push(eq(animalGroupsTable.locked, false));

  if (query.kesildi === "true") conditions.push(eq(animalGroupsTable.kesildi, true));
  if (query.kesildi === "false") conditions.push(eq(animalGroupsTable.kesildi, false));

  const teamId = typeof query.teamId === "string" ? query.teamId.trim() : "";
  if (teamId) conditions.push(eq(animalGroupsTable.teamId, teamId));

  return and(...conditions)!;
}

const bulkLockSchema = z.object({
  groupIds: z.array(z.string()).max(500).optional(),
  filter: z.object({
    locked: z.enum(["true", "false"]).optional(),
    kesildi: z.enum(["true", "false"]).optional(),
    teamId: z.string().optional(),
  }).optional(),
  locked: z.boolean(),
});

const bulkAnimalGroupsSchema = z.object({
  animalGroups: z.array(animalGroupPayloadSchema),
});

const router: IRouter = Router();

router.get("/kesim-alanlari/:id/groups", asyncHandler(async (req, res) => {
  const { id: kesimAlaniId } = req.params;
  const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  if (!ka) {
    res.status(404).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }

  const rawLimit = Number(req.query.limit) || 50;
  const limit = Math.min(Math.max(rawLimit, 1), 200);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;
  const rawOffset = Number(req.query.offset);
  const offset = !cursor && Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const { sortField, sortDir } = parseGroupSortParams(req.query as Record<string, unknown>);

  const where = buildGroupFilters(kesimAlaniId, req.query as Record<string, unknown>);

  const col = GROUP_SORT_FIELDS[sortField];
  const dirFn = sortDir === "desc" ? desc : asc;
  const cmpFn = sortDir === "desc" ? lt : gt;

  let cursorCondition;
  if (cursor) {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      const cursorId = parsed.id as string;
      const cursorVal = parsed.v as number;
      if (typeof cursorId === "string" && cursorVal !== undefined) {
        cursorCondition = or(
          cmpFn(col, cursorVal),
          and(eq(col, cursorVal), gt(animalGroupsTable.id, cursorId)),
        );
      }
    } catch {
      res.status(400).json({ error: ERROR_MESSAGES.INVALID_CURSOR });
      return;
    }
  }

  const finalWhere = cursorCondition ? and(where, cursorCondition) : where;

  const query = db.select().from(animalGroupsTable)
    .where(finalWhere!)
    .orderBy(dirFn(col), asc(animalGroupsTable.id))
    .limit(limit + 1);

  const rows = offset > 0 ? await query.offset(offset) : await query;

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const groupIds = pageRows.map(g => g.id);

  const [groupDonationLinks, photoCounts] = await Promise.all([
    groupIds.length > 0
      ? db.select({
          groupId: animalGroupDonationsTable.groupId,
          donationId: animalGroupDonationsTable.donationId,
        }).from(animalGroupDonationsTable).where(inArray(animalGroupDonationsTable.groupId, groupIds))
      : Promise.resolve([] as { groupId: string; donationId: string }[]),
    groupIds.length > 0
      ? db.select({
          animalGroupId: animalGroupPhotosTable.animalGroupId,
          photoCount: count(),
        }).from(animalGroupPhotosTable)
          .where(inArray(animalGroupPhotosTable.animalGroupId, groupIds))
          .groupBy(animalGroupPhotosTable.animalGroupId)
      : Promise.resolve([] as { animalGroupId: string; photoCount: number }[]),
  ]);

  const donationCountByGroup: Record<string, number> = {};
  for (const link of groupDonationLinks) {
    donationCountByGroup[link.groupId] = (donationCountByGroup[link.groupId] || 0) + 1;
  }

  const photoCountByGroup: Record<string, number> = {};
  for (const pc of photoCounts) {
    photoCountByGroup[pc.animalGroupId] = pc.photoCount;
  }

  const items = pageRows.map(g => ({
    id: g.id,
    animalNo: g.animalNo,
    colorTag: g.colorTag,
    locked: g.locked,
    notes: g.notes,
    kesildi: g.kesildi,
    kesildiAt: g.kesildiAt || null,
    teamId: g.teamId || null,
    sortOrder: g.sortOrder,
    donationCount: donationCountByGroup[g.id] || 0,
    photoCount: photoCountByGroup[g.id] || 0,
  }));

  const lastItem = pageRows[pageRows.length - 1];
  let nextCursor: string | null = null;
  if (hasMore && lastItem) {
    const val = sortField === "sortOrder" ? lastItem.sortOrder : lastItem.animalNo;
    nextCursor = Buffer.from(JSON.stringify({ v: val, id: lastItem.id })).toString("base64url");
  }

  res.json({ items, nextCursor, hasMore });
}));

router.get("/kesim-alanlari/:id/groups/count", asyncHandler(async (req, res) => {
  const { id: kesimAlaniId } = req.params;
  const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  if (!ka) {
    res.status(404).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }

  const where = buildGroupFilters(kesimAlaniId, req.query as Record<string, unknown>);
  const [result] = await db.select({ total: count() }).from(animalGroupsTable).where(where);
  res.json({ count: result.total });
}));

router.get("/kesim-alanlari/:id/groups/:groupId", asyncHandler(async (req, res) => {
  const { id: kesimAlaniId, groupId } = req.params;

  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, kesimAlaniId)));
  if (!group) {
    res.status(404).json({ error: ERROR_MESSAGES.ANIMAL_GROUP_NOT_FOUND });
    return;
  }

  const [groupDonationLinks, photos] = await Promise.all([
    db.select({
      donationId: animalGroupDonationsTable.donationId,
      sortOrder: animalGroupDonationsTable.sortOrder,
    }).from(animalGroupDonationsTable)
      .where(eq(animalGroupDonationsTable.groupId, groupId))
      .orderBy(asc(animalGroupDonationsTable.sortOrder)),
    db.select({
      id: animalGroupPhotosTable.id,
      mimeType: animalGroupPhotosTable.mimeType,
      createdAt: animalGroupPhotosTable.createdAt,
    }).from(animalGroupPhotosTable)
      .where(eq(animalGroupPhotosTable.animalGroupId, groupId))
      .orderBy(asc(animalGroupPhotosTable.createdAt)),
  ]);

  const donationIds = groupDonationLinks.map(l => l.donationId);
  let donations: { id: string; name: string; donationType: string; shareCount: number; excluded: boolean }[] = [];
  if (donationIds.length > 0) {
    const donationRows = await db.select({
      id: donationsTable.id,
      name: donationsTable.name,
      donationType: donationsTable.donationType,
      shareCount: donationsTable.shareCount,
      excluded: donationsTable.excluded,
    }).from(donationsTable).where(inArray(donationsTable.id, donationIds));

    const donationMap = new Map(donationRows.map(d => [d.id, d]));
    donations = groupDonationLinks
      .map(l => donationMap.get(l.donationId))
      .filter((d): d is NonNullable<typeof d> => d != null);
  }

  res.json({
    id: group.id,
    animalNo: group.animalNo,
    colorTag: group.colorTag,
    locked: group.locked,
    notes: group.notes,
    kesildi: group.kesildi,
    kesildiAt: group.kesildiAt || null,
    teamId: group.teamId || null,
    sortOrder: group.sortOrder,
    donations,
    photos: photos.map(p => ({ id: p.id, mimeType: p.mimeType, createdAt: p.createdAt })),
  });
}));

router.post("/kesim-alanlari/:id/groups/bulk-lock", asyncHandler(async (req, res) => {
  const parsed = bulkLockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId } = req.params;
  const { groupIds, filter, locked } = parsed.data;

  if (!groupIds?.length && !filter) {
    res.status(400).json({ error: ERROR_MESSAGES.GROUP_IDS_OR_FILTER_REQUIRED });
    return;
  }

  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) {
    res.status(kaCheck.status).json({ error: kaCheck.error });
    return;
  }

  let whereCondition;
  if (groupIds?.length) {
    whereCondition = and(
      eq(animalGroupsTable.kesimAlaniId, kesimAlaniId),
      inArray(animalGroupsTable.id, groupIds),
    );
  } else {
    whereCondition = buildGroupFilters(kesimAlaniId, (filter || {}) as Record<string, unknown>);
  }

  const result = await db.update(animalGroupsTable)
    .set({ locked })
    .where(whereCondition!);

  const updatedCount = result.rowCount ?? 0;
  res.json({ updated: updatedCount, locked });
}));

router.post("/kesim-alanlari/:id/animal-groups", asyncHandler(async (req, res) => {
  const parsed = animalGroupPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId } = req.params;
  const group = parsed.data;

  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) {
    res.status(kaCheck.status).json({ error: kaCheck.error });
    return;
  }

  const existingGroups = await db.select().from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId));
  const sortOrder = existingGroups.length;

  await db.transaction(async (tx) => {
    await tx.insert(animalGroupsTable).values({
      id: group.id,
      kesimAlaniId,
      animalNo: group.animalNo || 0,
      colorTag: group.colorTag || "",
      locked: group.locked || false,
      notes: group.notes || "",
      sortOrder,
      kesildi: false,
    });

    if (group.donations && group.donations.length > 0) {
      await tx.insert(animalGroupDonationsTable)
        .values(group.donations.map((d, j) => ({
          groupId: group.id,
          donationId: d.id,
          sortOrder: j,
        })))
        .onConflictDoNothing();
    }
  });

  const result = await getFullKesimAlani(kesimAlaniId);
  res.status(201).json(result);
  refreshProjectStats();
}));

router.put("/kesim-alanlari/:id/animal-groups/bulk", asyncHandler(async (req, res) => {
  const parsed = bulkAnimalGroupsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId } = req.params;
  const { animalGroups } = parsed.data;

  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) {
    res.status(kaCheck.status).json({ error: kaCheck.error });
    return;
  }

  const existingGroups = await db.select({
    id: animalGroupsTable.id,
    kesildi: animalGroupsTable.kesildi,
    kesildiAt: animalGroupsTable.kesildiAt,
    teamId: animalGroupsTable.teamId,
  }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId));
  const kesildiMap = new Map(existingGroups.map(g => [g.id, { kesildi: g.kesildi, kesildiAt: g.kesildiAt, teamId: g.teamId }]));

  await db.transaction(async (tx) => {
    await tx.delete(animalGroupDonationsTable).where(
      inArray(animalGroupDonationsTable.groupId,
        tx.select({ id: animalGroupsTable.id }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId))
      )
    );
    await tx.delete(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId));
    await saveAnimalGroups(tx, kesimAlaniId, animalGroups as AnimalGroupPayload[], kesildiMap);
  });

  const result = await getFullKesimAlani(kesimAlaniId);
  res.json(result);
  refreshProjectStats();
}));

router.put("/kesim-alanlari/:id/animal-groups/:groupId", asyncHandler(async (req, res) => {
  const parsed = animalGroupPayloadSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId, groupId } = req.params;
  const updates = parsed.data;

  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) {
    res.status(kaCheck.status).json({ error: kaCheck.error });
    return;
  }

  const [existing] = await db.select().from(animalGroupsTable)
    .where(eq(animalGroupsTable.id, groupId));
  if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
    res.status(404).json({ error: ERROR_MESSAGES.ANIMAL_GROUP_NOT_FOUND });
    return;
  }

  const dbUpdates: Record<string, string | number | boolean | Date | null> = {};
  if (updates.animalNo !== undefined) dbUpdates.animalNo = updates.animalNo;
  if (updates.colorTag !== undefined) dbUpdates.colorTag = updates.colorTag;
  if (updates.locked !== undefined) dbUpdates.locked = updates.locked;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.kesildi !== undefined) {
    dbUpdates.kesildi = updates.kesildi;
    dbUpdates.kesildiAt = updates.kesildi ? new Date() : null;
  }

  await db.transaction(async (tx) => {
    if (Object.keys(dbUpdates).length > 0) {
      await tx.update(animalGroupsTable).set(dbUpdates).where(eq(animalGroupsTable.id, groupId));
    }

    if (updates.donations !== undefined) {
      await tx.delete(animalGroupDonationsTable).where(eq(animalGroupDonationsTable.groupId, groupId));
      if (updates.donations.length > 0) {
        await tx.insert(animalGroupDonationsTable)
          .values(updates.donations.map((d, j) => ({
            groupId,
            donationId: d.id,
            sortOrder: j,
          })))
          .onConflictDoNothing();
      }
    }
  });

  if (updates.kesildi !== undefined) {
    await createNotificationLogs(kesimAlaniId, groupId, existing.animalNo, updates.kesildi);
  }

  const result = await getFullKesimAlani(kesimAlaniId);
  res.json(result);
  refreshProjectStats();
}));

router.delete("/kesim-alanlari/:id/animal-groups/:groupId", asyncHandler(async (req, res) => {
  const { id: kesimAlaniId, groupId } = req.params;
  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) {
    res.status(kaCheck.status).json({ error: kaCheck.error });
    return;
  }
  const [existing] = await db.select().from(animalGroupsTable).where(eq(animalGroupsTable.id, groupId));
  if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
    res.status(404).json({ error: ERROR_MESSAGES.ANIMAL_GROUP_NOT_FOUND });
    return;
  }
  await db.delete(animalGroupsTable).where(eq(animalGroupsTable.id, groupId));
  res.json({ success: true });
  refreshProjectStats();
}));

export default router;
