import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  donationTagsTable,
} from "@workspace/db/schema";
import { desc, gt, lt, or, count, ilike, asc } from "drizzle-orm";
import { eq, inArray, isNull, isNotNull, and } from "drizzle-orm";
import { z } from "zod";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { MAX_QUERY_LIMIT, ERROR_MESSAGES } from "../../lib/constants";
import {
  requireActiveKesimAlani,
  getFullKesimAlani,
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

function buildDonationFilters(kesimAlaniId: string, query: Record<string, unknown>) {
  const conditions = [
    eq(donationsTable.kesimAlaniId, kesimAlaniId),
    isNull(donationsTable.deletedAt),
  ];

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(donationsTable.name, pattern),
        ilike(donationsTable.description, pattern),
        ilike(donationsTable.phone, pattern),
      )!,
    );
  }

  if (query.excluded === "true") conditions.push(eq(donationsTable.excluded, true));
  if (query.excluded === "false") conditions.push(eq(donationsTable.excluded, false));

  const donationType = typeof query.donationType === "string" ? query.donationType.trim() : "";
  if (donationType) conditions.push(eq(donationsTable.donationType, donationType));

  return and(...conditions)!;
}

const DONATION_SORT_FIELDS = {
  sortOrder: donationsTable.sortOrder,
  name: donationsTable.name,
  shareCount: donationsTable.shareCount,
  donationType: donationsTable.donationType,
} as const;
type DonationSortField = keyof typeof DONATION_SORT_FIELDS;

function parseSortParams(query: Record<string, unknown>) {
  const rawField = typeof query.sortField === "string" ? query.sortField : "sortOrder";
  const sortField: DonationSortField = rawField in DONATION_SORT_FIELDS
    ? (rawField as DonationSortField) : "sortOrder";
  const sortDir = query.sortDir === "desc" ? "desc" as const : "asc" as const;
  return { sortField, sortDir };
}

const router: IRouter = Router();

router.get("/kesim-alanlari/:id/donations", asyncHandler(async (req, res) => {
  const { id: kesimAlaniId } = req.params;
  const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  if (!ka) {
    res.status(404).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }

  const rawLimit = Number(req.query.limit) || 100;
  const limit = Math.min(Math.max(rawLimit, 1), MAX_QUERY_LIMIT);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;
  const { sortField, sortDir } = parseSortParams(req.query as Record<string, unknown>);

  const where = buildDonationFilters(kesimAlaniId, req.query as Record<string, unknown>);

  const col = DONATION_SORT_FIELDS[sortField];
  const dirFn = sortDir === "desc" ? desc : asc;
  const cmpFn = sortDir === "desc" ? lt : gt;

  let cursorCondition;
  if (cursor) {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      const cursorId = parsed.id as string;
      const cursorVal = parsed.v as string | number;
      if (typeof cursorId === "string" && cursorVal !== undefined) {
        cursorCondition = or(
          cmpFn(col, cursorVal),
          and(eq(col, cursorVal), gt(donationsTable.id, cursorId)),
        );
      }
    } catch {
      res.status(400).json({ error: ERROR_MESSAGES.INVALID_CURSOR });
      return;
    }
  }

  const finalWhere = cursorCondition ? and(where, cursorCondition) : where;

  const rows = await db.select().from(donationsTable)
    .where(finalWhere!)
    .orderBy(dirFn(col), asc(donationsTable.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const donationIds = pageRows.map(d => d.id);
  const donationTags = donationIds.length > 0
    ? await db.select({ donationId: donationTagsTable.donationId, tagId: donationTagsTable.tagId })
        .from(donationTagsTable).where(inArray(donationTagsTable.donationId, donationIds))
    : [];

  const tagsByDonation: Record<string, string[]> = {};
  for (const dt of donationTags) {
    if (!tagsByDonation[dt.donationId]) tagsByDonation[dt.donationId] = [];
    tagsByDonation[dt.donationId].push(dt.tagId);
  }

  const items = pageRows.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    donationType: d.donationType,
    shareCount: d.shareCount,
    vekalet: d.vekalet,
    notes: d.notes,
    phone: d.phone || "",
    excluded: d.excluded,
    sortOrder: d.sortOrder,
    tags: tagsByDonation[d.id] || [],
    aiCategories: d.aiCategories ? JSON.parse(d.aiCategories) : [],
    aiWarnings: d.aiWarnings || "",
  }));

  const lastItem = pageRows[pageRows.length - 1];
  let nextCursor: string | null = null;
  if (hasMore && lastItem) {
    const val = sortField === "sortOrder" ? lastItem.sortOrder
      : sortField === "shareCount" ? lastItem.shareCount
      : sortField === "name" ? lastItem.name
      : lastItem.donationType;
    nextCursor = Buffer.from(JSON.stringify({ v: val, id: lastItem.id })).toString("base64url");
  }

  res.json({ items, nextCursor, hasMore });
}));

router.get("/kesim-alanlari/:id/donations/count", asyncHandler(async (req, res) => {
  const { id: kesimAlaniId } = req.params;
  const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  if (!ka) {
    res.status(404).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }

  const where = buildDonationFilters(kesimAlaniId, req.query as Record<string, unknown>);
  const [result] = await db.select({ total: count() }).from(donationsTable).where(where);
  res.json({ count: result.total });
}));

