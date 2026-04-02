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
import { serviceError, serviceOk, type ServiceResult } from "./result";
import {
  requireActiveKesimAlani,
  getFullKesimAlani,
  saveAnimalGroups,
  createNotificationLogs,
  type AnimalGroupPayload,
} from "./kesim-alani.service";

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
  const conditions = [eq(animalGroupsTable.kesimAlaniId, kesimAlaniId)];

  if (query.locked === "true") conditions.push(eq(animalGroupsTable.locked, true));
  if (query.locked === "false") conditions.push(eq(animalGroupsTable.locked, false));

  if (query.kesildi === "true") conditions.push(eq(animalGroupsTable.kesildi, true));
  if (query.kesildi === "false") conditions.push(eq(animalGroupsTable.kesildi, false));

  const teamId = typeof query.teamId === "string" ? query.teamId.trim() : "";
  if (teamId) conditions.push(eq(animalGroupsTable.teamId, teamId));

  return and(...conditions)!;
}

interface ListGroupsParams {
  kesimAlaniId: string;
  query: Record<string, unknown>;
  limit: number;
  cursor: string | null;
  offset: number;
}

export async function listGroups(params: ListGroupsParams) {
  const { kesimAlaniId, query } = params;
  const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  if (!ka) return serviceError("not_found", 404);

  const limit = Math.min(Math.max(params.limit, 1), 200);
  const { sortField, sortDir } = parseGroupSortParams(query);

  const where = buildGroupFilters(kesimAlaniId, query);

  const col = GROUP_SORT_FIELDS[sortField];
  const dirFn = sortDir === "desc" ? desc : asc;
  const cmpFn = sortDir === "desc" ? lt : gt;

  let cursorCondition;
  if (params.cursor) {
    const parsed = JSON.parse(Buffer.from(params.cursor, "base64url").toString("utf8"));
    const cursorId = parsed.id as string;
    const cursorVal = parsed.v as number;
    if (typeof cursorId === "string" && cursorVal !== undefined) {
      cursorCondition = or(
        cmpFn(col, cursorVal),
        and(eq(col, cursorVal), gt(animalGroupsTable.id, cursorId)),
      );
    }
  }

  const finalWhere = cursorCondition ? and(where, cursorCondition) : where;

  const dbQuery = db.select().from(animalGroupsTable)
    .where(finalWhere!)
    .orderBy(dirFn(col), asc(animalGroupsTable.id))
    .limit(limit + 1);

  const offset = params.offset;
  const rows = offset > 0 ? await dbQuery.offset(offset) : await dbQuery;

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

  return serviceOk({ items, nextCursor, hasMore });
}

export async function countGroups(kesimAlaniId: string, query: Record<string, unknown>) {
  const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  if (!ka) return serviceError("not_found", 404);

  const where = buildGroupFilters(kesimAlaniId, query);
  const [result] = await db.select({ total: count() }).from(animalGroupsTable).where(where);
  return serviceOk({ count: result.total });
}

export async function getGroupDetail(kesimAlaniId: string, groupId: string) {
  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, kesimAlaniId)));
  if (!group) return serviceError("not_found", 404);

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

  return serviceOk({
    detail: {
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
    },
  });
}

export async function bulkLockGroups(params: {
  kesimAlaniId: string;
  groupIds?: string[];
  filter?: Record<string, unknown>;
  locked: boolean;
}) {
  const { kesimAlaniId, groupIds, filter, locked } = params;

  if (!groupIds?.length && !filter) {
    return serviceError("filter_required", 400);
  }

  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) return serviceError(kaCheck.error, kaCheck.status);

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
  return serviceOk({ updated: updatedCount, locked });
}

export async function createGroup(kesimAlaniId: string, group: {
  id: string;
  animalNo?: number;
  colorTag?: string;
  locked?: boolean;
  notes?: string;
  donations?: { id: string }[];
}): Promise<ServiceResult<{ data: unknown }>> {
  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) return serviceError(kaCheck.error, kaCheck.status);

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

  return serviceOk({ data: await getFullKesimAlani(kesimAlaniId) });
}

export async function bulkUpdateGroups(kesimAlaniId: string, animalGroups: AnimalGroupPayload[]): Promise<ServiceResult<{ data: unknown }>> {
  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) return serviceError(kaCheck.error, kaCheck.status);

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
    await saveAnimalGroups(tx, kesimAlaniId, animalGroups, kesildiMap);
  });

  return serviceOk({ data: await getFullKesimAlani(kesimAlaniId) });
}

interface ChunkedSaveSession {
  saveSessionId: string;
  totalChunks: number;
  nextExpectedChunk: number;
  kesildiMap: Map<string, { kesildi: boolean; kesildiAt: Date | null; teamId: string | null }>;
  startedAt: number;
}

