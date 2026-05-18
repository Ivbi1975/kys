import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  animalGroupsTable,
  animalGroupDonationsTable,
  donationTransfersTable,
  trackingNotesTable,
} from "@workspace/db/schema";
import { desc, max } from "drizzle-orm";
import { eq, inArray, isNull, and } from "drizzle-orm";
import { NoteType, NoteStatus } from "../lib/constants";
import { serviceError, serviceOk } from "./result";
import { withSerializationRetry } from "../lib/tx-retry";

interface MoveDonationsParams {
  donationIds: string[];
  sourceKesimAlaniId: string;
  targetKesimAlaniId: string;
}

export async function moveDonations(params: MoveDonationsParams) {
  const { donationIds, sourceKesimAlaniId, targetKesimAlaniId } = params;

  const [sourceKA, targetKA] = await Promise.all([
    db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, sourceKesimAlaniId)).then(r => r[0]),
    db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, targetKesimAlaniId)).then(r => r[0]),
  ]);

  if (!sourceKA || sourceKA.deletedAt) {
    return serviceError("source_not_found", 404);
  }
  if (!targetKA || targetKA.deletedAt) {
    return serviceError("target_not_found", 404);
  }
  if (sourceKA.projectId !== targetKA.projectId) {
    return serviceError("different_project", 400);
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
    return serviceError("no_valid_donors", 400);
  }

  const groupLinks = await db.select({
    donationId: animalGroupDonationsTable.donationId,
    groupId: animalGroupDonationsTable.groupId,
  })
    .from(animalGroupDonationsTable)
    .where(inArray(animalGroupDonationsTable.donationId, validIds));

  if (groupLinks.length > 0) {
    const linkedGroupIds = [...new Set(groupLinks.map(l => l.groupId))];
    const linkedGroups = await db.select({
      id: animalGroupsTable.id,
      locked: animalGroupsTable.locked,
      kesildi: animalGroupsTable.kesildi,
    })
      .from(animalGroupsTable)
      .where(inArray(animalGroupsTable.id, linkedGroupIds));

    const blockedGroupIds = new Set(
      linkedGroups.filter(g => g.locked || g.kesildi).map(g => g.id)
    );

    if (blockedGroupIds.size > 0) {
      const blockedDonationIds = new Set(
        groupLinks.filter(l => blockedGroupIds.has(l.groupId)).map(l => l.donationId)
      );
      const allowedIds = validIds.filter(id => !blockedDonationIds.has(id));
      if (allowedIds.length === 0) {
        return serviceError("all_donors_in_locked_groups", 400);
      }
      validIds.length = 0;
      validIds.push(...allowedIds);
    }
  }

  await withSerializationRetry(() =>
    db.transaction(async (tx) => {
      const groupLinksToRemove = groupLinks.filter(l => validIds.includes(l.donationId));
      if (groupLinksToRemove.length > 0) {
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
    }, { isolationLevel: "repeatable read" }),
    "transferDonations"
  );

  return serviceOk({ count: validIds.length, skipped: donationIds.length - validIds.length, movedIds: validIds });
}

interface TransferEntry {
  id: string;
  projectId: string;
  donationId: string;
  donorName: string;
  donorDescription: string;
  fromKesimAlaniId: string;
  fromKesimAlaniName: string;
  toKesimAlaniId: string;
  toKesimAlaniName: string;
  removedFromSource: boolean;
  shareCount: number;
  createdAt: string;
  transferType?: string;
  animalGroupId?: string;
  animalNo?: number;
  batchId?: string;
}

export async function saveDonationTransfers(entries: TransferEntry[]) {
  await db.insert(donationTransfersTable).values(
    entries.map(e => ({ ...e, createdAt: new Date(e.createdAt) }))
  );
  return serviceOk({ count: entries.length });
}

export async function getTransferLog(projectId: string) {
  const logs = await db.select().from(donationTransfersTable)
    .where(eq(donationTransfersTable.projectId, projectId))
    .orderBy(desc(donationTransfersTable.createdAt));
  return serviceOk({ data: logs });
}

