import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  animalGroupsTable,
  animalGroupDonationsTable,
  donationTagsTable,
} from "@workspace/db/schema";
import { eq, inArray, isNull, and, sql } from "drizzle-orm";
import { BATCH_SIZE, LARGE_BATCH_SIZE, NOTE_WARNING_KEYWORDS } from "../lib/constants";
import { serviceError, serviceOk } from "./result";
import { getFullKesimAlani } from "./kesim-alani.service";

type ConflictDonationRow = {
  id: string; name: string; description: string; donation_type: string;
  share_count: number; vekalet: string; notes: string; phone: string;
  excluded: boolean; kesim_alani_id: string; ka_name: string;
};

type ConflictEntry = {
  donationId: string;
  donationName: string;
  donationDescription: string;
  donationNotes: string;
  kesimAlaniId: string;
  kesimAlaniName: string;
  animalGroupId: string | null;
  animalGroupNo: number | null;
  hasNoteWarning: boolean;
  siblingsInGroup: Array<{
    donationId: string;
    donationName: string;
    donationDescription: string;
    donationNotes: string;
    donationType: string;
    shareCount: number;
    vekalet: string;
  }>;
};

type Conflict = {
  key: string;
  matchField: "name" | "description";
  displayName: string;
  entries: ConflictEntry[];
  kesimAlanCount: number;
  totalEntries: number;
  hasNoteWarnings: boolean;
};

function hasNoteWarning(notes: string): boolean {
  if (!notes) return false;
  const lower = notes.toLowerCase();
  return NOTE_WARNING_KEYWORDS.some(kw => lower.includes(kw));
}

