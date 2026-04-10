import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  kesimAlanlariTable,
  donationsTable,
  donationTagsTable,
} from "@workspace/db/schema";
import { eq, isNull, and, sql, inArray, ilike, or, asc } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../middleware/error-handler";
import { ERROR_MESSAGES } from "../lib/constants";
import { refreshProjectStats } from "./projects";

const router: IRouter = Router();

router.get("/projects/:id/donations", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 5000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const donationType = typeof req.query.donationType === "string" ? req.query.donationType.trim() : "";
  const birim = typeof req.query.birim === "string" ? req.query.birim.trim() : "";
  const temsilci = typeof req.query.temsilci === "string" ? req.query.temsilci.trim() : "";
  const kesimAlaniId = typeof req.query.kesimAlaniId === "string" ? req.query.kesimAlaniId.trim() : "";
  const aiCategory = typeof req.query.aiCategory === "string" ? req.query.aiCategory.trim() : "";
  const ozellik = typeof req.query.ozellik === "string" ? req.query.ozellik.trim() : "";
  const fiyat = typeof req.query.fiyat === "string" ? req.query.fiyat.trim() : "";
  const yerTalebi = typeof req.query.yerTalebi === "string" ? req.query.yerTalebi.trim() : "";
  const gunTalebi = typeof req.query.gunTalebi === "string" ? req.query.gunTalebi.trim() : "";
  const ilkHayvan = typeof req.query.ilkHayvan === "string" ? req.query.ilkHayvan.trim() : "";
  const safi = typeof req.query.safi === "string" ? req.query.safi.trim() : "";
  const notesFilter = typeof req.query.notesFilter === "string" ? req.query.notesFilter.trim() : "";
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "sortOrder";
  const sortDir = typeof req.query.sortDir === "string" && req.query.sortDir === "desc" ? "desc" : "asc";

  const kaRows = await db.select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  if (kaRows.length === 0) {
    res.json({ items: [], total: 0, kesimAlanlari: [] });
    return;
  }

  const kaIds = kaRows.map(k => k.id);
  const kaNameMap: Record<string, string> = {};
  for (const k of kaRows) kaNameMap[k.id] = k.name;

  const conditions: ReturnType<typeof eq>[] = [
    inArray(donationsTable.kesimAlaniId, kaIds),
    isNull(donationsTable.deletedAt),
  ];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(donationsTable.name, pattern),
        ilike(donationsTable.description, pattern),
        ilike(donationsTable.vekalet, pattern),
        ilike(donationsTable.notes, pattern),
        ilike(donationsTable.phone, pattern),
        ilike(donationsTable.birim, pattern),
        ilike(donationsTable.temsilci, pattern),
        ilike(donationsTable.ozellik, pattern),
        ilike(donationsTable.fiyat, pattern),
        ilike(donationsTable.yerTalebi, pattern),
        ilike(donationsTable.gunTalebi, pattern),
        ilike(donationsTable.ilkHayvan, pattern),
        ilike(donationsTable.safi, pattern),
      )!,
    );
  }

  if (donationType) conditions.push(eq(donationsTable.donationType, donationType));
  if (birim) conditions.push(eq(donationsTable.birim, birim));
  if (temsilci) conditions.push(eq(donationsTable.temsilci, temsilci));
  if (kesimAlaniId) conditions.push(eq(donationsTable.kesimAlaniId, kesimAlaniId));
  if (ozellik) conditions.push(eq(donationsTable.ozellik, ozellik));
  if (fiyat) conditions.push(eq(donationsTable.fiyat, fiyat));
  if (yerTalebi) conditions.push(eq(donationsTable.yerTalebi, yerTalebi));
  if (gunTalebi) conditions.push(eq(donationsTable.gunTalebi, gunTalebi));
  if (ilkHayvan) conditions.push(eq(donationsTable.ilkHayvan, ilkHayvan));
  if (safi) conditions.push(eq(donationsTable.safi, safi));

  if (status === "excluded") {
    conditions.push(eq(donationsTable.excluded, true));
  } else if (status === "active") {
    conditions.push(eq(donationsTable.excluded, false));
  }

  if (aiCategory) {
    conditions.push(sql`${donationsTable.aiCategories}::text ILIKE ${'%' + aiCategory + '%'}`);
  }

  if (notesFilter) {
    const noteTerms = notesFilter.split(",").map((t: string) => t.trim()).filter(Boolean);
    for (const term of noteTerms) {
      conditions.push(ilike(donationsTable.notes, `%${term}%`));
    }
  }

  const whereClause = and(...conditions)!;

  const sortColumnMap: Record<string, string> = {
    name: "name",
    sortOrder: "sort_order",
    donationType: "donation_type",
    shareCount: "share_count",
    birim: "birim",
    temsilci: "temsilci",
    kesimAlaniId: "kesim_alani_id",
    vekalet: "vekalet",
    ozellik: "ozellik",
    fiyat: "fiyat",
    yerTalebi: "yer_talebi",
    gunTalebi: "gun_talebi",
    ilkHayvan: "ilk_hayvan",
    safi: "safi",
  };
  const sortCol = sortColumnMap[sortBy] || "sort_order";
  const sortDirection = sortDir === "desc" ? sql`DESC` : sql`ASC`;

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(donationsTable).where(whereClause),
    db.select().from(donationsTable).where(whereClause)
      .orderBy(sql`${sql.raw(sortCol)} ${sortDirection}`, asc(donationsTable.sortOrder))
      .limit(limit).offset(offset),
  ]);

  const total = countResult[0]?.count ?? 0;

  const donationIds = rows.map(r => r.id);
  let tagsByDonation: Record<string, string[]> = {};
  if (donationIds.length > 0) {
    const tags = await db.select({
      donationId: donationTagsTable.donationId,
      tagId: donationTagsTable.tagId,
    }).from(donationTagsTable).where(inArray(donationTagsTable.donationId, donationIds));

    for (const t of tags) {
      if (!tagsByDonation[t.donationId]) tagsByDonation[t.donationId] = [];
      tagsByDonation[t.donationId].push(t.tagId);
    }
  }

  const items = rows.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    donationType: d.donationType,
    shareCount: d.shareCount,
    vekalet: d.vekalet,
    notes: d.notes,
    phone: d.phone || "",
    birim: d.birim || "",
    temsilci: d.temsilci || "",
    ozellik: d.ozellik || "",
    fiyat: d.fiyat || "",
    yerTalebi: d.yerTalebi || "",
    gunTalebi: d.gunTalebi || "",
    ilkHayvan: d.ilkHayvan || "",
    safi: d.safi || "",
    excluded: d.excluded,
    sortOrder: d.sortOrder,
    kesimAlaniId: d.kesimAlaniId,
    kesimAlaniName: kaNameMap[d.kesimAlaniId] || "",
    tags: tagsByDonation[d.id] || [],
    aiCategories: d.aiCategories ? JSON.parse(d.aiCategories) : [],
    aiWarnings: d.aiWarnings || "",
  }));

  res.json({ items, total, kesimAlanlari: kaRows });
}));

