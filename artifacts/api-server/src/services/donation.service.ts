import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  donationTagsTable,
} from "@workspace/db/schema";
import { desc, gt, lt, or, count, ilike, asc } from "drizzle-orm";
import { eq, inArray, isNull, isNotNull, and } from "drizzle-orm";
import { MAX_QUERY_LIMIT } from "../lib/constants";
import { serviceError, serviceOk, type ServiceResult } from "./result";
import { requireActiveKesimAlani, getFullKesimAlani } from "./kesim-alani.service";

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

function hydrateTagsByDonation(donationTags: { donationId: string; tagId: string }[]) {
  const tagsByDonation: Record<string, string[]> = {};
  for (const dt of donationTags) {
    if (!tagsByDonation[dt.donationId]) tagsByDonation[dt.donationId] = [];
    tagsByDonation[dt.donationId].push(dt.tagId);
  }
  return tagsByDonation;
}

function mapDonationRow(d: typeof donationsTable.$inferSelect, tags: string[]) {
  return {
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
    tags,
    aiCategories: d.aiCategories ? JSON.parse(d.aiCategories) : [],
    aiWarnings: d.aiWarnings || "",
  };
}

interface ListDonationsParams {
  kesimAlaniId: string;
  query: Record<string, unknown>;
  limit: number;
  cursor: string | null;
}

export async function listDonations(params: ListDonationsParams): Promise<ServiceResult<{
  items: ReturnType<typeof mapDonationRow>[];
  nextCursor: string | null;
  hasMore: boolean;
}>> {
  const { kesimAlaniId, query } = params;
  const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  if (!ka) return serviceError("not_found", 404);

  const rawLimit = params.limit;
  const limit = Math.min(Math.max(rawLimit, 1), MAX_QUERY_LIMIT);
  const { sortField, sortDir } = parseSortParams(query);

  const where = buildDonationFilters(kesimAlaniId, query);

  const col = DONATION_SORT_FIELDS[sortField];
  const dirFn = sortDir === "desc" ? desc : asc;
  const cmpFn = sortDir === "desc" ? lt : gt;

  let cursorCondition;
  if (params.cursor) {
    const parsed = JSON.parse(Buffer.from(params.cursor, "base64url").toString("utf8"));
    const cursorId = parsed.id as string;
    const cursorVal = parsed.v as string | number;
    if (typeof cursorId === "string" && cursorVal !== undefined) {
      cursorCondition = or(
        cmpFn(col, cursorVal),
        and(eq(col, cursorVal), gt(donationsTable.id, cursorId)),
      );
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

  const tagsByDonation = hydrateTagsByDonation(donationTags);
  const items = pageRows.map(d => mapDonationRow(d, tagsByDonation[d.id] || []));

  const lastItem = pageRows[pageRows.length - 1];
  let nextCursor: string | null = null;
  if (hasMore && lastItem) {
    const val = sortField === "sortOrder" ? lastItem.sortOrder
      : sortField === "shareCount" ? lastItem.shareCount
      : sortField === "name" ? lastItem.name
      : lastItem.donationType;
    nextCursor = Buffer.from(JSON.stringify({ v: val, id: lastItem.id })).toString("base64url");
  }

  return serviceOk({ items, nextCursor, hasMore });
}

export async function countDonations(kesimAlaniId: string, query: Record<string, unknown>): Promise<ServiceResult<{ count: number }>> {
  const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  if (!ka) return serviceError("not_found", 404);

  const where = buildDonationFilters(kesimAlaniId, query);
  const [result] = await db.select({ total: count() }).from(donationsTable).where(where);
  return serviceOk({ count: result.total });
}

interface DonationInput {
  id: string;
  name?: string;
  description?: string;
  donationType?: string;
  shareCount?: number;
  vekalet?: string;
  notes?: string;
  phone?: string;
  excluded?: boolean;
  tags?: string[];
}

export async function createDonation(kesimAlaniId: string, donation: DonationInput): Promise<ServiceResult<{ data: unknown }>> {
  const check = await requireActiveKesimAlani(kesimAlaniId);
  if (check.error) return serviceError(check.error, check.status);

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

  return serviceOk({ data: await getFullKesimAlani(kesimAlaniId) });
}

export async function updateDonation(kesimAlaniId: string, donationId: string, updates: Partial<DonationInput>): Promise<ServiceResult<{ data: unknown }>> {
  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) return serviceError(kaCheck.error, kaCheck.status);

  const [existing] = await db.select().from(donationsTable)
    .where(eq(donationsTable.id, donationId));
  if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
    return serviceError("donor_not_found", 404);
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

  return serviceOk({ data: await getFullKesimAlani(kesimAlaniId) });
}

export async function deleteDonation(kesimAlaniId: string, donationId: string, permanent: boolean): Promise<ServiceResult<{ success: true }>> {
  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) return serviceError(kaCheck.error, kaCheck.status);

  const [existing] = await db.select().from(donationsTable).where(eq(donationsTable.id, donationId));
  if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
    return serviceError("donor_not_found", 404);
  }

  if (permanent) {
    await db.delete(donationsTable).where(eq(donationsTable.id, donationId));
  } else {
    await db.update(donationsTable)
      .set({ deletedAt: new Date() })
      .where(eq(donationsTable.id, donationId));
  }

  return serviceOk({ success: true as const });
}

export async function restoreDonation(kesimAlaniId: string, donationId: string): Promise<ServiceResult<{ data: unknown }>> {
  const [existing] = await db.select().from(donationsTable).where(eq(donationsTable.id, donationId));
  if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
    return serviceError("donor_not_found", 404);
  }
  if (!existing.deletedAt) {
    return serviceError("already_active", 400);
  }

  await db.update(donationsTable)
    .set({ deletedAt: null })
    .where(eq(donationsTable.id, donationId));

  return serviceOk({ data: await getFullKesimAlani(kesimAlaniId) });
}

export async function listDeletedDonations(kesimAlaniId: string) {
  const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  if (!ka) return serviceError("not_found", 404);

  const deletedDonations = await db.select().from(donationsTable)
    .where(and(eq(donationsTable.kesimAlaniId, kesimAlaniId), isNotNull(donationsTable.deletedAt)))
    .orderBy(donationsTable.deletedAt);

  const donationIds = deletedDonations.map(d => d.id);
  const donationTags = donationIds.length > 0
    ? await db.select({ donationId: donationTagsTable.donationId, tagId: donationTagsTable.tagId })
        .from(donationTagsTable).where(inArray(donationTagsTable.donationId, donationIds))
    : [];

  const tagsByDonation = hydrateTagsByDonation(donationTags);

  const items = deletedDonations.map(d => ({
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

  return serviceOk({ items });
}
