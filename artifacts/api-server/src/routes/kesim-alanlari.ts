import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  animalGroupsTable,
  animalGroupDonationsTable,
  donationTagsTable,
  projectsTable,
  trackingNotesTable,
  animalGroupPhotosTable,
  teamsTable,
  notificationLogsTable,
  appSettingsTable,
  donationTransfersTable,
  type DonationRow,
  type AnimalGroupRow,
  type TeamRow,
  type KesimAlaniRow,
} from "@workspace/db/schema";
import { desc, gt, lt, or, sql, count, ilike, asc } from "drizzle-orm";
import { eq, inArray, isNull, isNotNull, and } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { refreshProjectStats } from "./projects";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface DonationPayload {
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

interface AnimalGroupPayload {
  id: string;
  animalNo?: number;
  colorTag?: string;
  locked?: boolean;
  notes?: string;
  donations?: DonationPayload[];
}

interface DonationOutput {
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

const animalGroupPayloadSchema = z.object({
  id: z.string().min(1),
  animalNo: z.number().int().optional().default(0),
  colorTag: z.string().optional().default(""),
  locked: z.boolean().optional().default(false),
  notes: z.string().optional().default(""),
  donations: z.array(donationPayloadSchema).optional().default([]),
});

const createKesimAlaniSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().optional(),
  kesimListeId: z.string().optional().nullable(),
  donations: z.array(donationPayloadSchema).optional().default([]),
  animalGroups: z.array(animalGroupPayloadSchema).optional().default([]),
});

const updateKesimAlaniSchema = z.object({
  name: z.string().min(1).optional(),
  kesimListeId: z.string().optional().nullable(),
  donations: z.array(donationPayloadSchema).optional(),
  animalGroups: z.array(animalGroupPayloadSchema).optional(),
});

const router: IRouter = Router();

async function requireActiveKesimAlani(id: string) {
  const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
  if (!existing) return { error: "Kesim alanı bulunamadı", status: 404 as const };
  if (existing.deletedAt) return { error: "Silinmiş bir kesim alanı üzerinde işlem yapılamaz. Önce geri yükleyin.", status: 400 as const };
  return { existing, error: null, status: 200 as const };
}

function assembleKesimAlani(
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

async function getFullKesimAlaniList(kaRows: KesimAlaniRow[]) {
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
    }));

    assembled.set(rawRow.ka_id, assembleKesimAlani(ka, donations, groups, tagsByDonation, groupLinks, teams));
  }

  return kaRows.map(ka => assembled.get(ka.id)!).filter(Boolean);
}

async function getFullKesimAlani(id: string) {
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.id, id));
  if (!ka) return null;

  const [result] = await getFullKesimAlaniList([ka]);
  return result;
}

