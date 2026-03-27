import { db } from "@workspace/db";
import { kesimAlanlariTable, projectsTable } from "@workspace/db/schema";
import { eq, isNull, isNotNull } from "drizzle-orm";
import crypto from "crypto";
import { serviceError, serviceOk, type ServiceResult } from "./result";
import {
  getFullKesimAlani,
  getFullKesimAlaniList,
  getCachedKAList,
  setCachedKAList,
  invalidateKACache,
  saveDonations,
  saveAnimalGroups,
  diffUpdateDonations,
  diffUpdateGroups,
  requireActiveKesimAlani,
  type DonationPayload,
  type AnimalGroupPayload,
} from "./kesim-alani.service";

export async function listKesimAlanlari(includeDeleted: boolean) {
  const { cached, cacheKey } = getCachedKAList(includeDeleted);
  if (cached) return serviceOk({ data: cached });

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
  return serviceOk({ data: results });
}

export async function listDeletedKesimAlanlari() {
  const rows = await db.select().from(kesimAlanlariTable)
    .where(isNotNull(kesimAlanlariTable.deletedAt))
    .orderBy(kesimAlanlariTable.createdAt);
  return serviceOk({ data: await getFullKesimAlaniList(rows) });
}

export async function getSingleKesimAlani(id: string): Promise<ServiceResult<{ data: unknown }>> {
  const result = await getFullKesimAlani(id);
  if (!result) return serviceError("not_found", 404);
  return serviceOk({ data: result });
}

interface CreateKesimAlaniParams {
  id: string;
  name: string;
  createdAt?: string;
  kesimListeId?: string | null;
  projectId?: string | null;
  donations: DonationPayload[];
  animalGroups: AnimalGroupPayload[];
}

export async function createKesimAlani(params: CreateKesimAlaniParams) {
  const { id, name, createdAt, kesimListeId, donations, animalGroups } = params;
  const projectId = params.projectId || null;

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
  donations?: DonationPayload[];
  animalGroups?: AnimalGroupPayload[];
}): Promise<ServiceResult<{ data: unknown }>> {
  const kaCheck = await requireActiveKesimAlani(id);
  if (kaCheck.error) return serviceError(kaCheck.error, kaCheck.status);

  const { name, kesimListeId, donations, animalGroups } = params;

  await db.transaction(async (tx) => {
    const kaUpdates: Record<string, string | null> = {};
    if (name !== undefined) kaUpdates.name = name;
    if (kesimListeId !== undefined) kaUpdates.kesimListeId = kesimListeId ?? null;
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

export async function deleteKesimAlani(id: string, permanent: boolean): Promise<ServiceResult<{ success: true }>> {
  const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
  if (!existing) return serviceError("not_found", 404);

  if (permanent) {
    await db.delete(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
  } else {
    await db.update(kesimAlanlariTable)
      .set({ deletedAt: new Date() })
      .where(eq(kesimAlanlariTable.id, id));
  }

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
