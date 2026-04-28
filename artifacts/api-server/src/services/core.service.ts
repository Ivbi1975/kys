import { db } from "@workspace/db";
import { kesimAlanlariTable, projectsTable, donationsTable, donationTagsTable, animalGroupDonationsTable } from "@workspace/db/schema";
import { eq, isNull, isNotNull, inArray, and, ne } from "drizzle-orm";
import crypto from "crypto";
import { serviceError, serviceOk, type ServiceResult } from "./result";
import { cacheGet, cacheSet } from "../lib/cache";
import {
  getFullKesimAlani,
  getFullKesimAlaniList,
  getCachedKAList,
  setCachedKAList,
  KA_LIST_CACHE_KEY,
  KA_LIST_TTL,
  invalidateKACache,
  getKesimAlaniMeta,
  saveDonations,
  saveAnimalGroups,
  diffUpdateDonations,
  diffUpdateGroups,
  upsertDonationsBatch,
  requireActiveKesimAlani,
  type DonationPayload,
  type AnimalGroupPayload,
} from "./kesim-alani.service";

export async function listKesimAlanlari(includeDeleted: boolean, projectId?: string | null) {
  if (!projectId) {
    const { cached, cacheKey } = getCachedKAList(includeDeleted);
    if (cached) return serviceOk({ data: cached });

    const hidePool = ne(kesimAlanlariTable.name, "__havuz__");
    const whereClause = includeDeleted ? hidePool : and(isNull(kesimAlanlariTable.deletedAt), hidePool);

    const rows = await db.select().from(kesimAlanlariTable)
      .where(whereClause)
      .orderBy(kesimAlanlariTable.createdAt);

    const results = await getFullKesimAlaniList(rows);
    setCachedKAList(cacheKey, results);
    return serviceOk({ data: results });
  }

  const projCacheKey = `${KA_LIST_CACHE_KEY}:proj:${includeDeleted ? "all" : "active"}:${projectId}`;
  const projCached = cacheGet<unknown[]>(projCacheKey);
  if (projCached) return serviceOk({ data: projCached });

  const { cached: fullCached } = getCachedKAList(includeDeleted);
  if (fullCached) {
    const filtered = (fullCached as Array<{ projectId?: string | null }>).filter(
      k => k.projectId === projectId,
    );
    cacheSet(projCacheKey, filtered, KA_LIST_TTL);
    return serviceOk({ data: filtered });
  }

  const hidePool = ne(kesimAlanlariTable.name, "__havuz__");
  const projectFilter = eq(kesimAlanlariTable.projectId, projectId);
  const whereClause = includeDeleted
    ? and(hidePool, projectFilter)
    : and(isNull(kesimAlanlariTable.deletedAt), hidePool, projectFilter);

  const rows = await db.select().from(kesimAlanlariTable)
    .where(whereClause)
    .orderBy(kesimAlanlariTable.createdAt);

  const results = await getFullKesimAlaniList(rows);
  cacheSet(projCacheKey, results, KA_LIST_TTL);
  return serviceOk({ data: results });
}

export async function listDeletedKesimAlanlari() {
  const rows = await db.select({
    id: kesimAlanlariTable.id,
    name: kesimAlanlariTable.name,
    createdAt: kesimAlanlariTable.createdAt,
    deletedAt: kesimAlanlariTable.deletedAt,
    projectId: kesimAlanlariTable.projectId,
  })
    .from(kesimAlanlariTable)
    .where(isNotNull(kesimAlanlariTable.deletedAt))
    .orderBy(kesimAlanlariTable.createdAt);

  const projectIds = [...new Set(rows.map(r => r.projectId).filter(Boolean))] as string[];
  let projectNameMap: Record<string, string> = {};
  if (projectIds.length > 0) {
    const projects = await db.select({ id: projectsTable.id, name: projectsTable.name })
      .from(projectsTable)
      .where(inArray(projectsTable.id, projectIds));
    projectNameMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
  }

  const enriched = rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    projectId: row.projectId,
    projectName: row.projectId ? (projectNameMap[row.projectId] || null) : null,
    donations: [],
    animalGroups: [],
  }));

  return serviceOk({ data: enriched });
}

export async function getSingleKesimAlani(id: string): Promise<ServiceResult<{ data: unknown }>> {
  const result = await getFullKesimAlani(id);
  if (!result) return serviceError("not_found", 404);
  return serviceOk({ data: result });
}