router.get("/kesim-alanlari", async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === "true";
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
    res.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("GET /kesim-alanlari error:", message);
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/deleted", async (_req, res) => {
  try {
    const rows = await db.select().from(kesimAlanlariTable)
      .where(isNotNull(kesimAlanlariTable.deletedAt))
      .orderBy(kesimAlanlariTable.createdAt);

    const results = await getFullKesimAlaniList(rows);
    res.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("GET /kesim-alanlari/deleted error:", message);
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id", async (req, res) => {
  try {
    const result = await getFullKesimAlani(req.params.id);
    if (!result) {
      res.status(404).json({ error: "Bulunamadı" });
      return;
    }
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /kesim-alanlari/${req.params.id} error:`, message);
    res.status(500).json({ error: message });
  }
});

router.post("/kesim-alanlari", async (req, res) => {
  const parsed = createKesimAlaniSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const { id, name, createdAt, kesimListeId, donations, animalGroups } = parsed.data;
  const projectId = req.body.projectId || null;

  try {
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

    const result = await getFullKesimAlani(id);
    res.status(201).json(result);
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("POST /kesim-alanlari error:", message);
    res.status(500).json({ error: message });
  }
});

router.put("/kesim-alanlari/:id/move", async (req, res) => {
  try {
    const { id } = req.params;
    const { projectId } = req.body;
    const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Kesim alanı bulunamadı" });
      return;
    }
    if (projectId) {
      const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!proj) {
        res.status(404).json({ error: "Hedef proje bulunamadı" });
        return;
      }
    }
    await db.update(kesimAlanlariTable).set({ projectId: projectId || null }).where(eq(kesimAlanlariTable.id, id));
    const result = await getFullKesimAlani(id);
    res.json(result);
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`PUT /kesim-alanlari/${req.params.id}/move error:`, message);
    res.status(500).json({ error: message });
  }
});

router.put("/kesim-alanlari/:id", async (req, res) => {
  const parsed = updateKesimAlaniSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const { id } = req.params;
  const { name, kesimListeId, donations, animalGroups } = parsed.data;

  try {
    const kaCheck = await requireActiveKesimAlani(id);
    if (kaCheck.error) {
      res.status(kaCheck.status).json({ error: kaCheck.error });
      return;
    }

    let kesildiMap: Map<string, { kesildi: boolean; kesildiAt: Date | null; teamId: string | null }> | undefined;
    if (animalGroups !== undefined) {
      const existingGroups = await db.select({
        id: animalGroupsTable.id,
        kesildi: animalGroupsTable.kesildi,
        kesildiAt: animalGroupsTable.kesildiAt,
        teamId: animalGroupsTable.teamId,
      }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, id));
      kesildiMap = new Map(existingGroups.map(g => [g.id, { kesildi: g.kesildi, kesildiAt: g.kesildiAt, teamId: g.teamId }]));
    }

    await db.transaction(async (tx) => {
      const kaUpdates: Record<string, string | null> = {};
      if (name !== undefined) kaUpdates.name = name;
      if (kesimListeId !== undefined) kaUpdates.kesimListeId = kesimListeId ?? null;
      if (Object.keys(kaUpdates).length > 0) {
        await tx.update(kesimAlanlariTable).set(kaUpdates).where(eq(kesimAlanlariTable.id, id));
      }

      if (donations !== undefined && animalGroups !== undefined) {
        await tx.delete(donationTagsTable).where(
          inArray(donationTagsTable.donationId,
            tx.select({ id: donationsTable.id }).from(donationsTable).where(and(eq(donationsTable.kesimAlaniId, id), isNull(donationsTable.deletedAt)))
          )
        );
        await tx.delete(animalGroupDonationsTable).where(
          inArray(animalGroupDonationsTable.groupId,
            tx.select({ id: animalGroupsTable.id }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, id))
          )
        );
        await tx.delete(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, id));
        await tx.delete(donationsTable).where(and(eq(donationsTable.kesimAlaniId, id), isNull(donationsTable.deletedAt)));
        await saveDonations(tx, id, donations);
        await saveAnimalGroups(tx, id, animalGroups, kesildiMap);
      } else if (donations !== undefined) {
        await tx.delete(donationTagsTable).where(
          inArray(donationTagsTable.donationId,
            tx.select({ id: donationsTable.id }).from(donationsTable).where(and(eq(donationsTable.kesimAlaniId, id), isNull(donationsTable.deletedAt)))
          )
        );
        await tx.delete(animalGroupDonationsTable).where(
          inArray(animalGroupDonationsTable.groupId,
            tx.select({ id: animalGroupsTable.id }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, id))
          )
        );
        await tx.delete(donationsTable).where(and(eq(donationsTable.kesimAlaniId, id), isNull(donationsTable.deletedAt)));
        await saveDonations(tx, id, donations);
      } else if (animalGroups !== undefined) {
        await tx.delete(animalGroupDonationsTable).where(
          inArray(animalGroupDonationsTable.groupId,
            tx.select({ id: animalGroupsTable.id }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, id))
          )
        );
        await tx.delete(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, id));
        await saveAnimalGroups(tx, id, animalGroups, kesildiMap);
      }
    });

    const result = await getFullKesimAlani(id);
    res.json(result);
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`PUT /kesim-alanlari/${id} error:`, message);
    res.status(500).json({ error: message });
  }
});

router.delete("/kesim-alanlari/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const permanent = req.query.permanent === "true";

    const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Kesim alanı bulunamadı" });
      return;
    }

    if (permanent) {
      await db.delete(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
    } else {
      await db.update(kesimAlanlariTable)
        .set({ deletedAt: new Date() })
        .where(eq(kesimAlanlariTable.id, id));
    }

    res.json({ success: true });
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`DELETE /kesim-alanlari/${req.params.id} error:`, message);
    res.status(500).json({ error: message });
  }
});

router.post("/kesim-alanlari/:id/restore", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Kesim alanı bulunamadı" });
      return;
    }

    if (!existing.deletedAt) {
      res.status(400).json({ error: "Bu kesim alanı zaten aktif" });
      return;
    }

    await db.update(kesimAlanlariTable)
      .set({ deletedAt: null })
      .where(eq(kesimAlanlariTable.id, id));

    const result = await getFullKesimAlani(id);
    res.json(result);
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`POST /kesim-alanlari/${req.params.id}/restore error:`, message);
    res.status(500).json({ error: message });
  }
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

router.get("/kesim-alanlari/:id/donations", async (req, res) => {
  try {
    const { id: kesimAlaniId } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
    if (!ka) {
      res.status(404).json({ error: "Kesim alanı bulunamadı" });
      return;
    }

    const rawLimit = Number(req.query.limit) || 100;
    const limit = Math.min(Math.max(rawLimit, 1), 500);
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
        res.status(400).json({ error: "Geçersiz cursor" });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /kesim-alanlari/${req.params.id}/donations error:`, message);
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id/donations/count", async (req, res) => {
  try {
    const { id: kesimAlaniId } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
    if (!ka) {
      res.status(404).json({ error: "Kesim alanı bulunamadı" });
      return;
    }

    const where = buildDonationFilters(kesimAlaniId, req.query as Record<string, unknown>);
    const [result] = await db.select({ total: count() }).from(donationsTable).where(where);
    res.json({ count: result.total });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /kesim-alanlari/${req.params.id}/donations/count error:`, message);
    res.status(500).json({ error: message });
  }
});

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
  const conditions = [
    eq(animalGroupsTable.kesimAlaniId, kesimAlaniId),
  ];

  if (query.locked === "true") conditions.push(eq(animalGroupsTable.locked, true));
  if (query.locked === "false") conditions.push(eq(animalGroupsTable.locked, false));

  if (query.kesildi === "true") conditions.push(eq(animalGroupsTable.kesildi, true));
  if (query.kesildi === "false") conditions.push(eq(animalGroupsTable.kesildi, false));

  const teamId = typeof query.teamId === "string" ? query.teamId.trim() : "";
  if (teamId) conditions.push(eq(animalGroupsTable.teamId, teamId));

  return and(...conditions)!;
}

router.get("/kesim-alanlari/:id/groups", async (req, res) => {
  try {
    const { id: kesimAlaniId } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
    if (!ka) {
      res.status(404).json({ error: "Kesim alanı bulunamadı" });
      return;
    }

    const rawLimit = Number(req.query.limit) || 50;
    const limit = Math.min(Math.max(rawLimit, 1), 200);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;
    const rawOffset = Number(req.query.offset);
    const offset = !cursor && Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
    const { sortField, sortDir } = parseGroupSortParams(req.query as Record<string, unknown>);

    const where = buildGroupFilters(kesimAlaniId, req.query as Record<string, unknown>);

    const col = GROUP_SORT_FIELDS[sortField];
    const dirFn = sortDir === "desc" ? desc : asc;
    const cmpFn = sortDir === "desc" ? lt : gt;

    let cursorCondition;
    if (cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        const cursorId = parsed.id as string;
        const cursorVal = parsed.v as number;
        if (typeof cursorId === "string" && cursorVal !== undefined) {
          cursorCondition = or(
            cmpFn(col, cursorVal),
            and(eq(col, cursorVal), gt(animalGroupsTable.id, cursorId)),
          );
        }
      } catch {
        res.status(400).json({ error: "Geçersiz cursor" });
        return;
      }
    }

    const finalWhere = cursorCondition ? and(where, cursorCondition) : where;

    const query = db.select().from(animalGroupsTable)
      .where(finalWhere!)
      .orderBy(dirFn(col), asc(animalGroupsTable.id))
      .limit(limit + 1);

    const rows = offset > 0 ? await query.offset(offset) : await query;

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

    res.json({ items, nextCursor, hasMore });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /kesim-alanlari/${req.params.id}/groups error:`, message);
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id/groups/count", async (req, res) => {
  try {
    const { id: kesimAlaniId } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
    if (!ka) {
      res.status(404).json({ error: "Kesim alanı bulunamadı" });
      return;
    }

    const where = buildGroupFilters(kesimAlaniId, req.query as Record<string, unknown>);
    const [result] = await db.select({ total: count() }).from(animalGroupsTable).where(where);
    res.json({ count: result.total });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /kesim-alanlari/${req.params.id}/groups/count error:`, message);
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id/groups/:groupId", async (req, res) => {
  try {
    const { id: kesimAlaniId, groupId } = req.params;

    const [group] = await db.select().from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, kesimAlaniId)));
    if (!group) {
      res.status(404).json({ error: "Hayvan grubu bulunamadı" });
      return;
    }

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

    res.json({
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /kesim-alanlari/${req.params.id}/groups/${req.params.groupId} error:`, message);
    res.status(500).json({ error: message });
  }
});