router.post("/kesim-alanlari/:id/donations", asyncHandler(async (req, res) => {
  const parsed = donationPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId } = req.params;
  const donation = parsed.data;

  const check = await requireActiveKesimAlani(kesimAlaniId);
  if (check.error) {
    res.status(check.status).json({ error: check.error });
    return;
  }

  const existingDonations = await db.select().from(donationsTable).where(eq(donationsTable.kesimAlaniId, kesimAlaniId));
  const sortOrder = existingDonations.length;

  await db.transaction(async (tx) => {
    await tx.insert(donationsTable).values({
      id: donation.id,
      kesimAlaniId,
      name: donation.name || "",
      description: donation.description || "",
      donationType: donation.donationType || "",
      shareCount: donation.shareCount || 1,
      vekalet: donation.vekalet || "",
      notes: donation.notes || "",
      phone: donation.phone || "",
      excluded: donation.excluded || false,
      sortOrder,
    });

    if (donation.tags && donation.tags.length > 0) {
      await tx.insert(donationTagsTable)
        .values(donation.tags.map(tagId => ({ donationId: donation.id, tagId })))
        .onConflictDoNothing();
    }
  });

  const result = await getFullKesimAlani(kesimAlaniId);
  res.status(201).json(result);
  refreshProjectStats();
}));

router.put("/kesim-alanlari/:id/donations/:donationId", asyncHandler(async (req, res) => {
  const parsed = donationPayloadSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId, donationId } = req.params;
  const updates = parsed.data;

  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) {
    res.status(kaCheck.status).json({ error: kaCheck.error });
    return;
  }

  const [existing] = await db.select().from(donationsTable)
    .where(eq(donationsTable.id, donationId));
  if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
    res.status(404).json({ error: ERROR_MESSAGES.DONOR_NOT_FOUND });
    return;
  }

  const dbUpdates: Record<string, string | number | boolean> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.donationType !== undefined) dbUpdates.donationType = updates.donationType;
  if (updates.shareCount !== undefined) dbUpdates.shareCount = updates.shareCount;
  if (updates.vekalet !== undefined) dbUpdates.vekalet = updates.vekalet;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.excluded !== undefined) dbUpdates.excluded = updates.excluded;

  await db.transaction(async (tx) => {
    if (Object.keys(dbUpdates).length > 0) {
      await tx.update(donationsTable).set(dbUpdates).where(eq(donationsTable.id, donationId));
    }

    if (updates.tags !== undefined) {
      await tx.delete(donationTagsTable).where(eq(donationTagsTable.donationId, donationId));
      if (updates.tags.length > 0) {
        await tx.insert(donationTagsTable)
          .values(updates.tags.map(tagId => ({ donationId, tagId })))
          .onConflictDoNothing();
      }
    }
  });

  const result = await getFullKesimAlani(kesimAlaniId);
  res.json(result);
  refreshProjectStats();
}));

router.delete("/kesim-alanlari/:id/donations/:donationId", asyncHandler(async (req, res) => {
  const { id: kesimAlaniId, donationId } = req.params;
  const permanent = req.query.permanent === "true";
  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) {
    res.status(kaCheck.status).json({ error: kaCheck.error });
    return;
  }
  const [existing] = await db.select().from(donationsTable).where(eq(donationsTable.id, donationId));
  if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
    res.status(404).json({ error: ERROR_MESSAGES.DONOR_NOT_FOUND });
    return;
  }
  if (permanent) {
    await db.delete(donationsTable).where(eq(donationsTable.id, donationId));
  } else {
    await db.update(donationsTable)
      .set({ deletedAt: new Date() })
      .where(eq(donationsTable.id, donationId));
  }
  res.json({ success: true });
  refreshProjectStats();
}));

router.post("/kesim-alanlari/:id/donations/:donationId/restore", asyncHandler(async (req, res) => {
  const { id: kesimAlaniId, donationId } = req.params;
  const [existing] = await db.select().from(donationsTable).where(eq(donationsTable.id, donationId));
  if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
    res.status(404).json({ error: ERROR_MESSAGES.DONOR_NOT_FOUND });
    return;
  }
  if (!existing.deletedAt) {
    res.status(400).json({ error: ERROR_MESSAGES.DONOR_ALREADY_ACTIVE });
    return;
  }
  await db.update(donationsTable)
    .set({ deletedAt: null })
    .where(eq(donationsTable.id, donationId));
  const result = await getFullKesimAlani(kesimAlaniId);
  res.json(result);
  refreshProjectStats();
}));

router.get("/kesim-alanlari/:id/donations/deleted", asyncHandler(async (req, res) => {
  const { id: kesimAlaniId } = req.params;
  const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  if (!ka) {
    res.status(404).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }
  const deletedDonations = await db.select().from(donationsTable)
    .where(and(eq(donationsTable.kesimAlaniId, kesimAlaniId), isNotNull(donationsTable.deletedAt)))
    .orderBy(donationsTable.deletedAt);

  const donationIds = deletedDonations.map(d => d.id);
  const donationTags = donationIds.length > 0
    ? await db.select({ donationId: donationTagsTable.donationId, tagId: donationTagsTable.tagId })
        .from(donationTagsTable).where(inArray(donationTagsTable.donationId, donationIds))
    : [];

  const tagsByDonation: Record<string, string[]> = {};
  for (const dt of donationTags) {
    if (!tagsByDonation[dt.donationId]) tagsByDonation[dt.donationId] = [];
    tagsByDonation[dt.donationId].push(dt.tagId);
  }

  const result = deletedDonations.map(d => ({
    id: d.id,
    kesimAlaniId: d.kesimAlaniId,
    name: d.name,
    description: d.description,
    donationType: d.donationType,
    shareCount: d.shareCount,
    vekalet: d.vekalet,
    notes: d.notes,
    excluded: d.excluded,
    deletedAt: d.deletedAt,
    tags: tagsByDonation[d.id] || [],
    aiCategories: d.aiCategories ? JSON.parse(d.aiCategories) : [],
    aiWarnings: d.aiWarnings || "",
  }));
  res.json(result);
}));

export default router;