export async function detectConflicts(projectId?: string) {
  const projectClauseRaw = projectId ? sql`AND project_id = ${projectId}` : sql``;
  const projectClauseKA = projectId ? sql`AND ka.project_id = ${projectId}` : sql``;

  const conflictKeysResult = await db.execute(sql`
    WITH active_ka AS (
      SELECT id FROM kesim_alanlari WHERE deleted_at IS NULL AND name != '__havuz__' ${projectClauseRaw}
    ),
    active_donations AS (
      SELECT
        id, kesim_alani_id,
        LOWER(TRIM(name)) AS norm_name,
        LOWER(TRIM(description)) AS norm_desc
      FROM donations
      WHERE deleted_at IS NULL AND kesim_alani_id IN (SELECT id FROM active_ka)
    ),
    name_conflicts AS (
      SELECT norm_name AS conflict_key, 'name' AS match_field
      FROM active_donations
      WHERE norm_name <> ''
      GROUP BY norm_name
      HAVING COUNT(DISTINCT kesim_alani_id) > 1
    ),
    desc_conflicts AS (
      SELECT norm_desc AS conflict_key, 'description' AS match_field
      FROM active_donations
      WHERE norm_desc <> ''
        AND norm_desc NOT IN (SELECT conflict_key FROM name_conflicts)
      GROUP BY norm_desc
      HAVING COUNT(DISTINCT kesim_alani_id) > 1
    )
    SELECT conflict_key, match_field FROM name_conflicts
    UNION ALL
    SELECT conflict_key, match_field FROM desc_conflicts
  `);

  const conflictKeys = conflictKeysResult.rows as { conflict_key: string; match_field: "name" | "description" }[];

  if (conflictKeys.length === 0) {
    return serviceOk({ conflicts: [] as Conflict[], totalConflicts: 0 });
  }

  const nameKeys = conflictKeys.filter(c => c.match_field === "name").map(c => c.conflict_key);
  const descKeys = conflictKeys.filter(c => c.match_field === "description").map(c => c.conflict_key);

  const donationsResult = await db.execute(sql`
    SELECT d.id, d.name, d.description, d.donation_type, d.share_count,
           d.vekalet, d.notes, d.phone, d.excluded, d.kesim_alani_id,
           ka.name AS ka_name
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id AND ka.deleted_at IS NULL AND ka.name != '__havuz__' ${projectClauseKA}
    WHERE d.deleted_at IS NULL
      AND (
        (${nameKeys.length > 0 ? sql`LOWER(TRIM(d.name)) IN (${sql.join(nameKeys.map(k => sql`${k}`), sql`, `)})` : sql`FALSE`})
        OR
        (${descKeys.length > 0 ? sql`LOWER(TRIM(d.description)) IN (${sql.join(descKeys.map(k => sql`${k}`), sql`, `)})` : sql`FALSE`})
      )
  `);

  const conflictDonations = donationsResult.rows as ConflictDonationRow[];
  const donationIds = conflictDonations.map(d => d.id);

  const groupLinksMap: Record<string, { groupId: string; animalNo: number }[]> = {};
  const donationsByGroupId: Record<string, string[]> = {};
  const donationById: Record<string, ConflictDonationRow> = {};

  for (const d of conflictDonations) {
    donationById[d.id] = d;
  }

  if (donationIds.length > 0) {
    const allLinks: { donation_id: string; group_id: string; animal_no: number }[] = [];
    for (let i = 0; i < donationIds.length; i += LARGE_BATCH_SIZE) {
      const batch = donationIds.slice(i, i + LARGE_BATCH_SIZE);
      const linksResult = await db.execute(sql`
        SELECT agd.donation_id, agd.group_id, ag.animal_no
        FROM animal_group_donations agd
        JOIN animal_groups ag ON ag.id = agd.group_id
        WHERE agd.donation_id IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})
      `);
      allLinks.push(...(linksResult.rows as typeof allLinks));
    }

    for (const link of allLinks) {
      if (!groupLinksMap[link.donation_id]) groupLinksMap[link.donation_id] = [];
      groupLinksMap[link.donation_id].push({ groupId: link.group_id, animalNo: link.animal_no });
    }

    const affectedGroupIds = [...new Set(allLinks.map(l => l.group_id))];
    if (affectedGroupIds.length > 0) {
      const groupMembersResult = await db.execute(sql`
        SELECT agd.donation_id, agd.group_id, d.id, d.name, d.description, d.donation_type,
               d.share_count, d.vekalet, d.notes, d.phone, d.excluded, d.kesim_alani_id
        FROM animal_group_donations agd
        JOIN donations d ON d.id = agd.donation_id AND d.deleted_at IS NULL
        WHERE agd.group_id IN (${sql.join(affectedGroupIds.map(id => sql`${id}`), sql`, `)})
      `);
      for (const row of groupMembersResult.rows as ConflictDonationRow[]) {
        if (!donationById[row.id]) {
          donationById[row.id] = row;
        }
        const groupId = (row as unknown as { group_id: string }).group_id;
        if (!donationsByGroupId[groupId]) donationsByGroupId[groupId] = [];
        donationsByGroupId[groupId].push(row.id);
      }
    }
  }

  const ungroupedConflictKAIds = [...new Set(
    conflictDonations
      .filter(d => !(groupLinksMap[d.id]?.length))
      .map(d => d.kesim_alani_id)
  )];
  const donationsByKA: Record<string, ConflictDonationRow[]> = {};
  if (ungroupedConflictKAIds.length > 0) {
    const kaSiblingsResult = await db.execute(sql`
      SELECT d.id, d.name, d.description, d.donation_type, d.share_count,
             d.vekalet, d.notes, d.phone, d.excluded, d.kesim_alani_id,
             ka.name AS ka_name
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE d.deleted_at IS NULL
        AND d.kesim_alani_id IN (${sql.join(ungroupedConflictKAIds.map(id => sql`${id}`), sql`, `)})
      ORDER BY d.sort_order ASC
    `);
    for (const row of kaSiblingsResult.rows as ConflictDonationRow[]) {
      if (!donationsByKA[row.kesim_alani_id]) donationsByKA[row.kesim_alani_id] = [];
      donationsByKA[row.kesim_alani_id].push(row);
      if (!donationById[row.id]) donationById[row.id] = row;
    }
  }

  function buildConflictEntries(donations: ConflictDonationRow[]): ConflictEntry[] {
    const entries: ConflictEntry[] = [];
    for (const d of donations) {
      const groups = groupLinksMap[d.id] || [];
      if (groups.length === 0) {
        const kaSiblings = donationsByKA[d.kesim_alani_id] || [];
        const siblings = [];
        for (const od of kaSiblings) {
          if (od.id === d.id) continue;
          siblings.push({
            donationId: od.id,
            donationName: od.name,
            donationDescription: od.description,
            donationNotes: od.notes,
            donationType: od.donation_type,
            shareCount: od.share_count,
            vekalet: od.vekalet,
          });
          if (siblings.length >= 5) break;
        }
        entries.push({
          donationId: d.id,
          donationName: d.name,
          donationDescription: d.description,
          donationNotes: d.notes,
          kesimAlaniId: d.kesim_alani_id,
          kesimAlaniName: d.ka_name || d.kesim_alani_id,
          animalGroupId: null,
          animalGroupNo: null,
          hasNoteWarning: hasNoteWarning(d.notes),
          siblingsInGroup: siblings,
        });
      } else {
        for (const g of groups) {
          const siblingDonationIds = donationsByGroupId[g.groupId] || [];
          const siblings = siblingDonationIds
            .filter(sid => sid !== d.id)
            .map(sid => donationById[sid])
            .filter(Boolean)
            .map(od => ({
              donationId: od.id,
              donationName: od.name,
              donationDescription: od.description,
              donationNotes: od.notes,
              donationType: od.donation_type,
              shareCount: od.share_count,
              vekalet: od.vekalet,
            }));
          entries.push({
            donationId: d.id,
            donationName: d.name,
            donationDescription: d.description,
            donationNotes: d.notes,
            kesimAlaniId: d.kesim_alani_id,
            kesimAlaniName: d.ka_name || d.kesim_alani_id,
            animalGroupId: g.groupId,
            animalGroupNo: g.animalNo,
            hasNoteWarning: hasNoteWarning(d.notes),
            siblingsInGroup: siblings,
          });
        }
      }
    }
    return entries;
  }

  const groupedByName: Record<string, { displayName: string; donations: ConflictDonationRow[] }> = {};
  const groupedByDesc: Record<string, { displayName: string; donations: ConflictDonationRow[] }> = {};

  for (const d of conflictDonations) {
    const nk = (d.name || "").trim().toLowerCase();
    if (nk && nameKeys.includes(nk)) {
      if (!groupedByName[nk]) groupedByName[nk] = { displayName: d.name, donations: [] };
      groupedByName[nk].donations.push(d);
    }
    const dk = (d.description || "").trim().toLowerCase();
    if (dk && descKeys.includes(dk)) {
      if (!groupedByDesc[dk]) groupedByDesc[dk] = { displayName: d.description, donations: [] };
      groupedByDesc[dk].donations.push(d);
    }
  }

  const conflicts: Conflict[] = [];

  for (const [key, { displayName, donations }] of Object.entries(groupedByName)) {
    const uniqueKA = new Set(donations.map(d => d.kesim_alani_id));
    const entries = buildConflictEntries(donations);
    conflicts.push({
      key,
      matchField: "name",
      displayName,
      entries,
      kesimAlanCount: uniqueKA.size,
      totalEntries: entries.length,
      hasNoteWarnings: entries.some(e => e.hasNoteWarning),
    });
  }

  for (const [key, { displayName, donations }] of Object.entries(groupedByDesc)) {
    const uniqueKA = new Set(donations.map(d => d.kesim_alani_id));
    const entries = buildConflictEntries(donations);
    conflicts.push({
      key: `desc:${key}`,
      matchField: "description",
      displayName,
      entries,
      kesimAlanCount: uniqueKA.size,
      totalEntries: entries.length,
      hasNoteWarnings: entries.some(e => e.hasNoteWarning),
    });
  }

  conflicts.sort((a, b) => {
    if (b.kesimAlanCount !== a.kesimAlanCount) return b.kesimAlanCount - a.kesimAlanCount;
    if (b.hasNoteWarnings !== a.hasNoteWarnings) return b.hasNoteWarnings ? 1 : -1;
    return b.totalEntries - a.totalEntries;
  });

  return serviceOk({ conflicts, totalConflicts: conflicts.length });
}