const bulkLockSchema = z.object({
  groupIds: z.array(z.string()).max(500).optional(),
  filter: z.object({
    locked: z.enum(["true", "false"]).optional(),
    kesildi: z.enum(["true", "false"]).optional(),
    teamId: z.string().optional(),
  }).optional(),
  locked: z.boolean(),
});

router.post("/kesim-alanlari/:id/groups/bulk-lock", async (req, res) => {
  const parsed = bulkLockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId } = req.params;
  const { groupIds, filter, locked } = parsed.data;

  if (!groupIds?.length && !filter) {
    res.status(400).json({ error: "groupIds veya filter gerekli" });
    return;
  }

  try {
    const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
    if (kaCheck.error) {
      res.status(kaCheck.status).json({ error: kaCheck.error });
      return;
    }

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
    res.json({ updated: updatedCount, locked });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`POST /kesim-alanlari/${kesimAlaniId}/groups/bulk-lock error:`, message);
    res.status(500).json({ error: message });
  }
});

router.post("/kesim-alanlari/:id/donations", async (req, res) => {
  const parsed = donationPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId } = req.params;
  const donation = parsed.data;

  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`POST /kesim-alanlari/${kesimAlaniId}/donations error:`, message);
    res.status(500).json({ error: message });
  }
});

router.put("/kesim-alanlari/:id/donations/:donationId", async (req, res) => {
  const parsed = donationPayloadSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId, donationId } = req.params;
  const updates = parsed.data;

  try {
    const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
    if (kaCheck.error) {
      res.status(kaCheck.status).json({ error: kaCheck.error });
      return;
    }

    const [existing] = await db.select().from(donationsTable)
      .where(eq(donationsTable.id, donationId));
    if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
      res.status(404).json({ error: "Bağışçı bulunamadı" });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`PUT /kesim-alanlari/${kesimAlaniId}/donations/${donationId} error:`, message);
    res.status(500).json({ error: message });
  }
});

router.delete("/kesim-alanlari/:id/donations/:donationId", async (req, res) => {
  try {
    const { id: kesimAlaniId, donationId } = req.params;
    const permanent = req.query.permanent === "true";
    const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
    if (kaCheck.error) {
      res.status(kaCheck.status).json({ error: kaCheck.error });
      return;
    }
    const [existing] = await db.select().from(donationsTable).where(eq(donationsTable.id, donationId));
    if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
      res.status(404).json({ error: "Bağışçı bulunamadı" });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`DELETE donation ${req.params.donationId} error:`, message);
    res.status(500).json({ error: message });
  }
});