router.get("/projects/:id/donations/stats", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const result = await db.execute(sql`
    SELECT
      COUNT(d.id)::int AS total,
      COUNT(d.id) FILTER (WHERE d.excluded = false)::int AS active,
      COUNT(d.id) FILTER (WHERE d.excluded = true)::int AS excluded,
      COALESCE(SUM(d.share_count) FILTER (WHERE d.excluded = false), 0)::int AS total_shares,
      COUNT(DISTINCT d.birim) FILTER (WHERE d.birim != '' AND d.excluded = false)::int AS birim_count,
      COUNT(DISTINCT d.temsilci) FILTER (WHERE d.temsilci != '' AND d.excluded = false)::int AS temsilci_count,
      COUNT(DISTINCT d.donation_type) FILTER (WHERE d.donation_type != '' AND d.excluded = false)::int AS type_count
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ka.project_id = ${projectId}
      AND ka.deleted_at IS NULL
      AND d.deleted_at IS NULL
  `);

  const stats = result.rows[0] || { total: 0, active: 0, excluded: 0, total_shares: 0 };

  const birimDist = await db.execute(sql`
    SELECT d.birim, COUNT(*)::int AS count, SUM(d.share_count)::int AS shares
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ka.project_id = ${projectId} AND ka.deleted_at IS NULL AND d.deleted_at IS NULL AND d.excluded = false AND d.birim != ''
    GROUP BY d.birim ORDER BY count DESC LIMIT 50
  `);

  const temsilciDist = await db.execute(sql`
    SELECT d.temsilci, COUNT(*)::int AS count, SUM(d.share_count)::int AS shares
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ka.project_id = ${projectId} AND ka.deleted_at IS NULL AND d.deleted_at IS NULL AND d.excluded = false AND d.temsilci != ''
    GROUP BY d.temsilci ORDER BY count DESC LIMIT 50
  `);

  const typeDist = await db.execute(sql`
    SELECT d.donation_type AS type, COUNT(*)::int AS count, SUM(d.share_count)::int AS shares
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ka.project_id = ${projectId} AND ka.deleted_at IS NULL AND d.deleted_at IS NULL AND d.excluded = false AND d.donation_type != ''
    GROUP BY d.donation_type ORDER BY count DESC LIMIT 50
  `);

  const kaDist = await db.execute(sql`
    SELECT ka.id, ka.name, COUNT(d.id)::int AS count, SUM(d.share_count)::int AS shares
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ka.project_id = ${projectId} AND ka.deleted_at IS NULL AND d.deleted_at IS NULL AND d.excluded = false
    GROUP BY ka.id, ka.name ORDER BY ka.name
  `);

  const multiLocResult = await db.execute(sql`
    SELECT d.vekalet, COUNT(DISTINCT d.kesim_alani_id)::int AS loc_count
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ka.project_id = ${projectId}
      AND ka.deleted_at IS NULL AND d.deleted_at IS NULL
      AND d.excluded = false AND d.vekalet IS NOT NULL AND d.vekalet != ''
    GROUP BY d.vekalet
    HAVING COUNT(DISTINCT d.kesim_alani_id) > 1
  `);
  const multiLocationVekalets = multiLocResult.rows.map((r: Record<string, unknown>) => String(r.vekalet));

  const distQuery = (col: string) => db.execute(sql`
    SELECT ${sql.raw(`d.${col}`)} AS value, COUNT(*)::int AS count
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ka.project_id = ${projectId} AND ka.deleted_at IS NULL AND d.deleted_at IS NULL AND d.excluded = false AND ${sql.raw(`d.${col}`)} != ''
    GROUP BY ${sql.raw(`d.${col}`)} ORDER BY count DESC LIMIT 50
  `);

  const [ozellikDist, fiyatDist, yerTalebiDist, gunTalebiDist, ilkHayvanDist, safiDist] = await Promise.all([
    distQuery("ozellik"),
    distQuery("fiyat"),
    distQuery("yer_talebi"),
    distQuery("gun_talebi"),
    distQuery("ilk_hayvan"),
    distQuery("safi"),
  ]);

  res.json({
    ...stats,
    birimDistribution: birimDist.rows,
    temsilciDistribution: temsilciDist.rows,
    typeDistribution: typeDist.rows,
    kesimAlaniDistribution: kaDist.rows,
    multiLocationVekalets,
    ozellikDistribution: ozellikDist.rows.map((r: Record<string, unknown>) => ({ ozellik: String(r.value), count: Number(r.count) })),
    fiyatDistribution: fiyatDist.rows.map((r: Record<string, unknown>) => ({ fiyat: String(r.value), count: Number(r.count) })),
    yerTalebiDistribution: yerTalebiDist.rows.map((r: Record<string, unknown>) => ({ yerTalebi: String(r.value), count: Number(r.count) })),
    gunTalebiDistribution: gunTalebiDist.rows.map((r: Record<string, unknown>) => ({ gunTalebi: String(r.value), count: Number(r.count) })),
    ilkHayvanDistribution: ilkHayvanDist.rows.map((r: Record<string, unknown>) => ({ ilkHayvan: String(r.value), count: Number(r.count) })),
    safiDistribution: safiDist.rows.map((r: Record<string, unknown>) => ({ safi: String(r.value), count: Number(r.count) })),
  });
}));