const activeSessions = new Map<string, ChunkedSaveSession>();
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [key, session] of activeSessions) {
    if (now - session.startedAt > SESSION_TIMEOUT_MS) {
      activeSessions.delete(key);
    }
  }
}

export async function bulkUpdateGroupsChunked(
  kesimAlaniId: string,
  animalGroups: AnimalGroupPayload[],
  chunkIndex: number,
  totalChunks: number,
  saveSessionId: string,
): Promise<ServiceResult<{ chunkIndex: number; totalChunks: number; savedCount: number; saveSessionId: string; data?: unknown }>> {
  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) return serviceError(kaCheck.error, kaCheck.status);

  cleanupExpiredSessions();

  const sessionKey = kesimAlaniId;

  try {
    if (chunkIndex === 0) {
      const existingSession = activeSessions.get(sessionKey);
      if (existingSession && Date.now() - existingSession.startedAt < SESSION_TIMEOUT_MS) {
        return serviceError("Başka bir kaydetme işlemi devam ediyor. Lütfen bekleyin ve tekrar deneyin.", 409);
      }

      const existingGroups = await db.select({
        id: animalGroupsTable.id,
        kesildi: animalGroupsTable.kesildi,
        kesildiAt: animalGroupsTable.kesildiAt,
        teamId: animalGroupsTable.teamId,
      }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId));
      const kesildiMap = new Map(existingGroups.map(g => [g.id, { kesildi: g.kesildi, kesildiAt: g.kesildiAt, teamId: g.teamId }]));

      activeSessions.set(sessionKey, {
        saveSessionId,
        totalChunks,
        nextExpectedChunk: 1,
        kesildiMap,
        startedAt: Date.now(),
      });

      await db.transaction(async (tx) => {
        await tx.delete(animalGroupDonationsTable).where(
          inArray(animalGroupDonationsTable.groupId,
            tx.select({ id: animalGroupsTable.id }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId))
          )
        );
        await tx.delete(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId));
        await saveAnimalGroups(tx, kesimAlaniId, animalGroups, kesildiMap);
      });
    } else {
      const session = activeSessions.get(sessionKey);
      if (!session) {
        return serviceError("Kaydetme oturumu bulunamadı. Lütfen baştan deneyin.", 409);
      }
      if (session.saveSessionId !== saveSessionId) {
        return serviceError("Başka bir kaydetme işlemi devam ediyor. Lütfen bekleyin ve tekrar deneyin.", 409);
      }
      if (session.nextExpectedChunk !== chunkIndex) {
        return serviceError(`Beklenen parça ${session.nextExpectedChunk}, ancak ${chunkIndex} alındı. Lütfen baştan deneyin.`, 409);
      }
      if (session.totalChunks !== totalChunks) {
        return serviceError("Parça sayısı uyuşmazlığı. Lütfen baştan deneyin.", 409);
      }

      await db.transaction(async (tx) => {
        await saveAnimalGroups(tx, kesimAlaniId, animalGroups, session.kesildiMap);
      });

      session.nextExpectedChunk = chunkIndex + 1;
    }
  } catch (err) {
    activeSessions.delete(sessionKey);
    throw err;
  }

  const isLastChunk = chunkIndex === totalChunks - 1;
  if (isLastChunk) {
    activeSessions.delete(sessionKey);
    return serviceOk({ chunkIndex, totalChunks, savedCount: animalGroups.length, saveSessionId, data: await getFullKesimAlani(kesimAlaniId) });
  }
  return serviceOk({ chunkIndex, totalChunks, savedCount: animalGroups.length, saveSessionId });
}

export async function updateGroup(kesimAlaniId: string, groupId: string, updates: {
  animalNo?: number;
  colorTag?: string;
  locked?: boolean;
  notes?: string;
  kesildi?: boolean;
  donations?: { id: string }[];
}): Promise<ServiceResult<{ data: unknown }>> {
  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) return serviceError(kaCheck.error, kaCheck.status);

  const [existing] = await db.select().from(animalGroupsTable)
    .where(eq(animalGroupsTable.id, groupId));
  if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
    return serviceError("group_not_found", 404);
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

  return serviceOk({ data: await getFullKesimAlani(kesimAlaniId) });
}

export async function deleteGroup(kesimAlaniId: string, groupId: string): Promise<ServiceResult<{ success: true }>> {
  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) return serviceError(kaCheck.error, kaCheck.status);

  const [existing] = await db.select().from(animalGroupsTable).where(eq(animalGroupsTable.id, groupId));
  if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
    return serviceError("group_not_found", 404);
  }

  await db.delete(animalGroupsTable).where(eq(animalGroupsTable.id, groupId));
  return serviceOk({ success: true as const });
}