router.post("/kesim-alanlari/:id/donations/:donationId/restore", async (req, res) => {
  try {
    const { id: kesimAlaniId, donationId } = req.params;
    const [existing] = await db.select().from(donationsTable).where(eq(donationsTable.id, donationId));
    if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
      res.status(404).json({ error: "Bağışçı bulunamadı" });
      return;
    }
    if (!existing.deletedAt) {
      res.status(400).json({ error: "Bu bağışçı zaten aktif" });
      return;
    }
    await db.update(donationsTable)
      .set({ deletedAt: null })
      .where(eq(donationsTable.id, donationId));
    const result = await getFullKesimAlani(kesimAlaniId);
    res.json(result);
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`POST restore donation ${req.params.donationId} error:`, message);
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id/donations/deleted", async (req, res) => {
  try {
    const { id: kesimAlaniId } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kesimAlaniId));
    if (!ka) {
      res.status(404).json({ error: "Kesim alanı bulunamadı" });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET deleted donations for ${req.params.id} error:`, message);
    res.status(500).json({ error: message });
  }
});

router.post("/kesim-alanlari/:id/animal-groups", async (req, res) => {
  const parsed = animalGroupPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId } = req.params;
  const group = parsed.data;

  try {
    const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
    if (kaCheck.error) {
      res.status(kaCheck.status).json({ error: kaCheck.error });
      return;
    }

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

    const result = await getFullKesimAlani(kesimAlaniId);
    res.status(201).json(result);
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`POST /kesim-alanlari/${kesimAlaniId}/animal-groups error:`, message);
    res.status(500).json({ error: message });
  }
});

const bulkAnimalGroupsSchema = z.object({
  animalGroups: z.array(animalGroupPayloadSchema),
});

router.put("/kesim-alanlari/:id/animal-groups/bulk", async (req, res) => {
  const parsed = bulkAnimalGroupsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId } = req.params;
  const { animalGroups } = parsed.data;

  try {
    const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
    if (kaCheck.error) {
      res.status(kaCheck.status).json({ error: kaCheck.error });
      return;
    }

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

    const result = await getFullKesimAlani(kesimAlaniId);
    res.json(result);
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`PUT /kesim-alanlari/${kesimAlaniId}/animal-groups/bulk error:`, message);
    res.status(500).json({ error: message });
  }
});

router.put("/kesim-alanlari/:id/animal-groups/:groupId", async (req, res) => {
  const parsed = animalGroupPayloadSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const { id: kesimAlaniId, groupId } = req.params;
  const updates = parsed.data;

  try {
    const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
    if (kaCheck.error) {
      res.status(kaCheck.status).json({ error: kaCheck.error });
      return;
    }

    const [existing] = await db.select().from(animalGroupsTable)
      .where(eq(animalGroupsTable.id, groupId));
    if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
      res.status(404).json({ error: "Hayvan grubu bulunamadı" });
      return;
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

    const result = await getFullKesimAlani(kesimAlaniId);
    res.json(result);
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`PUT /kesim-alanlari/${kesimAlaniId}/animal-groups/${groupId} error:`, message);
    res.status(500).json({ error: message });
  }
});

router.delete("/kesim-alanlari/:id/animal-groups/:groupId", async (req, res) => {
  try {
    const { id: kesimAlaniId, groupId } = req.params;
    const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
    if (kaCheck.error) {
      res.status(kaCheck.status).json({ error: kaCheck.error });
      return;
    }
    const [existing] = await db.select().from(animalGroupsTable).where(eq(animalGroupsTable.id, groupId));
    if (!existing || existing.kesimAlaniId !== kesimAlaniId) {
      res.status(404).json({ error: "Hayvan grubu bulunamadı" });
      return;
    }
    await db.delete(animalGroupsTable).where(eq(animalGroupsTable.id, groupId));
    res.json({ success: true });
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`DELETE animal-group ${req.params.groupId} error:`, message);
    res.status(500).json({ error: message });
  }
});

router.get("/catisma-tespiti", async (req, res) => {
  try {
    const projectIdFilter = req.query.projectId as string | undefined;
    const conditions = [isNull(kesimAlanlariTable.deletedAt)];
    if (projectIdFilter) {
      conditions.push(eq(kesimAlanlariTable.projectId, projectIdFilter));
    }
    const allKA = await db.select().from(kesimAlanlariTable).where(and(...conditions));
    const allDonations = allKA.length > 0
      ? await db.select().from(donationsTable)
          .where(and(
            inArray(donationsTable.kesimAlaniId, allKA.map(k => k.id)),
            isNull(donationsTable.deletedAt)
          ))
      : [];
    const allGroups = allKA.length > 0
      ? await db.select().from(animalGroupsTable)
          .where(inArray(animalGroupsTable.kesimAlaniId, allKA.map(k => k.id)))
      : [];
    const allDonationIds = allDonations.map(d => d.id);
    const allGroupIds = allGroups.map(g => g.id);
    const [donationTags, groupDonationLinks] = await Promise.all([
      allDonationIds.length > 0
        ? db.select().from(donationTagsTable).where(inArray(donationTagsTable.donationId, allDonationIds))
        : Promise.resolve([]),
      allGroupIds.length > 0
        ? db.select().from(animalGroupDonationsTable).where(inArray(animalGroupDonationsTable.groupId, allGroupIds))
        : Promise.resolve([]),
    ]);

    const tagsByDonation: Record<string, string[]> = {};
    for (const dt of donationTags) {
      if (!tagsByDonation[dt.donationId]) tagsByDonation[dt.donationId] = [];
      tagsByDonation[dt.donationId].push(dt.tagId);
    }

    const donationsByGroupId: Record<string, string[]> = {};
    for (const link of groupDonationLinks) {
      if (!donationsByGroupId[link.groupId]) donationsByGroupId[link.groupId] = [];
      donationsByGroupId[link.groupId].push(link.donationId);
    }

    const groupsByDonationId: Record<string, string[]> = {};
    for (const link of groupDonationLinks) {
      if (!groupsByDonationId[link.donationId]) groupsByDonationId[link.donationId] = [];
      groupsByDonationId[link.donationId].push(link.groupId);
    }

    const kaById = Object.fromEntries(allKA.map(k => [k.id, k]));
    const donationById = Object.fromEntries(allDonations.map(d => [d.id, d]));
    const groupById = Object.fromEntries(allGroups.map(g => [g.id, g]));

    const normalizeStr = (s: string) => (s || "").trim().toLowerCase();

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

    const NOTE_WARNING_KEYWORDS = ["iade", "iptal", "hata", "yanlış", "sorun", "problem", "dikkat", "uyarı", "eksik", "hatalı", "değiştirilecek"];
    const hasNoteWarning = (notes: string) => {
      if (!notes) return false;
      const lower = notes.toLowerCase();
      return NOTE_WARNING_KEYWORDS.some(kw => lower.includes(kw));
    };

    const groupedByName: Record<string, { displayName: string; donations: typeof allDonations }> = {};
    const groupedByDescription: Record<string, { displayDescription: string; donations: typeof allDonations }> = {};

    for (const d of allDonations) {
      const nameKey = normalizeStr(d.name);
      if (nameKey) {
        if (!groupedByName[nameKey]) groupedByName[nameKey] = { displayName: d.name, donations: [] };
        groupedByName[nameKey].donations.push(d);
      }
      const descKey = normalizeStr(d.description);
      if (descKey) {
        if (!groupedByDescription[descKey]) groupedByDescription[descKey] = { displayDescription: d.description, donations: [] };
        groupedByDescription[descKey].donations.push(d);
      }
    }

    function buildConflictEntries(donations: typeof allDonations): ConflictEntry[] {
      const entries: ConflictEntry[] = [];
      for (const d of donations) {
        const groupIds = groupsByDonationId[d.id] || [];
        if (groupIds.length === 0) {
          const siblings = allDonations
            .filter(od => od.kesimAlaniId === d.kesimAlaniId && od.id !== d.id)
            .slice(0, 5)
            .map(od => ({
              donationId: od.id,
              donationName: od.name,
              donationDescription: od.description,
              donationNotes: od.notes,
              donationType: od.donationType,
              shareCount: od.shareCount,
              vekalet: od.vekalet,
            }));
          entries.push({
            donationId: d.id,
            donationName: d.name,
            donationDescription: d.description,
            donationNotes: d.notes,
            kesimAlaniId: d.kesimAlaniId,
            kesimAlaniName: kaById[d.kesimAlaniId]?.name || d.kesimAlaniId,
            animalGroupId: null,
            animalGroupNo: null,
            hasNoteWarning: hasNoteWarning(d.notes),
            siblingsInGroup: siblings,
          });
        } else {
          for (const groupId of groupIds) {
            const group = groupById[groupId];
            const siblingDonationIds = donationsByGroupId[groupId] || [];
            const siblings = siblingDonationIds
              .filter(sid => sid !== d.id)
              .map(sid => donationById[sid])
              .filter(Boolean)
              .map(od => ({
                donationId: od.id,
                donationName: od.name,
                donationDescription: od.description,
                donationNotes: od.notes,
                donationType: od.donationType,
                shareCount: od.shareCount,
                vekalet: od.vekalet,
              }));
            entries.push({
              donationId: d.id,
              donationName: d.name,
              donationDescription: d.description,
              donationNotes: d.notes,
              kesimAlaniId: d.kesimAlaniId,
              kesimAlaniName: kaById[d.kesimAlaniId]?.name || d.kesimAlaniId,
              animalGroupId: groupId,
              animalGroupNo: group?.animalNo ?? null,
              hasNoteWarning: hasNoteWarning(d.notes),
              siblingsInGroup: siblings,
            });
          }
        }
      }
      return entries;
    }

    const seenConflictKeys = new Set<string>();
    const conflicts: Conflict[] = [];

    for (const [key, { displayName, donations }] of Object.entries(groupedByName)) {
      if (donations.length <= 1) continue;
      const uniqueKA = new Set(donations.map(d => d.kesimAlaniId));
      if (uniqueKA.size <= 1) continue;
      const entries = buildConflictEntries(donations);
      seenConflictKeys.add(key);
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

    for (const [key, { displayDescription, donations }] of Object.entries(groupedByDescription)) {
      if (donations.length <= 1) continue;
      if (seenConflictKeys.has(key)) continue;
      const uniqueKA = new Set(donations.map(d => d.kesimAlaniId));
      if (uniqueKA.size <= 1) continue;
      const entries = buildConflictEntries(donations);
      conflicts.push({
        key: `desc:${key}`,
        matchField: "description",
        displayName: displayDescription,
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

    res.json({ conflicts, totalConflicts: conflicts.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("GET /catisma-tespiti error:", message);
    res.status(500).json({ error: message });
  }
});

const transferSchema = z.object({
  donationId: z.string().min(1),
  sourceKesimAlaniId: z.string().min(1),
  targetKesimAlaniId: z.string().min(1),
  transferAnimal: z.boolean().optional().default(false),
  animalGroupId: z.string().optional(),
});

router.post("/catisma-tespiti/transfer", async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const { donationId, sourceKesimAlaniId, targetKesimAlaniId, transferAnimal, animalGroupId } = parsed.data;

  if (sourceKesimAlaniId === targetKesimAlaniId) {
    res.status(400).json({ error: "Kaynak ve hedef kesim alanı aynı olamaz" });
    return;
  }

  try {
    const [sourceKA, targetKA] = await Promise.all([
      db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, sourceKesimAlaniId)),
      db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, targetKesimAlaniId)),
    ]);

    if (!sourceKA[0] || sourceKA[0].deletedAt) {
      res.status(404).json({ error: "Kaynak kesim alanı bulunamadı veya silinmiş" });
      return;
    }
    if (!targetKA[0] || targetKA[0].deletedAt) {
      res.status(404).json({ error: "Hedef kesim alanı bulunamadı veya silinmiş" });
      return;
    }

    const [donation] = await db.select().from(donationsTable).where(eq(donationsTable.id, donationId));
    if (!donation || donation.kesimAlaniId !== sourceKesimAlaniId) {
      res.status(404).json({ error: "Bağışçı bulunamadı veya kaynak kesim alanına ait değil" });
      return;
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

        for (let i = 0; i < donationsInGroup.length; i++) {
          const d = donationsInGroup[i];
          const tagRows = await tx.select().from(donationTagsTable).where(eq(donationTagsTable.donationId, d.id));
          await tx.delete(donationTagsTable).where(eq(donationTagsTable.donationId, d.id));
          await tx.update(donationsTable)
            .set({ kesimAlaniId: targetKesimAlaniId, sortOrder: donationSortBase + i })
            .where(eq(donationsTable.id, d.id));
          if (tagRows.length > 0) {
            await tx.insert(donationTagsTable)
              .values(tagRows.map(t => ({ donationId: d.id, tagId: t.tagId })))
              .onConflictDoNothing();
          }
        }

        await tx.update(animalGroupsTable)
          .set({ kesimAlaniId: targetKesimAlaniId, sortOrder: groupSortBase })
          .where(eq(animalGroupsTable.id, animalGroupId));

        for (let i = 0; i < donationIdsInGroup.length; i++) {
          await tx.insert(animalGroupDonationsTable)
            .values({ groupId: animalGroupId, donationId: donationIdsInGroup[i], sortOrder: i })
            .onConflictDoNothing();
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

    res.json({ success: true, source: updatedSource, target: updatedTarget });
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("POST /catisma-tespiti/transfer error:", message);
    res.status(500).json({ error: message });
  }
});

const BATCH_SIZE = 500;

async function saveDonations(tx: Tx, kesimAlaniId: string, donations: DonationPayload[]) {
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

async function saveAnimalGroups(tx: Tx, kesimAlaniId: string, groups: AnimalGroupPayload[], kesildiMap?: Map<string, { kesildi: boolean; kesildiAt: Date | null; teamId: string | null }>) {
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
      sortOrder: i,
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

router.post("/kesim-alanlari/move-donations", async (req, res) => {
  try {
    const parsed = z.object({
      donationIds: z.array(z.string()).min(1),
      sourceKesimAlaniId: z.string(),
      targetKesimAlaniId: z.string(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
      return;
    }

    const { donationIds, sourceKesimAlaniId, targetKesimAlaniId } = parsed.data;

    if (sourceKesimAlaniId === targetKesimAlaniId) {
      res.status(400).json({ error: "Kaynak ve hedef kesim alanı aynı olamaz" });
      return;
    }

    const [sourceKA, targetKA] = await Promise.all([
      db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, sourceKesimAlaniId)).then(r => r[0]),
      db.select().from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, targetKesimAlaniId)).then(r => r[0]),
    ]);

    if (!sourceKA || sourceKA.deletedAt) {
      res.status(404).json({ error: "Kaynak kesim alanı bulunamadı" });
      return;
    }
    if (!targetKA || targetKA.deletedAt) {
      res.status(404).json({ error: "Hedef kesim alanı bulunamadı" });
      return;
    }

    if (sourceKA.projectId !== targetKA.projectId) {
      res.status(400).json({ error: "Kaynak ve hedef kesim alanları aynı projede olmalıdır" });
      return;
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
      res.status(400).json({ error: "Aktarılacak geçerli bağışçı bulunamadı" });
      return;
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

    res.json({ success: true, count: validIds.length, skipped: donationIds.length - validIds.length });
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("POST /kesim-alanlari/move-donations error:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/kesim-alanlari/:id/generate-tracking-token", async (req, res) => {
  try {
    const { id } = req.params;
    const check = await requireActiveKesimAlani(id);
    if (check.error) { res.status(check.status).json({ error: check.error }); return; }

    const token = crypto.randomBytes(16).toString("hex");
    await db.update(kesimAlanlariTable).set({ trackingToken: token }).where(eq(kesimAlanlariTable.id, id));
    res.json({ trackingToken: token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`POST /kesim-alanlari/${req.params.id}/generate-tracking-token error:`, message);
    res.status(500).json({ error: message });
  }
});

router.get("/tracking/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable)
      .where(eq(kesimAlanlariTable.trackingToken, token));
    if (!ka || ka.deletedAt) {
      res.status(404).json({ error: "Takip linki bulunamadı" });
      return;
    }

    const groups = await db.select().from(animalGroupsTable)
      .where(eq(animalGroupsTable.kesimAlaniId, ka.id))
      .orderBy(animalGroupsTable.sortOrder);

    const groupIds = groups.map(g => g.id);
    const groupDonationLinks = groupIds.length > 0
      ? await db.select({
          groupId: animalGroupDonationsTable.groupId,
          donationId: animalGroupDonationsTable.donationId,
          sortOrder: animalGroupDonationsTable.sortOrder,
        }).from(animalGroupDonationsTable).where(inArray(animalGroupDonationsTable.groupId, groupIds))
      : [];

    const donationIds = [...new Set(groupDonationLinks.map(l => l.donationId))];
    const donations = donationIds.length > 0
      ? await db.select().from(donationsTable).where(inArray(donationsTable.id, donationIds))
      : [];

    const donationsById: Record<string, { name: string; description: string; donationType: string; vekalet: string; notes: string }> = {};
    for (const d of donations) {
      donationsById[d.id] = { name: d.name, description: d.description, donationType: d.donationType, vekalet: d.vekalet || "", notes: d.notes || "" };
    }

    const groupDonationsByGroup: Record<string, typeof groupDonationLinks> = {};
    for (const link of groupDonationLinks) {
      if (!groupDonationsByGroup[link.groupId]) groupDonationsByGroup[link.groupId] = [];
      groupDonationsByGroup[link.groupId].push(link);
    }

    const [teamRows, projectNameResult] = await Promise.all([
      db.select().from(teamsTable).where(eq(teamsTable.kesimAlaniId, ka.id)),
      ka.projectId
        ? db.select().from(projectsTable).where(eq(projectsTable.id, ka.projectId)).then(r => r[0]?.name || null)
        : Promise.resolve(null),
    ]);

    const mappedGroups = groups.map(g => {
      const links = (groupDonationsByGroup[g.id] || []).sort((a, b) => a.sortOrder - b.sortOrder);
      const filledDonations = links
        .map(l => donationsById[l.donationId])
        .filter(d => d && d.name.trim());
      return {
        id: g.id,
        animalNo: g.animalNo,
        colorTag: g.colorTag,
        kesildi: g.kesildi,
        kesildiAt: g.kesildiAt || null,
        teamId: g.teamId || null,
        filledCount: filledDonations.length,
        donors: filledDonations.map(d => ({ name: d.name, description: d.description, donationType: d.donationType, vekalet: d.vekalet || "", notes: d.notes || "" })),
      };
    });

    res.json({
      kesimAlaniName: ka.name,
      projectName: projectNameResult,
      totalGroups: groups.length,
      kesildiCount: groups.filter(g => g.kesildi).length,
      groups: mappedGroups,
      teams: teamRows.map(t => ({ id: t.id, name: t.name, color: t.color })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /tracking/${req.params.token} error:`, message);
    res.status(500).json({ error: message });
  }
});