const bulkImportSchema = z.object({
  kesimAlaniId: z.string().min(1).optional(),
  donations: z.array(z.object({
    id: z.string().min(1),
    name: z.string().default(""),
    description: z.string().default(""),
    donationType: z.string().default(""),
    shareCount: z.number().int().min(1).default(1),
    vekalet: z.string().default(""),
    notes: z.string().default(""),
    phone: z.string().default(""),
    birim: z.string().default(""),
    temsilci: z.string().default(""),
    ozellik: z.string().default(""),
    fiyat: z.string().default(""),
    yerTalebi: z.string().default(""),
    gunTalebi: z.string().default(""),
    ilkHayvan: z.string().default(""),
    safi: z.string().default(""),
    kesimAlaniId: z.string().min(1).optional(),
  })).min(1).max(10000),
});

router.post("/projects/:id/donations/bulk-import", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const parsed = bulkImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { donations, kesimAlaniId: topLevelKaId } = parsed.data;

  let defaultKaId: string | undefined;
  if (topLevelKaId) {
    const [validKA] = await db.select({ id: kesimAlanlariTable.id })
      .from(kesimAlanlariTable)
      .where(and(
        eq(kesimAlanlariTable.id, topLevelKaId),
        eq(kesimAlanlariTable.projectId, projectId),
        isNull(kesimAlanlariTable.deletedAt),
      ));
    if (validKA) defaultKaId = validKA.id;
  }

  if (!defaultKaId) {
    const POOL_KA_NAME = "__havuz__";
    const [existingPoolKA] = await db.select({ id: kesimAlanlariTable.id })
      .from(kesimAlanlariTable)
      .where(and(
        eq(kesimAlanlariTable.name, POOL_KA_NAME),
        eq(kesimAlanlariTable.projectId, projectId),
        isNull(kesimAlanlariTable.deletedAt),
      ));
    if (existingPoolKA) {
      defaultKaId = existingPoolKA.id;
    } else {
      const newId = crypto.randomUUID();
      await db.insert(kesimAlanlariTable).values({
        id: newId,
        projectId,
        name: POOL_KA_NAME,
        createdAt: new Date(),
      });
      defaultKaId = newId;
    }
  }

  const donationsWithKa = donations.map(d => ({
    ...d,
    kesimAlaniId: d.kesimAlaniId || defaultKaId!,
  }));

  const kaIds = [...new Set(donationsWithKa.map(d => d.kesimAlaniId))];
  const validKAs = await db.select({ id: kesimAlanlariTable.id })
    .from(kesimAlanlariTable)
    .where(and(
      inArray(kesimAlanlariTable.id, kaIds),
      eq(kesimAlanlariTable.projectId, projectId),
      isNull(kesimAlanlariTable.deletedAt),
    ));
  const validKAIds = new Set(validKAs.map(k => k.id));

  const sortOrderCounts = kaIds.length > 0
    ? await db.select({
        kesimAlaniId: donationsTable.kesimAlaniId,
        maxSort: sql<number>`MAX(${donationsTable.sortOrder})::int`,
      })
      .from(donationsTable)
      .where(and(
        inArray(donationsTable.kesimAlaniId, kaIds),
        isNull(donationsTable.deletedAt),
      ))
      .groupBy(donationsTable.kesimAlaniId)
    : [];
  const sortOffsets: Record<string, number> = {};
  for (const row of sortOrderCounts) {
    sortOffsets[row.kesimAlaniId] = (row.maxSort || 0) + 1;
  }

  const validDonations = donationsWithKa.filter(d => validKAIds.has(d.kesimAlaniId));
  if (validDonations.length === 0) {
    res.status(400).json({ error: "Geçerli kesim alanı bulunamadı" });
    return;
  }

  const kaCounters: Record<string, number> = {};
  const CHUNK_SIZE = 200;
  let inserted = 0;

  for (let i = 0; i < validDonations.length; i += CHUNK_SIZE) {
    const chunk = validDonations.slice(i, i + CHUNK_SIZE);
    const values = chunk.map(d => {
      const kaId = d.kesimAlaniId;
      if (kaCounters[kaId] === undefined) kaCounters[kaId] = sortOffsets[kaId] || 0;
      const sortOrder = kaCounters[kaId]++;
      return {
        id: d.id,
        kesimAlaniId: kaId,
        name: d.name,
        description: d.description,
        donationType: d.donationType,
        shareCount: d.shareCount,
        vekalet: d.vekalet,
        notes: d.notes,
        phone: d.phone,
        birim: d.birim,
        temsilci: d.temsilci,
        ozellik: d.ozellik,
        fiyat: d.fiyat,
        yerTalebi: d.yerTalebi,
        gunTalebi: d.gunTalebi,
        ilkHayvan: d.ilkHayvan,
        safi: d.safi,
        sortOrder,
        excluded: false,
        updatedAt: new Date(),
      };
    });

    const insertResult = await db.insert(donationsTable).values(values).onConflictDoNothing().returning({ id: donationsTable.id });
    inserted += insertResult.length;
  }

  refreshProjectStats();
  res.status(201).json({ success: true, inserted });
}));

