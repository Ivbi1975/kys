import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  donationTagsTable,
  animalGroupsTable,
  animalGroupDonationsTable,
  notificationLogsTable,
  appSettingsTable,
  teamsTable,
  type DonationRow,
  type AnimalGroupRow,
  type KesimAlaniRow,
  type TeamRow,
} from "@workspace/db/schema";
import { eq, inArray, isNull, and, sql } from "drizzle-orm";
import { cacheGet, cacheSet, cacheInvalidatePrefix } from "../lib/cache";
import { BATCH_SIZE } from "../lib/constants";

export const KA_LIST_CACHE_KEY = "kesim-alanlari:list";
export const KA_LIST_TTL = 15_000;

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface DonationPayload {
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

export interface AnimalGroupPayload {
  id: string;
  animalNo?: number;
  colorTag?: string;
  locked?: boolean;
  notes?: string;
  donations?: DonationPayload[];
}

export interface DonationOutput {
  id: string;
  name: string;
  description: string;
  donationType: string;
  shareCount: number;
  vekalet: string;
  notes: string;
  phone: string;
  excluded: boolean;
  tags: string[];
  aiCategories: string[];
  aiWarnings: string;
}

export async function requireActiveKesimAlani(id: string) {
  const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
  if (!existing) return { error: "Kesim alanı bulunamadı", status: 404 as const };
  if (existing.deletedAt) return { error: "Silinmiş bir kesim alanı üzerinde işlem yapılamaz. Önce geri yükleyin.", status: 400 as const };
  return { existing, error: null, status: 200 as const };
}

export function assembleKesimAlani(
  ka: KesimAlaniRow,
  donations: DonationRow[],
  groups: AnimalGroupRow[],
  tagsByDonation: Record<string, string[]>,
  groupDonationLinks: { groupId: string; donationId: string; sortOrder: number }[],
  teams: TeamRow[],
) {
  const donationsById: Record<string, DonationOutput> = {};
  for (const d of donations) {
    donationsById[d.id] = {
      id: d.id,
      name: d.name,
      description: d.description,
      donationType: d.donationType,
      shareCount: d.shareCount,
      vekalet: d.vekalet,
      notes: d.notes,
      phone: d.phone || "",
      excluded: d.excluded,
      tags: tagsByDonation[d.id] || [],
      aiCategories: d.aiCategories ? JSON.parse(d.aiCategories) : [],
      aiWarnings: d.aiWarnings || "",
    };
  }

  const groupDonationsByGroup: Record<string, { donationId: string; sortOrder: number }[]> = {};
  for (const link of groupDonationLinks) {
    if (!groupDonationsByGroup[link.groupId]) groupDonationsByGroup[link.groupId] = [];
    groupDonationsByGroup[link.groupId].push(link);
  }

  const mappedDonations = donations.map(d => donationsById[d.id]);

  const mappedGroups = groups.map(g => {
    const links = (groupDonationsByGroup[g.id] || []).sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: g.id,
      animalNo: g.animalNo,
      colorTag: g.colorTag,
      locked: g.locked,
      notes: g.notes,
      kesildi: g.kesildi,
      kesildiAt: g.kesildiAt || null,
      teamId: g.teamId || null,
      donations: links.map(l => donationsById[l.donationId]).filter(Boolean),
    };
  });

  return {
    id: ka.id,
    name: ka.name,
    createdAt: ka.createdAt,
    deletedAt: ka.deletedAt || null,
    projectId: ka.projectId || null,
    trackingToken: ka.trackingToken || null,
    kesimListeId: ka.kesimListeId || null,
    donations: mappedDonations,
    animalGroups: mappedGroups,
    teams: teams.map(t => ({ id: t.id, name: t.name, color: t.color })),
  };
}