export async function getKesimAlaniMetaService(id: string): Promise<ServiceResult<{ data: unknown }>> {
  const result = await getKesimAlaniMeta(id);
  if (!result) return serviceError("not_found", 404);
  return serviceOk({ data: result });
}

interface CreateKesimAlaniParams {
  id: string;
  name: string;
  createdAt?: string;
  kesimListeId?: string | null;
  yetkili?: string | null;
  displayName?: string | null;
  maxVekalet?: number | null;
  maxAnimal?: number | null;
  projectId?: string | null;
  donations: DonationPayload[];
  animalGroups: AnimalGroupPayload[];
}

export async function createKesimAlani(params: CreateKesimAlaniParams) {
  const { id, name, createdAt, kesimListeId, yetkili, displayName, maxVekalet, maxAnimal, donations, animalGroups } = params;
  const projectId = params.projectId || null;

  await db.transaction(async (tx) => {
    await tx.insert(kesimAlanlariTable).values({
      id,
      name,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
      projectId,
      trackingToken: crypto.randomBytes(16).toString("hex"),
      kesimListeId: kesimListeId ?? null,
      yetkili: yetkili ?? null,
      displayName: displayName ?? null,
      maxVekalet: maxVekalet ?? null,
      maxAnimal: maxAnimal ?? null,
    });

    if (donations.length > 0) {
      await saveDonations(tx, id, donations);
    }

    if (animalGroups.length > 0) {
      await saveAnimalGroups(tx, id, animalGroups);
    }
  });

  invalidateKACache();
  return serviceOk({ data: await getFullKesimAlani(id) });
}

export async function moveKesimAlani(id: string, projectId: string | null | undefined): Promise<ServiceResult<{ data: unknown }>> {
  const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
  if (!existing) return serviceError("not_found", 404);

  if (projectId) {
    const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!proj) return serviceError("project_not_found", 404);
  }

  await db.update(kesimAlanlariTable).set({ projectId: projectId || null }).where(eq(kesimAlanlariTable.id, id));
  invalidateKACache();
  return serviceOk({ data: await getFullKesimAlani(id) });
}

export async function updateKesimAlani(id: string, params: {
  name?: string;
  kesimListeId?: string | null;
  yetkili?: string | null;
  displayName?: string | null;
  maxVekalet?: number | null;
  maxAnimal?: number | null;
  donations?: DonationPayload[];
  animalGroups?: AnimalGroupPayload[];
}): Promise<ServiceResult<{ data: unknown }>> {
  const kaCheck = await requireActiveKesimAlani(id);
  if (kaCheck.error) return serviceError(kaCheck.error, kaCheck.status);

  const { name, kesimListeId, yetkili, displayName, maxVekalet, maxAnimal, donations, animalGroups } = params;

  await db.transaction(async (tx) => {
    const kaUpdates: Record<string, string | number | null> = {};
    if (name !== undefined) kaUpdates.name = name;
    if (kesimListeId !== undefined) kaUpdates.kesimListeId = kesimListeId ?? null;
    if (yetkili !== undefined) kaUpdates.yetkili = yetkili ?? null;
    if (displayName !== undefined) kaUpdates.displayName = displayName ?? null;
    if (maxVekalet !== undefined) kaUpdates.maxVekalet = maxVekalet ?? null;
    if (maxAnimal !== undefined) kaUpdates.maxAnimal = maxAnimal ?? null;
    if (Object.keys(kaUpdates).length > 0) {
      await tx.update(kesimAlanlariTable).set(kaUpdates).where(eq(kesimAlanlariTable.id, id));
    }

    if (donations !== undefined) {
      await diffUpdateDonations(tx, id, donations);
    }
    if (animalGroups !== undefined) {
      await diffUpdateGroups(tx, id, animalGroups);
    }
  });

  invalidateKACache();
  return serviceOk({ data: await getFullKesimAlani(id) });
}