interface TransferParams {
  donationId: string;
  sourceKesimAlaniId: string;
  targetKesimAlaniId: string;
  transferAnimal: boolean;
  animalGroupId?: string;
}

export async function transferConflictDonation(params: TransferParams) {
  const { donationId, sourceKesimAlaniId, targetKesimAlaniId, transferAnimal, animalGroupId } = params;

  const [sourceKA, targetKA] = await Promise.all([
    db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, sourceKesimAlaniId)),
    db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, targetKesimAlaniId)),
  ]);

  if (!sourceKA[0] || sourceKA[0].deletedAt) {
    return serviceError("Kaynak kesim alanı bulunamadı veya silinmiş", 404);
  }
  if (!targetKA[0] || targetKA[0].deletedAt) {
    return serviceError("Hedef kesim alanı bulunamadı veya silinmiş", 404);
  }

  const [donation] = await db.select().from(donationsTable).where(eq(donationsTable.id, donationId));
  if (!donation || donation.kesimAlaniId !== sourceKesimAlaniId) {
    return serviceError("Bağışçı kaynak kesim alanında bulunamadı", 404);
  }

  await db.transaction(async (tx) => {
    if (transferAnimal && animalGroupId) {
      const [group] = await tx.select().from(animalGroupsTable).where(eq(animalGroupsTable.id, animalGroupId));
      if (!group || group.kesimAlaniId !== sourceKesimAlaniId) {
        throw new Error("Hayvan grubu bulunamadı veya kaynak kesim alanına ait değil");
      }

      const links = await tx.select().from(animalGroupDonationsTable)
        .where(eq(animalGroupDonationsTable.groupId, animalGroupId));
      const donationIdsInGroup = links.map(l => l.donationId);

      const donationsInGroup = donationIdsInGroup.length > 0
        ? await tx.select().from(donationsTable)
            .where(inArray(donationsTable.id, donationIdsInGroup))
        : [];

      const existingTargetDonations = await tx.select().from(donationsTable)
        .where(and(eq(donationsTable.kesimAlaniId, targetKesimAlaniId), isNull(donationsTable.deletedAt)));
      const existingTargetGroups = await tx.select().from(animalGroupsTable)
        .where(eq(animalGroupsTable.kesimAlaniId, targetKesimAlaniId));

      const donationSortBase = existingTargetDonations.length;
      const groupSortBase = existingTargetGroups.length;

      await tx.delete(animalGroupDonationsTable).where(eq(animalGroupDonationsTable.groupId, animalGroupId));

      const allTagRows = donationIdsInGroup.length > 0
        ? await tx.select().from(donationTagsTable)
            .where(inArray(donationTagsTable.donationId, donationIdsInGroup))
        : [];

      if (donationIdsInGroup.length > 0) {
        await tx.delete(donationTagsTable)
          .where(inArray(donationTagsTable.donationId, donationIdsInGroup));
      }

      for (let i = 0; i < donationsInGroup.length; i++) {
        const d = donationsInGroup[i];
        await tx.update(donationsTable)
          .set({ kesimAlaniId: targetKesimAlaniId, sortOrder: donationSortBase + i })
          .where(eq(donationsTable.id, d.id));
      }

      if (allTagRows.length > 0) {
        const tagValues = allTagRows.map(t => ({ donationId: t.donationId, tagId: t.tagId }));
        for (let c = 0; c < tagValues.length; c += BATCH_SIZE) {
          await tx.insert(donationTagsTable)
            .values(tagValues.slice(c, c + BATCH_SIZE))
            .onConflictDoNothing();
        }
      }

      await tx.update(animalGroupsTable)
        .set({ kesimAlaniId: targetKesimAlaniId, sortOrder: groupSortBase })
        .where(eq(animalGroupsTable.id, animalGroupId));

      if (donationIdsInGroup.length > 0) {
        const groupLinkValues = donationIdsInGroup.map((did, i) => ({ groupId: animalGroupId, donationId: did, sortOrder: i }));
        for (let c = 0; c < groupLinkValues.length; c += BATCH_SIZE) {
          await tx.insert(animalGroupDonationsTable)
            .values(groupLinkValues.slice(c, c + BATCH_SIZE))
            .onConflictDoNothing();
        }
      }

    } else {
      const existingTargetDonations = await tx.select().from(donationsTable)
        .where(and(eq(donationsTable.kesimAlaniId, targetKesimAlaniId), isNull(donationsTable.deletedAt)));
      const newSortOrder = existingTargetDonations.length;

      await tx.delete(animalGroupDonationsTable)
        .where(eq(animalGroupDonationsTable.donationId, donationId));

      await tx.update(donationsTable)
        .set({ kesimAlaniId: targetKesimAlaniId, sortOrder: newSortOrder })
        .where(eq(donationsTable.id, donationId));
    }
  });

  const [updatedSource, updatedTarget] = await Promise.all([
    getFullKesimAlani(sourceKesimAlaniId),
    getFullKesimAlani(targetKesimAlaniId),
  ]);

  return serviceOk({ source: updatedSource, target: updatedTarget });
}