export async function getPendingEditRequests(projectId: string) {
  const kaRows = await db.select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  if (kaRows.length === 0) {
    return serviceOk({ count: 0, requests: [] as { id: string; kesimAlaniId: string; kesimAlaniName: string; animalGroupId: string | null; fieldName: string | null; oldValue: string | null; newValue: string | null; content: string | null; createdAt: Date }[] });
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

  function mapRequest(n: typeof pendingNotes[0]) {
    return {
      id: n.id,
      kesimAlaniId: n.kesimAlaniId,
      kesimAlaniName: kaNameMap.get(n.kesimAlaniId) || "",
      animalGroupId: n.animalGroupId,
      fieldName: n.fieldName,
      oldValue: n.oldValue,
      newValue: n.newValue,
      content: n.content,
      createdAt: n.createdAt,
    };
  }

  const requests = pendingNotes.map(mapRequest);
  return serviceOk({ count: requests.length, requests });
}

interface MoveAnimalGroupParams {
  animalGroupId: string;
  sourceKesimAlaniId: string;
  targetKesimAlaniId: string;
  lastUpdatedAt?: string;
}

export async function moveAnimalGroup(params: MoveAnimalGroupParams) {
  const { animalGroupId, sourceKesimAlaniId, targetKesimAlaniId, lastUpdatedAt } = params;

  const [sourceKA, targetKA] = await Promise.all([
    db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, sourceKesimAlaniId)).then(r => r[0]),
    db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, targetKesimAlaniId)).then(r => r[0]),
  ]);

  if (!sourceKA || sourceKA.deletedAt) {
    return serviceError("source_not_found", 404);
  }
  if (!targetKA || targetKA.deletedAt) {
    return serviceError("target_not_found", 404);
  }
  if (sourceKA.projectId !== targetKA.projectId) {
    return serviceError("different_project", 400);
  }

  const group = await db.select().from(animalGroupsTable)
    .where(and(
      eq(animalGroupsTable.id, animalGroupId),
      eq(animalGroupsTable.kesimAlaniId, sourceKesimAlaniId),
      isNull(animalGroupsTable.deletedAt),
    ))
    .then(r => r[0]);

  if (!group) {
    return serviceError("group_not_in_source", 404);
  }
  if (group.locked) {
    return serviceError("group_locked", 400);
  }
  if (group.kesildi) {
    return serviceError("group_kesildi", 400);
  }

  let newAnimalNo = 0;

  await withSerializationRetry(() => db.transaction(async (tx) => {
    if (lastUpdatedAt) {
      const freshGroup = await tx.select({ updatedAt: animalGroupsTable.updatedAt })
        .from(animalGroupsTable)
        .where(eq(animalGroupsTable.id, animalGroupId))
        .then(r => r[0]);
      if (freshGroup) {
        const clientUpdatedAt = new Date(lastUpdatedAt).getTime();
        const serverUpdatedAt = freshGroup.updatedAt.getTime();
        if (serverUpdatedAt > clientUpdatedAt) {
          throw new Error("concurrent_modification");
        }
      }
    }

    const existingTargetGroups = await tx.select({
      id: animalGroupsTable.id,
      animalNo: animalGroupsTable.animalNo,
      sortOrder: animalGroupsTable.sortOrder,
    })
      .from(animalGroupsTable)
      .where(and(
        eq(animalGroupsTable.kesimAlaniId, targetKesimAlaniId),
        isNull(animalGroupsTable.deletedAt),
      ));

    const nextAnimalNo = (existingTargetGroups.length > 0
      ? Math.max(...existingTargetGroups.map(g => g.animalNo)) + 1
      : 1);
    const nextSortOrder = (existingTargetGroups.length > 0
      ? Math.max(...existingTargetGroups.map(g => g.sortOrder)) + 1
      : 0);

    await tx.update(animalGroupsTable)
      .set({
        kesimAlaniId: targetKesimAlaniId,
        animalNo: nextAnimalNo,
        sortOrder: nextSortOrder,
        updatedAt: new Date(),
      })
      .where(eq(animalGroupsTable.id, animalGroupId));
    newAnimalNo = nextAnimalNo;

    const allTargetGroups = await tx.select({
      id: animalGroupsTable.id,
      animalNo: animalGroupsTable.animalNo,
      sortOrder: animalGroupsTable.sortOrder,
    })
      .from(animalGroupsTable)
      .where(and(
        eq(animalGroupsTable.kesimAlaniId, targetKesimAlaniId),
        isNull(animalGroupsTable.deletedAt),
      ));

    const sorted = allTargetGroups.sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < sorted.length; i++) {
      const expectedNo = i + 1;
      if (sorted[i].animalNo !== expectedNo) {
        await tx.update(animalGroupsTable)
          .set({ animalNo: expectedNo, updatedAt: new Date() })
          .where(eq(animalGroupsTable.id, sorted[i].id));
        if (sorted[i].id === animalGroupId) {
          newAnimalNo = expectedNo;
        }
      }
    }

    const groupDonationLinks = await tx.select()
      .from(animalGroupDonationsTable)
      .where(eq(animalGroupDonationsTable.groupId, animalGroupId));

    if (groupDonationLinks.length > 0) {
      const donationIds = groupDonationLinks.map(l => l.donationId);

      const existingTargetDonations = await tx.select({ id: donationsTable.id })
        .from(donationsTable)
        .where(and(eq(donationsTable.kesimAlaniId, targetKesimAlaniId), isNull(donationsTable.deletedAt)));
      const maxDonationSort = existingTargetDonations.length;

      for (let i = 0; i < donationIds.length; i++) {
        await tx.update(donationsTable)
          .set({
            kesimAlaniId: targetKesimAlaniId,
            sortOrder: maxDonationSort + i,
            updatedAt: new Date(),
          })
          .where(eq(donationsTable.id, donationIds[i]));
      }
    }

    await tx.update(trackingNotesTable)
      .set({
        kesimAlaniId: targetKesimAlaniId,
        updatedAt: new Date(),
      })
      .where(eq(trackingNotesTable.animalGroupId, animalGroupId));

    const sourceGroups = await tx.select({
      id: animalGroupsTable.id,
      animalNo: animalGroupsTable.animalNo,
      sortOrder: animalGroupsTable.sortOrder,
    })
      .from(animalGroupsTable)
      .where(and(
        eq(animalGroupsTable.kesimAlaniId, sourceKesimAlaniId),
        isNull(animalGroupsTable.deletedAt),
      ));
    const sourceSorted = sourceGroups.sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < sourceSorted.length; i++) {
      const expectedNo = i + 1;
      if (sourceSorted[i].animalNo !== expectedNo) {
        await tx.update(animalGroupsTable)
          .set({ animalNo: expectedNo, updatedAt: new Date() })
          .where(eq(animalGroupsTable.id, sourceSorted[i].id));
      }
    }
  }, { isolationLevel: "repeatable read" }), "moveAnimalGroup").catch((err) => {
    if (err.message === "concurrent_modification") {
      throw err;
    }
    throw err;
  });

  return serviceOk({ animalGroupId, newAnimalNo });
}