const transferSchema = z.object({
  donationIds: z.array(z.string()).min(1).max(10000),
  targetKesimAlaniId: z.string().min(1),
});

router.post("/projects/:id/donations/transfer", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { donationIds, targetKesimAlaniId } = parsed.data;

  const [targetKA] = await db.select()
    .from(kesimAlanlariTable)
    .where(and(
      eq(kesimAlanlariTable.id, targetKesimAlaniId),
      eq(kesimAlanlariTable.projectId, projectId),
      isNull(kesimAlanlariTable.deletedAt),
    ));
  if (!targetKA) {
    res.status(404).json({ error: ERROR_MESSAGES.TARGET_KESIM_NOT_FOUND });
    return;
  }

  const projectKAIds = await db.select({ id: kesimAlanlariTable.id })
    .from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.projectId, projectId));
  const validKAIds = new Set(projectKAIds.map(k => k.id));

  const maxSortResult = await db.execute(sql`
    SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort
    FROM donations
    WHERE kesim_alani_id = ${targetKesimAlaniId} AND deleted_at IS NULL
  `);
  let nextSort = ((maxSortResult.rows[0] as { max_sort: number })?.max_sort ?? -1) + 1;

  const CHUNK = 500;
  let movedCount = 0;
  for (let i = 0; i < donationIds.length; i += CHUNK) {
    const chunk = donationIds.slice(i, i + CHUNK);
    const result = await db.update(donationsTable)
      .set({ kesimAlaniId: targetKesimAlaniId, updatedAt: new Date() })
      .where(and(
        inArray(donationsTable.id, chunk),
        inArray(donationsTable.kesimAlaniId, [...validKAIds]),
        isNull(donationsTable.deletedAt),
      ))
      .returning({ id: donationsTable.id });

    if (result.length > 0) {
      const caseParts = result.map((r, idx) =>
        sql`WHEN ${r.id} THEN ${nextSort + idx}`
      );
      const ids = result.map(r => r.id);
      await db.execute(sql`
        UPDATE donations SET sort_order = CASE id ${sql.join(caseParts, sql` `)} END
        WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
      `);
      nextSort += result.length;
    }
    movedCount += result.length;
  }

  refreshProjectStats();
  res.json({ success: true, moved: movedCount });
}));