export async function getFullKesimAlaniList(kaRows: KesimAlaniRow[]) {
  if (kaRows.length === 0) return [];
  const kaIds = kaRows.map(k => k.id);

  const result = await db.execute(sql`
    SELECT
      ka.id AS ka_id,
      COALESCE((
        SELECT json_agg(d ORDER BY d.sort_order)
        FROM (
          SELECT
            don.id, don.name, don.description, don.donation_type,
            don.share_count, don.vekalet, don.notes, don.phone,
            don.excluded, don.sort_order, don.ai_categories, don.ai_warnings,
            COALESCE((
              SELECT json_agg(dt.tag_id)
              FROM donation_tags dt WHERE dt.donation_id = don.id
            ), '[]'::json) AS tags
          FROM donations don
          WHERE don.kesim_alani_id = ka.id AND don.deleted_at IS NULL
        ) d
      ), '[]'::json) AS donations,
      COALESCE((
        SELECT json_agg(g ORDER BY g.sort_order)
        FROM (
          SELECT
            ag.id, ag.animal_no, ag.color_tag, ag.locked, ag.notes,
            ag.kesildi, ag.kesildi_at, ag.team_id, ag.sort_order,
            COALESCE((
              SELECT json_agg(
                json_build_object('donationId', agd.donation_id, 'sortOrder', agd.sort_order)
                ORDER BY agd.sort_order
              )
              FROM animal_group_donations agd WHERE agd.group_id = ag.id
            ), '[]'::json) AS donation_links
          FROM animal_groups ag
          WHERE ag.kesim_alani_id = ka.id
        ) g
      ), '[]'::json) AS groups,
      COALESCE((
        SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
        FROM teams t WHERE t.kesim_alani_id = ka.id
      ), '[]'::json) AS teams
    FROM kesim_alanlari ka
    WHERE ka.id IN (${sql.join(kaIds.map(id => sql`${id}`), sql`, `)})
  `);

  const kaMap = new Map(kaRows.map(k => [k.id, k]));
  const donationsMap: Record<string, DonationRow[]> = {};
  for (const row of kaRows) {
    donationsMap[row.id] = [];
  }

  type RawRow = {
    ka_id: string;
    donations: { id: string; name: string; description: string; donation_type: string; share_count: number; vekalet: string; notes: string; phone: string; excluded: boolean; sort_order: number; ai_categories: string | null; ai_warnings: string | null; tags: string[] }[];
    groups: { id: string; animal_no: number; color_tag: string; locked: boolean; notes: string; kesildi: boolean; kesildi_at: string | null; team_id: string | null; sort_order: number; donation_links: { donationId: string; sortOrder: number }[] }[];
    teams: { id: string; name: string; color: string }[];
  };

  const assembled = new Map<string, ReturnType<typeof assembleKesimAlani>>();

  for (const rawRow of result.rows as RawRow[]) {
    const ka = kaMap.get(rawRow.ka_id);
    if (!ka) continue;

    const tagsByDonation: Record<string, string[]> = {};
    const donations: DonationRow[] = [];
    for (const d of rawRow.donations || []) {
      tagsByDonation[d.id] = d.tags || [];
      donations.push({
        id: d.id,
        kesimAlaniId: rawRow.ka_id,
        name: d.name,
        description: d.description,
        donationType: d.donation_type,
        shareCount: d.share_count,
        vekalet: d.vekalet,
        notes: d.notes,
        phone: d.phone || "",
        excluded: d.excluded,
        sortOrder: d.sort_order,
        deletedAt: null,
        updatedAt: new Date(),
        aiCategories: d.ai_categories,
        aiWarnings: d.ai_warnings,
      });
    }

    const groups: AnimalGroupRow[] = [];
    const groupLinks: { groupId: string; donationId: string; sortOrder: number }[] = [];
    for (const g of rawRow.groups || []) {
      groups.push({
        id: g.id,
        kesimAlaniId: rawRow.ka_id,
        animalNo: g.animal_no,
        colorTag: g.color_tag,
        locked: g.locked,
        notes: g.notes,
        kesildi: g.kesildi,
        kesildiAt: g.kesildi_at ? new Date(g.kesildi_at) : null,
        teamId: g.team_id,
        sortOrder: g.sort_order,
        deletedAt: null,
        updatedAt: new Date(),
      });
      for (const link of g.donation_links || []) {
        groupLinks.push({ groupId: g.id, donationId: link.donationId, sortOrder: link.sortOrder });
      }
    }

    const teams: TeamRow[] = (rawRow.teams || []).map(t => ({
      id: t.id,
      kesimAlaniId: rawRow.ka_id,
      name: t.name,
      color: t.color,
      updatedAt: new Date(),
    }));

    assembled.set(rawRow.ka_id, assembleKesimAlani(ka, donations, groups, tagsByDonation, groupLinks, teams));
  }

  return kaRows.map(ka => assembled.get(ka.id)!).filter(Boolean);
}

