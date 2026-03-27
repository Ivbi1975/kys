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
import { NoteType, NoteStatus } from "../lib/constants";
import { serviceError, serviceOk } from "./result";

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

  return serviceOk({ count: validIds.length, skipped: donationIds.length - validIds.length });
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
