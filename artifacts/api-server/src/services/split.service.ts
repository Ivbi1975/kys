import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  animalGroupDonationsTable,
  animalGroupsTable,
} from "@workspace/db/schema";
import { eq, isNull, and, inArray } from "drizzle-orm";
import crypto from "crypto";
import { serviceError, serviceOk } from "./result";
import { getFullKesimAlani, invalidateKACache } from "./kesim-alani.service";
import { BATCH_SIZE } from "../lib/constants";

interface SplitTarget {
  name: string;
  kesimListeId: string;
  hayvanSayisi: number;
}

interface DonationRow {
  id: string;
  shareCount: number;
  description: string | null;
  excluded: boolean | null;
  sortOrder: number;
}

function computeEffectiveShares(activeDonations: DonationRow[]): Map<string, number> {
  const descCount = new Map<string, number>();
  for (const d of activeDonations) {
    const key = (d.description || "").trim().toLowerCase();
    if (key) {
      descCount.set(key, (descCount.get(key) || 0) + 1);
    }
  }
  const result = new Map<string, number>();
  for (const d of activeDonations) {
    const key = (d.description || "").trim().toLowerCase();
    const count = descCount.get(key) || 1;
    result.set(d.id, count > 1 ? count : d.shareCount);
  }
  return result;
}

function getTotalShares(donations: DonationRow[]): number {
  const activeDonations = donations.filter(d => !d.excluded);
  const effectiveShares = computeEffectiveShares(activeDonations);
  const descProcessed = new Set<string>();
  let total = 0;
  for (const d of activeDonations) {
    const key = (d.description || "").trim().toLowerCase();
    if (key && descProcessed.has(key)) continue;
    descProcessed.add(key);
    total += effectiveShares.get(d.id) || 1;
  }
  return total;
}

function getRequiredAnimals(donations: DonationRow[]): number {
  return Math.ceil(getTotalShares(donations) / 7);
}

export async function splitKesimAlani(parentId: string, targets: SplitTarget[]) {
  const [parentKA] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.id, parentId));

  if (!parentKA || parentKA.deletedAt) {
    return serviceError("not_found", 404);
  }

  if (parentKA.splitStatus === "split") {
    return serviceError("already_split", 400);
  }

  if (parentKA.parentKesimAlaniId) {
    return serviceError("is_child", 400);
  }

  const donations = await db.select()
    .from(donationsTable)
    .where(and(
      eq(donationsTable.kesimAlaniId, parentId),
      isNull(donationsTable.deletedAt),
    ))
    .orderBy(donationsTable.sortOrder);

  const totalAnimals = getRequiredAnimals(donations);

  const requestedAnimals = targets.reduce((sum, t) => sum + t.hayvanSayisi, 0);
  if (requestedAnimals !== totalAnimals) {
    return serviceError("count_mismatch", 400);
  }

  if (targets.length < 2) {
    return serviceError("min_two_targets", 400);
  }

  const allDonationIds = donations.map(d => d.id);
  const activeDonations = donations.filter(d => !d.excluded);
  const excludedDonations = donations.filter(d => d.excluded);

  const childIds: string[] = [];

  await db.transaction(async (tx) => {
    if (allDonationIds.length > 0) {
      for (let i = 0; i < allDonationIds.length; i += BATCH_SIZE) {
        const batch = allDonationIds.slice(i, i + BATCH_SIZE);
        await tx.delete(animalGroupDonationsTable)
          .where(inArray(animalGroupDonationsTable.donationId, batch));
      }
    }

    await tx.delete(animalGroupsTable)
      .where(eq(animalGroupsTable.kesimAlaniId, parentId));

    let donationIdx = 0;

    for (const target of targets) {
      const childId = crypto.randomUUID();
      childIds.push(childId);

      await tx.insert(kesimAlanlariTable).values({
        id: childId,
        name: target.name,
        createdAt: new Date(),
        projectId: parentKA.projectId,
        trackingToken: crypto.randomBytes(16).toString("hex"),
        kesimListeId: target.kesimListeId || null,
        parentKesimAlaniId: parentId,
        splitStatus: "child",
      });

      const targetShares = target.hayvanSayisi * 7;
      let accumulatedShares = 0;
      let sortOrder = 0;

      while (donationIdx < activeDonations.length && accumulatedShares < targetShares) {
        const d = activeDonations[donationIdx];
        await tx.update(donationsTable)
          .set({ kesimAlaniId: childId, sortOrder })
          .where(eq(donationsTable.id, d.id));
        accumulatedShares += d.shareCount;
        donationIdx++;
        sortOrder++;
      }

      const groupRows = [];
      for (let g = 0; g < target.hayvanSayisi; g++) {
        groupRows.push({
          id: crypto.randomUUID(),
          kesimAlaniId: childId,
          animalNo: g + 1,
          colorTag: "",
          locked: false,
          notes: "",
          sortOrder: g,
          kesildi: false,
        });
      }
      if (groupRows.length > 0) {
        for (let i = 0; i < groupRows.length; i += BATCH_SIZE) {
          await tx.insert(animalGroupsTable).values(groupRows.slice(i, i + BATCH_SIZE));
        }
      }
    }

    if (donationIdx < activeDonations.length) {
      const lastChildId = childIds[childIds.length - 1];
      let sortOrder = donationIdx;
      while (donationIdx < activeDonations.length) {
        const d = activeDonations[donationIdx];
        await tx.update(donationsTable)
          .set({ kesimAlaniId: lastChildId, sortOrder })
          .where(eq(donationsTable.id, d.id));
        donationIdx++;
        sortOrder++;
      }
    }

    if (excludedDonations.length > 0) {
      const lastChildId = childIds[childIds.length - 1];
      for (let i = 0; i < excludedDonations.length; i++) {
        const d = excludedDonations[i];
        await tx.update(donationsTable)
          .set({ kesimAlaniId: lastChildId, sortOrder: 9000 + i })
          .where(eq(donationsTable.id, d.id));
      }
    }

    await tx.update(kesimAlanlariTable)
      .set({ splitStatus: "split" })
      .where(eq(kesimAlanlariTable.id, parentId));
  });

  invalidateKACache();

  const childResults = await Promise.all(childIds.map(id => getFullKesimAlani(id)));
  const parentResult = await getFullKesimAlani(parentId);

  return serviceOk({
    parent: parentResult,
    children: childResults,
  });
}