export async function getFullKesimAlani(id: string) {
  const result = await db.execute(sql`
    SELECT
      ka.id AS ka_id, ka.name, ka.created_at, ka.deleted_at,
      ka.project_id, ka.tracking_token, ka.kesim_liste_id,
      COALESCE((
        SELECT json_agg(d ORDER BY d.sort_order)
        FROM (
          SELECT
            don.id, don.name, don.description, don.donation_type,
            don.share_count, don.vekalet, don.notes, don.phone,
            don.excluded, don.sort_order, don.ai_categories, don.ai_warnings,
            COALESCE((
              SELECT json_agg(dt.tag_id)
              FROM donation_tags dt WHERE dt.donation_id = don.id
            ), '[]'::json) AS tags
          FROM donations don
          WHERE don.kesim_alani_id = ka.id AND don.deleted_at IS NULL
        ) d
      ), '[]'::json) AS donations,
      COALESCE((
        SELECT json_agg(g ORDER BY g.sort_order)
        FROM (
          SELECT
            ag.id, ag.animal_no, ag.color_tag, ag.locked, ag.notes,
            ag.kesildi, ag.kesildi_at, ag.team_id, ag.sort_order,
            COALESCE((
              SELECT json_agg(
                json_build_object('donationId', agd.donation_id, 'sortOrder', agd.sort_order)
                ORDER BY agd.sort_order
              )
              FROM animal_group_donations agd WHERE agd.group_id = ag.id
            ), '[]'::json) AS donation_links
          FROM animal_groups ag
          WHERE ag.kesim_alani_id = ka.id
        ) g
      ), '[]'::json) AS groups,
      COALESCE((
        SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
        FROM teams t WHERE t.kesim_alani_id = ka.id
      ), '[]'::json) AS teams
    FROM kesim_alanlari ka
    WHERE ka.id = ${id}
  `);

  if (result.rows.length === 0) return null;

  type SingleRawDonation = { id: string; name: string; description: string; donation_type: string; share_count: number; vekalet: string; notes: string; phone: string; excluded: boolean; sort_order: number; ai_categories: string | null; ai_warnings: string | null; tags: string[] };
  type SingleRawGroup = { id: string; animal_no: number; color_tag: string; locked: boolean; notes: string; kesildi: boolean; kesildi_at: string | null; team_id: string | null; sort_order: number; donation_links: { donationId: string; sortOrder: number }[] };
  type SingleRawTeam = { id: string; name: string; color: string };
  type SingleRawRow = {
    ka_id: string; name: string; created_at: string; deleted_at: string | null;
    project_id: string | null; tracking_token: string | null; kesim_liste_id: string | null;
    donations: SingleRawDonation[];
    groups: SingleRawGroup[];
    teams: SingleRawTeam[];
  };

  const rawRow = result.rows[0] as SingleRawRow;
  const ka: KesimAlaniRow = {
    id: rawRow.ka_id,
    name: rawRow.name,
    createdAt: new Date(rawRow.created_at),
    deletedAt: rawRow.deleted_at ? new Date(rawRow.deleted_at) : null,
    updatedAt: new Date(),
    projectId: rawRow.project_id,
    trackingToken: rawRow.tracking_token,
    kesimListeId: rawRow.kesim_liste_id,
  };

  const tagsByDonation: Record<string, string[]> = {};
  const donations: DonationRow[] = [];
  for (const d of rawRow.donations || []) {
    tagsByDonation[d.id] = d.tags || [];
    donations.push({
      id: d.id,
      kesimAlaniId: rawRow.ka_id,
      name: d.name,
      description: d.description,
      donationType: d.donation_type,
      shareCount: d.share_count,
      vekalet: d.vekalet,
      notes: d.notes,
      phone: d.phone || "",
      excluded: d.excluded,
      sortOrder: d.sort_order,
      deletedAt: null,
      updatedAt: new Date(),
      aiCategories: d.ai_categories,
      aiWarnings: d.ai_warnings,
    });
  }

  const groups: AnimalGroupRow[] = [];
  const groupLinks: { groupId: string; donationId: string; sortOrder: number }[] = [];
  for (const g of rawRow.groups || []) {
    groups.push({
      id: g.id,
      kesimAlaniId: rawRow.ka_id,
      animalNo: g.animal_no,
      colorTag: g.color_tag,
      locked: g.locked,
      notes: g.notes,
      kesildi: g.kesildi,
      kesildiAt: g.kesildi_at ? new Date(g.kesildi_at) : null,
      teamId: g.team_id,
      sortOrder: g.sort_order,
      deletedAt: null,
      updatedAt: new Date(),
    });
    for (const link of g.donation_links || []) {
      groupLinks.push({ groupId: g.id, donationId: link.donationId, sortOrder: link.sortOrder });
    }
  }

  const teams: TeamRow[] = (rawRow.teams || []).map((t: SingleRawTeam) => ({
    id: t.id,
    kesimAlaniId: rawRow.ka_id,
    name: t.name,
    color: t.color,
    updatedAt: new Date(),
  }));

  return assembleKesimAlani(ka, donations, groups, tagsByDonation, groupLinks, teams);
}