const bulkUpdateSchema = z.object({
  donationIds: z.array(z.string()).min(1).max(10000),
  action: z.enum(["exclude", "include", "delete"]),
});

router.post("/projects/:id/donations/bulk-action", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const parsed = bulkUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { donationIds, action } = parsed.data;

  const projectKAIds = await db.select({ id: kesimAlanlariTable.id })
    .from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.projectId, projectId));
  const validKAIds = projectKAIds.map(k => k.id);

  const CHUNK = 500;
  let affected = 0;

  for (let i = 0; i < donationIds.length; i += CHUNK) {
    const chunk = donationIds.slice(i, i + CHUNK);
    const scopedWhere = and(
      inArray(donationsTable.id, chunk),
      inArray(donationsTable.kesimAlaniId, validKAIds),
      isNull(donationsTable.deletedAt),
    );
    let result;
    if (action === "exclude") {
      result = await db.update(donationsTable)
        .set({ excluded: true, updatedAt: new Date() })
        .where(scopedWhere)
        .returning({ id: donationsTable.id });
    } else if (action === "include") {
      result = await db.update(donationsTable)
        .set({ excluded: false, updatedAt: new Date() })
        .where(scopedWhere)
        .returning({ id: donationsTable.id });
    } else {
      result = await db.update(donationsTable)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(scopedWhere)
        .returning({ id: donationsTable.id });
    }
    affected += result.length;
  }

  refreshProjectStats();
  res.json({ success: true, affected });
}));

router.post("/projects/:id/donations/vekalet-check", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const body = req.body;
  const vekalets: string[] = Array.isArray(body?.vekalets)
    ? body.vekalets.map((v: unknown) => String(v).trim()).filter(Boolean)
    : typeof body?.vekalets === "string"
      ? body.vekalets.split(",").map((v: string) => v.trim()).filter(Boolean)
      : [];

  if (vekalets.length === 0) {
    res.json({ conflicts: [] });
    return;
  }

  const kaRows = await db.select({ id: kesimAlanlariTable.id })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  if (kaRows.length === 0) {
    res.json({ conflicts: [] });
    return;
  }

  const kaIds = kaRows.map(k => k.id);

  const CHUNK = 500;
  const allConflicts: Array<{ vekalet: string; id: string; name: string; kesimAlaniId: string }> = [];
  for (let i = 0; i < vekalets.length; i += CHUNK) {
    const chunk = vekalets.slice(i, i + CHUNK);
    const existing = await db.select({
      vekalet: donationsTable.vekalet,
      id: donationsTable.id,
      name: donationsTable.name,
      kesimAlaniId: donationsTable.kesimAlaniId,
    }).from(donationsTable).where(and(
      inArray(donationsTable.kesimAlaniId, kaIds),
      isNull(donationsTable.deletedAt),
      inArray(donationsTable.vekalet, chunk),
    ));
    allConflicts.push(...existing);
  }

  res.json({ conflicts: allConflicts });
}));

export default router;