async function createNotificationLogs(kesimAlaniId: string, groupId: string, animalNo: number, kesildi: boolean) {
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

router.put("/tracking/:token/group/:groupId/kesildi", async (req, res) => {
  try {
    const { token, groupId } = req.params;
    const { kesildi } = req.body;
    if (typeof kesildi !== "boolean") {
      res.status(400).json({ error: "kesildi alanı boolean olmalıdır" });
      return;
    }

    const [ka] = await db.select().from(kesimAlanlariTable)
      .where(eq(kesimAlanlariTable.trackingToken, token));
    if (!ka || ka.deletedAt) {
      res.status(404).json({ error: "Takip linki bulunamadı" });
      return;
    }

    const [group] = await db.select().from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
    if (!group) {
      res.status(404).json({ error: "Hayvan grubu bulunamadı" });
      return;
    }

    const kesildiAt = kesildi ? new Date() : null;
    await db.update(animalGroupsTable).set({ kesildi, kesildiAt }).where(eq(animalGroupsTable.id, groupId));
    await createNotificationLogs(ka.id, groupId, group.animalNo, kesildi);
    res.json({ success: true, groupId, kesildi, kesildiAt });
    refreshProjectStats();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`PUT /tracking/${req.params.token}/group/${req.params.groupId}/kesildi error:`, message);
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id/dashboard", async (req, res) => {
  const { id: kesimAlaniId } = req.params;

  try {
    const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
    if (kaCheck.error) {
      res.status(kaCheck.status).json({ error: kaCheck.error });
      return;
    }

    const groups = await db.select({
      id: animalGroupsTable.id,
      kesildi: animalGroupsTable.kesildi,
      kesildiAt: animalGroupsTable.kesildiAt,
    }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId));

    const totalAnimals = groups.length;
    const kesildiCount = groups.filter(g => g.kesildi).length;
    const kesildiTimes = groups.filter(g => g.kesildiAt).map(g => g.kesildiAt!).sort();
    const lastKesildiAt = kesildiTimes.length > 0 ? kesildiTimes[kesildiTimes.length - 1] : null;

    res.json({
      totalAnimals,
      kesildiCount,
      remainingCount: totalAnimals - kesildiCount,
      kesildiPercent: totalAnimals > 0 ? Math.round((kesildiCount / totalAnimals) * 100) : 0,
      lastKesildiAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /kesim-alanlari/${kesimAlaniId}/dashboard error:`, message);
    res.status(500).json({ error: message });
  }
});

router.get("/tracking/:token/notes", async (req, res) => {
  try {
    const { token } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable)
      .where(eq(kesimAlanlariTable.trackingToken, token));
    if (!ka || ka.deletedAt) {
      res.status(404).json({ error: "Takip linki bulunamadı" });
      return;
    }

    const notes = await db.select().from(trackingNotesTable)
      .where(eq(trackingNotesTable.kesimAlaniId, ka.id))
      .orderBy(desc(trackingNotesTable.createdAt));

    res.json(notes);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /tracking/${req.params.token}/notes error:`, message);
    res.status(500).json({ error: message });
  }
});

router.post("/tracking/:token/notes", async (req, res) => {
  try {
    const { token } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable)
      .where(eq(kesimAlanlariTable.trackingToken, token));
    if (!ka || ka.deletedAt) {
      res.status(404).json({ error: "Takip linki bulunamadı" });
      return;
    }

    const schema = z.object({
      animalGroupId: z.string().optional(),
      type: z.enum(["note", "edit_request"]),
      content: z.string().default(""),
      fieldName: z.string().optional(),
      oldValue: z.string().optional(),
      newValue: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
      return;
    }

    const { animalGroupId, type, content, fieldName, oldValue, newValue } = parsed.data;

    if (animalGroupId) {
      const [group] = await db.select({ id: animalGroupsTable.id })
        .from(animalGroupsTable)
        .where(and(eq(animalGroupsTable.id, animalGroupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
      if (!group) {
        res.status(400).json({ error: "Geçersiz hayvan grubu" });
        return;
      }
    }

    const noteId = crypto.randomUUID();
    const now = new Date();

    await db.insert(trackingNotesTable).values({
      id: noteId,
      kesimAlaniId: ka.id,
      animalGroupId: animalGroupId || null,
      type,
      content,
      fieldName: fieldName || null,
      oldValue: oldValue || null,
      newValue: newValue || null,
      status: "pending",
      createdAt: now,
    });

    const [created] = await db.select().from(trackingNotesTable).where(eq(trackingNotesTable.id, noteId));
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`POST /tracking/${req.params.token}/notes error:`, message);
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id/tracking-notes", async (req, res) => {
  try {
    const { id } = req.params;
    const check = await requireActiveKesimAlani(id);
    if (check.error) { res.status(check.status).json({ error: check.error }); return; }

    const notes = await db.select().from(trackingNotesTable)
      .where(eq(trackingNotesTable.kesimAlaniId, id))
      .orderBy(desc(trackingNotesTable.createdAt));

    res.json(notes);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /kesim-alanlari/${req.params.id}/tracking-notes error:`, message);
    res.status(500).json({ error: message });
  }
});

router.put("/kesim-alanlari/:id/tracking-notes/:noteId/status", async (req, res) => {
  try {
    const { id, noteId } = req.params;
    const check = await requireActiveKesimAlani(id);
    if (check.error) { res.status(check.status).json({ error: check.error }); return; }

    const statusSchema = z.object({ status: z.enum(["pending", "approved", "rejected"]) });
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Geçersiz durum" });
      return;
    }

    await db.update(trackingNotesTable)
      .set({ status: parsed.data.status })
      .where(and(eq(trackingNotesTable.id, noteId), eq(trackingNotesTable.kesimAlaniId, id)));

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`PUT /kesim-alanlari/${req.params.id}/tracking-notes/${req.params.noteId}/status error:`, message);
    res.status(500).json({ error: message });
  }
});

const MAX_PHOTOS_PER_GROUP = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

router.get("/tracking/:token/group/:groupId/photos", async (req, res) => {
  try {
    const { token, groupId } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable)
      .where(eq(kesimAlanlariTable.trackingToken, token));
    if (!ka) { res.status(404).json({ error: "Bulunamadı" }); return; }

    const [group] = await db.select().from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }

    const photos = await db.select({
      id: animalGroupPhotosTable.id,
      mimeType: animalGroupPhotosTable.mimeType,
      createdAt: animalGroupPhotosTable.createdAt,
    }).from(animalGroupPhotosTable)
      .where(eq(animalGroupPhotosTable.animalGroupId, groupId))
      .orderBy(animalGroupPhotosTable.createdAt);

    res.json(photos);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.get("/tracking/:token/group/:groupId/photos/:photoId", async (req, res) => {
  try {
    const { token, groupId, photoId } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable)
      .where(eq(kesimAlanlariTable.trackingToken, token));
    if (!ka) { res.status(404).json({ error: "Bulunamadı" }); return; }

    const [group] = await db.select().from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }

    const [photo] = await db.select().from(animalGroupPhotosTable)
      .where(and(eq(animalGroupPhotosTable.id, photoId), eq(animalGroupPhotosTable.animalGroupId, groupId)));
    if (!photo) { res.status(404).json({ error: "Fotoğraf bulunamadı" }); return; }

    const base64Data = photo.data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    res.setHeader("Content-Type", photo.mimeType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.post("/tracking/:token/group/:groupId/photos", async (req, res) => {
  try {
    const { token, groupId } = req.params;
    const { data, mimeType } = req.body;

    if (!data || typeof data !== "string") {
      res.status(400).json({ error: "Fotoğraf verisi gerekli" }); return;
    }

    const validMimes = ["image/jpeg", "image/png", "image/webp"];
    const mime = validMimes.includes(mimeType) ? mimeType : "image/jpeg";

    const base64Part = data.replace(/^data:[^;]+;base64,/, "");
    const sizeBytes = Math.ceil(base64Part.length * 3 / 4);
    if (sizeBytes > MAX_PHOTO_SIZE) {
      res.status(400).json({ error: "Fotoğraf çok büyük (max 5MB)" }); return;
    }

    const [ka] = await db.select().from(kesimAlanlariTable)
      .where(eq(kesimAlanlariTable.trackingToken, token));
    if (!ka) { res.status(404).json({ error: "Bulunamadı" }); return; }

    const [group] = await db.select().from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }

    const existingPhotos = await db.select({ id: animalGroupPhotosTable.id })
      .from(animalGroupPhotosTable)
      .where(eq(animalGroupPhotosTable.animalGroupId, groupId));
    if (existingPhotos.length >= MAX_PHOTOS_PER_GROUP) {
      res.status(400).json({ error: `Grup başına en fazla ${MAX_PHOTOS_PER_GROUP} fotoğraf yüklenebilir` }); return;
    }

    const photoId = crypto.randomUUID();
    const photoCreatedAt = new Date();
    await db.insert(animalGroupPhotosTable).values({
      id: photoId,
      animalGroupId: groupId,
      data: data.startsWith("data:") ? data : `data:${mime};base64,${data}`,
      mimeType: mime,
      createdAt: photoCreatedAt,
    });

    res.status(201).json({ id: photoId, mimeType: mime, createdAt: photoCreatedAt.toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.delete("/tracking/:token/group/:groupId/photos/:photoId", async (req, res) => {
  try {
    const { token, groupId, photoId } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable)
      .where(eq(kesimAlanlariTable.trackingToken, token));
    if (!ka) { res.status(404).json({ error: "Bulunamadı" }); return; }

    const [group] = await db.select().from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }

    await db.delete(animalGroupPhotosTable)
      .where(and(eq(animalGroupPhotosTable.id, photoId), eq(animalGroupPhotosTable.animalGroupId, groupId)));

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id/group/:groupId/photos", async (req, res) => {
  try {
    const { id, groupId } = req.params;
    const [group] = await db.select().from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, id)));
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }

    const photos = await db.select({
      id: animalGroupPhotosTable.id,
      mimeType: animalGroupPhotosTable.mimeType,
      createdAt: animalGroupPhotosTable.createdAt,
    }).from(animalGroupPhotosTable)
      .where(eq(animalGroupPhotosTable.animalGroupId, groupId))
      .orderBy(animalGroupPhotosTable.createdAt);

    res.json(photos);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id/group/:groupId/photos/:photoId", async (req, res) => {
  try {
    const { id, groupId, photoId } = req.params;
    const [group] = await db.select().from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, id)));
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }

    const [photo] = await db.select().from(animalGroupPhotosTable)
      .where(and(eq(animalGroupPhotosTable.id, photoId), eq(animalGroupPhotosTable.animalGroupId, groupId)));
    if (!photo) { res.status(404).json({ error: "Fotoğraf bulunamadı" }); return; }

    const base64Data = photo.data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    res.setHeader("Content-Type", photo.mimeType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id/photos/counts", async (req, res) => {
  try {
    const { id } = req.params;
    const groups = await db.select({ id: animalGroupsTable.id })
      .from(animalGroupsTable)
      .where(eq(animalGroupsTable.kesimAlaniId, id));
    const groupIds = groups.map(g => g.id);
    if (groupIds.length === 0) { res.json({}); return; }

    const photos = await db.select({
      animalGroupId: animalGroupPhotosTable.animalGroupId,
      id: animalGroupPhotosTable.id,
    }).from(animalGroupPhotosTable)
      .where(inArray(animalGroupPhotosTable.animalGroupId, groupIds));

    const counts: Record<string, number> = {};
    for (const p of photos) {
      counts[p.animalGroupId] = (counts[p.animalGroupId] || 0) + 1;
    }
    res.json(counts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id/teams", async (req, res) => {
  try {
    const { id } = req.params;
    const teams = await db.select().from(teamsTable)
      .where(eq(teamsTable.kesimAlaniId, id));
    res.json(teams.map(t => ({ id: t.id, name: t.name, color: t.color })));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.post("/kesim-alanlari/:id/teams", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Ekip adı gerekli" }); return;
    }
    const teamId = crypto.randomUUID();
    await db.insert(teamsTable).values({
      id: teamId,
      kesimAlaniId: id,
      name: name.trim(),
      color: color || "#3b82f6",
    });
    res.status(201).json({ id: teamId, name: name.trim(), color: color || "#3b82f6" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.put("/kesim-alanlari/:id/teams/:teamId", async (req, res) => {
  try {
    const { id, teamId } = req.params;
    const { name, color } = req.body;
    const [team] = await db.select().from(teamsTable)
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.kesimAlaniId, id)));
    if (!team) { res.status(404).json({ error: "Ekip bulunamadı" }); return; }
    const updates: Record<string, string> = {};
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;
    await db.update(teamsTable).set(updates).where(eq(teamsTable.id, teamId));
    res.json({ id: teamId, name: name !== undefined ? name.trim() : team.name, color: color !== undefined ? color : team.color });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.delete("/kesim-alanlari/:id/teams/:teamId", async (req, res) => {
  try {
    const { id, teamId } = req.params;
    const [team] = await db.select().from(teamsTable)
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.kesimAlaniId, id)));
    if (!team) { res.status(404).json({ error: "Ekip bulunamadı" }); return; }
    await db.update(animalGroupsTable)
      .set({ teamId: null })
      .where(and(eq(animalGroupsTable.kesimAlaniId, id), eq(animalGroupsTable.teamId, teamId)));
    await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.put("/kesim-alanlari/:id/groups/:groupId/team", async (req, res) => {
  try {
    const { id, groupId } = req.params;
    const { teamId } = req.body;
    const [group] = await db.select().from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, id)));
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }
    if (teamId) {
      const [team] = await db.select().from(teamsTable)
        .where(and(eq(teamsTable.id, teamId), eq(teamsTable.kesimAlaniId, id)));
      if (!team) { res.status(404).json({ error: "Ekip bulunamadı" }); return; }
    }
    await db.update(animalGroupsTable)
      .set({ teamId: teamId || null })
      .where(eq(animalGroupsTable.id, groupId));
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.put("/tracking/:token/group/:groupId/team", async (req, res) => {
  try {
    const { token, groupId } = req.params;
    const { teamId } = req.body;
    const [ka] = await db.select().from(kesimAlanlariTable)
      .where(eq(kesimAlanlariTable.trackingToken, token));
    if (!ka) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const [group] = await db.select().from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }
    if (teamId) {
      const [team] = await db.select().from(teamsTable)
        .where(and(eq(teamsTable.id, teamId), eq(teamsTable.kesimAlaniId, ka.id)));
      if (!team) { res.status(404).json({ error: "Ekip bulunamadı" }); return; }
    }
    await db.update(animalGroupsTable)
      .set({ teamId: teamId || null })
      .where(eq(animalGroupsTable.id, groupId));
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.get("/kesim-alanlari/:id/notification-logs", async (req, res) => {
  try {
    const { id } = req.params;
    const check = await requireActiveKesimAlani(id);
    if (check.error) { res.status(check.status).json({ error: check.error }); return; }

    const logs = await db.select().from(notificationLogsTable)
      .where(eq(notificationLogsTable.kesimAlaniId, id))
      .orderBy(desc(notificationLogsTable.createdAt));

    res.json(logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /kesim-alanlari/${req.params.id}/notification-logs error:`, message);
    res.status(500).json({ error: message });
  }
});

router.get("/settings/notification-template", async (_req, res) => {
  try {
    const [setting] = await db.select().from(appSettingsTable)
      .where(eq(appSettingsTable.key, "notification_template"));
    res.json({ template: setting?.value || "Hayvan {animalNo} kesildi. Hayırlı olsun!" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.put("/settings/notification-template", async (req, res) => {
  try {
    const { template } = req.body;
    if (typeof template !== "string" || !template.trim()) {
      res.status(400).json({ error: "Şablon metni gerekli" });
      return;
    }
    await db.insert(appSettingsTable)
      .values({ key: "notification_template", value: template.trim() })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: template.trim() } });
    res.json({ success: true, template: template.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

router.get("/tracking/:token/notification-logs", async (req, res) => {
  try {
    const { token } = req.params;
    const [ka] = await db.select().from(kesimAlanlariTable)
      .where(eq(kesimAlanlariTable.trackingToken, token));
    if (!ka || ka.deletedAt) {
      res.status(404).json({ error: "Takip linki bulunamadı" });
      return;
    }

    const since = req.query.since as string | undefined;
    const conditions = [eq(notificationLogsTable.kesimAlaniId, ka.id)];
    if (since) {
      const { gt } = await import("drizzle-orm");
      conditions.push(gt(notificationLogsTable.createdAt, since));
    }

    const logs = await db.select().from(notificationLogsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationLogsTable.createdAt));

    res.json(logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /tracking/${req.params.token}/notification-logs error:`, message);
    res.status(500).json({ error: message });
  }
});

router.post("/donation-transfers", async (req, res) => {
  try {
    const bodySchema = z.object({
      entries: z.array(z.object({
        id: z.string().min(1),
        projectId: z.string().min(1),
        donationId: z.string(),
        donorName: z.string(),
        donorDescription: z.string(),
        fromKesimAlaniId: z.string(),
        fromKesimAlaniName: z.string(),
        toKesimAlaniId: z.string(),
        toKesimAlaniName: z.string(),
        removedFromSource: z.boolean(),
        shareCount: z.number().int().min(1),
        createdAt: z.string(),
      })).min(1),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid entries", details: parsed.error.issues });
      return;
    }
    const { entries } = parsed.data;
    await db.insert(donationTransfersTable).values(entries);
    res.json({ success: true, count: entries.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("POST /donation-transfers error:", message);
    res.status(500).json({ error: message });
  }
});

router.get("/projects/:projectId/transfer-log", async (req, res) => {
  try {
    const { projectId } = req.params;
    const logs = await db.select().from(donationTransfersTable)
      .where(eq(donationTransfersTable.projectId, projectId))
      .orderBy(desc(donationTransfersTable.createdAt));
    res.json(logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`GET /projects/${req.params.projectId}/transfer-log error:`, message);
    res.status(500).json({ error: message });
  }
});

export default router;