export function invalidateKACache() {
  cacheInvalidatePrefix(KA_LIST_CACHE_KEY);
}

export function getCachedKAList(includeDeleted: boolean) {
  const cacheKey = includeDeleted ? KA_LIST_CACHE_KEY + ":all" : KA_LIST_CACHE_KEY;
  return { cached: cacheGet<unknown[]>(cacheKey), cacheKey };
}

export function setCachedKAList(cacheKey: string, data: unknown[]) {
  cacheSet(cacheKey, data, KA_LIST_TTL);
}

export async function saveDonations(tx: Tx, kesimAlaniId: string, donations: DonationPayload[]) {
  if (donations.length === 0) return;

  const donationRows = donations.map((d, i) => ({
    id: d.id,
    kesimAlaniId,
    name: d.name || "",
    description: d.description || "",
    donationType: d.donationType || "",
    shareCount: d.shareCount || 1,
    vekalet: d.vekalet || "",
    notes: d.notes || "",
    phone: d.phone || "",
    excluded: d.excluded || false,
    sortOrder: i,
  }));

  for (let i = 0; i < donationRows.length; i += BATCH_SIZE) {
    await tx.insert(donationsTable).values(donationRows.slice(i, i + BATCH_SIZE));
  }

  const tagRows: { donationId: string; tagId: string }[] = [];
  for (const d of donations) {
    if (d.tags && d.tags.length > 0) {
      for (const tagId of d.tags) {
        tagRows.push({ donationId: d.id, tagId });
      }
    }
  }
  if (tagRows.length > 0) {
    for (let i = 0; i < tagRows.length; i += BATCH_SIZE) {
      await tx.insert(donationTagsTable).values(tagRows.slice(i, i + BATCH_SIZE)).onConflictDoNothing();
    }
  }
}