export async function updateKesimAlaniDonationsChunked(
  id: string,
  donations: DonationPayload[],
  chunkIndex: number,
  totalChunks: number,
  sortOrderOffset: number,
  allDonationIds?: string[],
  metaUpdates?: { name?: string; kesimListeId?: string | null; yetkili?: string | null; displayName?: string | null },
): Promise<ServiceResult<{ chunkIndex: number; totalChunks: number; savedCount: number; data?: unknown }>> {
  const kaCheck = await requireActiveKesimAlani(id);
  if (kaCheck.error) return serviceError(kaCheck.error, kaCheck.status);

  const isFirstChunk = chunkIndex === 0;

  await db.transaction(async (tx) => {
    if (isFirstChunk && metaUpdates) {
      const kaUpdates: Record<string, string | null> = {};
      if (metaUpdates.name !== undefined) kaUpdates.name = metaUpdates.name;
      if (metaUpdates.kesimListeId !== undefined) kaUpdates.kesimListeId = metaUpdates.kesimListeId ?? null;
      if (metaUpdates.yetkili !== undefined) kaUpdates.yetkili = metaUpdates.yetkili ?? null;
      if (metaUpdates.displayName !== undefined) kaUpdates.displayName = metaUpdates.displayName ?? null;
      if (Object.keys(kaUpdates).length > 0) {
        await tx.update(kesimAlanlariTable).set(kaUpdates).where(eq(kesimAlanlariTable.id, id));
      }
    }

    if (isFirstChunk && allDonationIds) {
      const existingRows = await tx.select({ id: donationsTable.id })
        .from(donationsTable)
        .where(and(eq(donationsTable.kesimAlaniId, id), isNull(donationsTable.deletedAt)));
      const keepIds = new Set(allDonationIds);
      const toDeleteIds = existingRows.filter(r => !keepIds.has(r.id)).map(r => r.id);
      if (toDeleteIds.length > 0) {
        for (let i = 0; i < toDeleteIds.length; i += 500) {
          const batch = toDeleteIds.slice(i, i + 500);
          await tx.delete(donationTagsTable).where(inArray(donationTagsTable.donationId, batch));
          await tx.delete(donationsTable).where(inArray(donationsTable.id, batch));
        }
      }
    }

    const validDonations = donations.filter(d => (d.name ?? "").trim());
    await upsertDonationsBatch(tx, id, validDonations, sortOrderOffset);
  });

  const isLastChunk = chunkIndex === totalChunks - 1;
  if (isLastChunk) {
    invalidateKACache();
    const fullData = await getFullKesimAlani(id);
    return serviceOk({ chunkIndex, totalChunks, savedCount: donations.length, data: fullData });
  }

  return serviceOk({ chunkIndex, totalChunks, savedCount: donations.length });
}

export async function deleteKesimAlani(id: string, permanent: boolean): Promise<ServiceResult<{ success: true }>> {
  const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
  if (!existing) return serviceError("not_found", 404);

  await db.transaction(async (tx) => {
    if (existing.projectId) {
      let [pool] = await tx.select({ id: kesimAlanlariTable.id })
        .from(kesimAlanlariTable)
        .where(and(
          eq(kesimAlanlariTable.projectId, existing.projectId),
          eq(kesimAlanlariTable.name, "__havuz__"),
          isNull(kesimAlanlariTable.deletedAt),
        ));

      if (!pool) {
        const poolId = crypto.randomBytes(16).toString("hex");
        await tx.insert(kesimAlanlariTable).values({
          id: poolId,
          name: "__havuz__",
          projectId: existing.projectId,
          trackingToken: crypto.randomBytes(16).toString("hex"),
          createdAt: new Date(),
        });
        pool = { id: poolId };
      }

      const donations = await tx.select({ id: donationsTable.id })
        .from(donationsTable)
        .where(and(eq(donationsTable.kesimAlaniId, id), isNull(donationsTable.deletedAt)));

      if (donations.length > 0) {
        const donationIds = donations.map(d => d.id);
        const BATCH = 500;
        for (let i = 0; i < donationIds.length; i += BATCH) {
          const batch = donationIds.slice(i, i + BATCH);
          await tx.delete(animalGroupDonationsTable)
            .where(inArray(animalGroupDonationsTable.donationId, batch));
          await tx.update(donationsTable)
            .set({ kesimAlaniId: pool.id })
            .where(inArray(donationsTable.id, batch));
        }
      }
    }

    if (permanent) {
      await tx.delete(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
    } else {
      await tx.update(kesimAlanlariTable)
        .set({ deletedAt: new Date() })
        .where(eq(kesimAlanlariTable.id, id));
    }
  });

  invalidateKACache();
  return serviceOk({ success: true as const });
}

export async function restoreKesimAlani(id: string): Promise<ServiceResult<{ data: unknown }>> {
  const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
  if (!existing) return serviceError("not_found", 404);
  if (!existing.deletedAt) return serviceError("already_active", 400);

  await db.update(kesimAlanlariTable)
    .set({ deletedAt: null })
    .where(eq(kesimAlanlariTable.id, id));

  invalidateKACache();
  return serviceOk({ data: await getFullKesimAlani(id) });
}