export async function saveAnimalGroups(tx: Tx, kesimAlaniId: string, groups: AnimalGroupPayload[], kesildiMap?: Map<string, { kesildi: boolean; kesildiAt: Date | null; teamId: string | null }>) {
  if (groups.length === 0) return;

  const groupRows = groups.map((g, i) => {
    const existing = kesildiMap?.get(g.id);
    return {
      id: g.id,
      kesimAlaniId,
      animalNo: g.animalNo || 0,
      colorTag: g.colorTag || "",
      locked: g.locked || false,
      notes: g.notes || "",
      sortOrder: (g as any).sortOrder ?? i,
      kesildi: existing?.kesildi ?? false,
      kesildiAt: existing?.kesildiAt ?? null,
      teamId: existing?.teamId ?? null,
    };
  });

  for (let i = 0; i < groupRows.length; i += BATCH_SIZE) {
    await tx.insert(animalGroupsTable).values(groupRows.slice(i, i + BATCH_SIZE));
  }

  const allDonationIds = new Set<string>();
  for (const g of groups) {
    if (g.donations) {
      for (const d of g.donations) allDonationIds.add(d.id);
    }
  }

  const existingDonationRows = allDonationIds.size > 0
    ? await tx.select({ id: donationsTable.id }).from(donationsTable).where(
        inArray(donationsTable.id, Array.from(allDonationIds))
      )
    : [];
  const validDonationIds = new Set(existingDonationRows.map(r => r.id));

  const junctionRows: { groupId: string; donationId: string; sortOrder: number }[] = [];
  const seenKeys = new Set<string>();
  for (const g of groups) {
    if (g.donations && g.donations.length > 0) {
      for (let j = 0; j < g.donations.length; j++) {
        const d = g.donations[j];
        if (!validDonationIds.has(d.id)) continue;
        const key = `${g.id}:${d.id}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        junctionRows.push({ groupId: g.id, donationId: d.id, sortOrder: j });
      }
    }
  }
  if (junctionRows.length > 0) {
    for (let i = 0; i < junctionRows.length; i += BATCH_SIZE) {
      await tx.insert(animalGroupDonationsTable).values(junctionRows.slice(i, i + BATCH_SIZE)).onConflictDoNothing();
    }
  }
}

type ExistingDonation = {
  id: string; name: string; description: string; donationType: string;
  shareCount: number; vekalet: string; notes: string; phone: string | null;
  excluded: boolean; sortOrder: number;
};

type ExistingGroup = {
  id: string; animalNo: number; colorTag: string; locked: boolean;
  notes: string; sortOrder: number; kesildi: boolean;
  kesildiAt: Date | null; teamId: string | null;
};

function donationNeedsUpdate(existing: ExistingDonation, incoming: DonationPayload, newSortOrder: number): Record<string, string | number | boolean> | null {
  const updates: Record<string, string | number | boolean> = {};
  if ((incoming.name || "") !== existing.name) updates.name = incoming.name || "";
  if ((incoming.description || "") !== existing.description) updates.description = incoming.description || "";
  if ((incoming.donationType || "") !== existing.donationType) updates.donationType = incoming.donationType || "";
  if ((incoming.shareCount || 1) !== existing.shareCount) updates.shareCount = incoming.shareCount || 1;
  if ((incoming.vekalet || "") !== existing.vekalet) updates.vekalet = incoming.vekalet || "";
  if ((incoming.notes || "") !== existing.notes) updates.notes = incoming.notes || "";
  if ((incoming.phone || "") !== (existing.phone || "")) updates.phone = incoming.phone || "";
  if ((incoming.excluded || false) !== existing.excluded) updates.excluded = incoming.excluded || false;
  if (newSortOrder !== existing.sortOrder) updates.sortOrder = newSortOrder;
  return Object.keys(updates).length > 0 ? updates : null;
}

function groupNeedsUpdate(existing: ExistingGroup, incoming: AnimalGroupPayload, newSortOrder: number): Record<string, string | number | boolean> | null {
  const updates: Record<string, string | number | boolean> = {};
  if ((incoming.animalNo || 0) !== existing.animalNo) updates.animalNo = incoming.animalNo || 0;
  if ((incoming.colorTag || "") !== existing.colorTag) updates.colorTag = incoming.colorTag || "";
  if ((incoming.locked || false) !== existing.locked) updates.locked = incoming.locked || false;
  if ((incoming.notes || "") !== existing.notes) updates.notes = incoming.notes || "";
  if (newSortOrder !== existing.sortOrder) updates.sortOrder = newSortOrder;
  return Object.keys(updates).length > 0 ? updates : null;
}

export async function diffUpdateDonations(tx: Tx, kesimAlaniId: string, incoming: DonationPayload[]) {
  const existingRows = await tx.select({
    id: donationsTable.id,
    name: donationsTable.name,
    description: donationsTable.description,
    donationType: donationsTable.donationType,
    shareCount: donationsTable.shareCount,
    vekalet: donationsTable.vekalet,
    notes: donationsTable.notes,
    phone: donationsTable.phone,
    excluded: donationsTable.excluded,
    sortOrder: donationsTable.sortOrder,
  }).from(donationsTable).where(and(eq(donationsTable.kesimAlaniId, kesimAlaniId), isNull(donationsTable.deletedAt)));

  const existingMap = new Map(existingRows.map(r => [r.id, r]));
  const incomingIds = new Set(incoming.map(d => d.id));

  const toInsert: DonationPayload[] = [];
  const toUpdate: { id: string; updates: Record<string, string | number | boolean> }[] = [];
  const toDeleteIds: string[] = [];

  for (let i = 0; i < incoming.length; i++) {
    const d = incoming[i];
    const existing = existingMap.get(d.id);
    if (!existing) {
      toInsert.push(d);
    } else {
      const updates = donationNeedsUpdate(existing, d, i);
      if (updates) {
        toUpdate.push({ id: d.id, updates });
      }
    }
  }

  for (const existing of existingRows) {
    if (!incomingIds.has(existing.id)) {
      toDeleteIds.push(existing.id);
    }
  }

  if (toDeleteIds.length > 0) {
    for (let i = 0; i < toDeleteIds.length; i += BATCH_SIZE) {
      const batch = toDeleteIds.slice(i, i + BATCH_SIZE);
      await tx.delete(donationTagsTable).where(inArray(donationTagsTable.donationId, batch));
      await tx.delete(donationsTable).where(inArray(donationsTable.id, batch));
    }
  }

  if (toInsert.length > 0) {
    const insertIdx = incoming.reduce((acc, d, i) => { acc.set(d.id, i); return acc; }, new Map<string, number>());
    const insertRows = toInsert.map(d => ({
      id: d.id,
      kesimAlaniId,
      name: d.name || "",
      description: d.description || "",
      donationType: d.donationType || "",
      shareCount: d.shareCount || 1,
      vekalet: d.vekalet || "",
      notes: d.notes || "",
      phone: d.phone || "",
      excluded: d.excluded || false,
      sortOrder: insertIdx.get(d.id) ?? 0,
    }));
    for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
      await tx.insert(donationsTable).values(insertRows.slice(i, i + BATCH_SIZE));
    }

    const tagRows: { donationId: string; tagId: string }[] = [];
    for (const d of toInsert) {
      if (d.tags && d.tags.length > 0) {
        for (const tagId of d.tags) {
          tagRows.push({ donationId: d.id, tagId });
        }
      }
    }
    if (tagRows.length > 0) {
      for (let i = 0; i < tagRows.length; i += BATCH_SIZE) {
        await tx.insert(donationTagsTable).values(tagRows.slice(i, i + BATCH_SIZE)).onConflictDoNothing();
      }
    }
  }

  for (const { id, updates } of toUpdate) {
    await tx.update(donationsTable).set(updates).where(eq(donationsTable.id, id));
  }

  for (const d of incoming) {
    if (d.tags !== undefined && existingMap.has(d.id)) {
      await tx.delete(donationTagsTable).where(eq(donationTagsTable.donationId, d.id));
      if (d.tags.length > 0) {
        await tx.insert(donationTagsTable)
          .values(d.tags.map(tagId => ({ donationId: d.id, tagId })))
          .onConflictDoNothing();
      }
    }
  }
}

export async function diffUpdateGroups(tx: Tx, kesimAlaniId: string, incoming: AnimalGroupPayload[]) {
  const existingRows = await tx.select({
    id: animalGroupsTable.id,
    animalNo: animalGroupsTable.animalNo,
    colorTag: animalGroupsTable.colorTag,
    locked: animalGroupsTable.locked,
    notes: animalGroupsTable.notes,
    sortOrder: animalGroupsTable.sortOrder,
    kesildi: animalGroupsTable.kesildi,
    kesildiAt: animalGroupsTable.kesildiAt,
    teamId: animalGroupsTable.teamId,
  }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId));

  const existingMap = new Map(existingRows.map(r => [r.id, r]));
  const incomingIds = new Set(incoming.map(g => g.id));

  const toInsert: AnimalGroupPayload[] = [];
  const toUpdate: { id: string; updates: Record<string, string | number | boolean> }[] = [];
  const toDeleteIds: string[] = [];

  for (let i = 0; i < incoming.length; i++) {
    const g = incoming[i];
    const existing = existingMap.get(g.id);
    if (!existing) {
      toInsert.push(g);
    } else {
      const updates = groupNeedsUpdate(existing, g, i);
      if (updates) {
        toUpdate.push({ id: g.id, updates });
      }
    }
  }

  for (const existing of existingRows) {
    if (!incomingIds.has(existing.id)) {
      toDeleteIds.push(existing.id);
    }
  }

  if (toDeleteIds.length > 0) {
    for (let i = 0; i < toDeleteIds.length; i += BATCH_SIZE) {
      const batch = toDeleteIds.slice(i, i + BATCH_SIZE);
      await tx.delete(animalGroupDonationsTable).where(inArray(animalGroupDonationsTable.groupId, batch));
      await tx.delete(animalGroupsTable).where(inArray(animalGroupsTable.id, batch));
    }
  }

  if (toInsert.length > 0) {
    const kesildiMap = new Map(existingRows.map(r => [r.id, { kesildi: r.kesildi, kesildiAt: r.kesildiAt, teamId: r.teamId }]));
    const insertIdx = incoming.reduce((acc, g, i) => { acc.set(g.id, i); return acc; }, new Map<string, number>());
    await saveAnimalGroups(tx, kesimAlaniId, toInsert.map(g => ({ ...g, sortOrder: insertIdx.get(g.id) ?? 0 })) as any, kesildiMap);
  }

  for (const { id, updates } of toUpdate) {
    await tx.update(animalGroupsTable).set(updates).where(eq(animalGroupsTable.id, id));
  }

  const existingLinks = await tx.select({
    groupId: animalGroupDonationsTable.groupId,
    donationId: animalGroupDonationsTable.donationId,
    sortOrder: animalGroupDonationsTable.sortOrder,
  }).from(animalGroupDonationsTable).where(
    inArray(animalGroupDonationsTable.groupId, incoming.map(g => g.id))
  );

  const existingLinkSet = new Set(existingLinks.map(l => `${l.groupId}:${l.donationId}`));
  const incomingLinkSet = new Set<string>();
  const newLinks: { groupId: string; donationId: string; sortOrder: number }[] = [];
  const updateLinks: { groupId: string; donationId: string; sortOrder: number }[] = [];

  for (const g of incoming) {
    if (!g.donations) continue;
    const gDonations = g.donations;
    for (let j = 0; j < gDonations.length; j++) {
      const key = `${g.id}:${gDonations[j].id}`;
      incomingLinkSet.add(key);
      if (!existingLinkSet.has(key)) {
        newLinks.push({ groupId: g.id, donationId: gDonations[j].id, sortOrder: j });
      } else {
        const existing = existingLinks.find(l => l.groupId === g.id && l.donationId === gDonations[j].id);
        if (existing && existing.sortOrder !== j) {
          updateLinks.push({ groupId: g.id, donationId: gDonations[j].id, sortOrder: j });
        }
      }
    }
  }

  const deleteLinks = existingLinks.filter(l => !incomingLinkSet.has(`${l.groupId}:${l.donationId}`));
  if (deleteLinks.length > 0) {
    for (const l of deleteLinks) {
      await tx.delete(animalGroupDonationsTable)
        .where(and(eq(animalGroupDonationsTable.groupId, l.groupId), eq(animalGroupDonationsTable.donationId, l.donationId)));
    }
  }

  if (newLinks.length > 0) {
    for (let i = 0; i < newLinks.length; i += BATCH_SIZE) {
      await tx.insert(animalGroupDonationsTable).values(newLinks.slice(i, i + BATCH_SIZE)).onConflictDoNothing();
    }
  }

  for (const l of updateLinks) {
    await tx.update(animalGroupDonationsTable)
      .set({ sortOrder: l.sortOrder })
      .where(and(eq(animalGroupDonationsTable.groupId, l.groupId), eq(animalGroupDonationsTable.donationId, l.donationId)));
  }
}

export async function createNotificationLogs(kesimAlaniId: string, groupId: string, animalNo: number, kesildi: boolean) {
  if (!kesildi) return;

  try {
    const links = await db.select({ donationId: animalGroupDonationsTable.donationId })
      .from(animalGroupDonationsTable)
      .where(eq(animalGroupDonationsTable.groupId, groupId));

    if (links.length === 0) return;

    const donationIds = links.map(l => l.donationId);
    const donations = await db.select({
      id: donationsTable.id,
      name: donationsTable.name,
      phone: donationsTable.phone,
    }).from(donationsTable)
      .where(inArray(donationsTable.id, donationIds));

    const [templateSetting] = await db.select().from(appSettingsTable)
      .where(eq(appSettingsTable.key, "notification_template"));
    const template = templateSetting?.value || "Hayvan {animalNo} kesildi. Hayırlı olsun!";

    const now = new Date();
    const logRows = donations
      .filter(d => d.name.trim())
      .map(d => ({
        id: crypto.randomUUID(),
        kesimAlaniId,
        animalGroupId: groupId,
        animalNo,
        donorName: d.name,
        phone: d.phone || "",
        message: template.replaceAll("{animalNo}", String(animalNo)).replaceAll("{donorName}", d.name),
        channel: "browser",
        createdAt: now,
      }));

    if (logRows.length > 0) {
      await db.insert(notificationLogsTable).values(logRows);
    }
  } catch (err) {
    console.error("createNotificationLogs error:", err);
  }
}
