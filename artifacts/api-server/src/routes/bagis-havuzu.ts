import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  kesimAlanlariTable,
  donationsTable,
  donationTagsTable,
  customTagsTable,
  animalGroupDonationsTable,
  automationRulesTable,
} from "@workspace/db/schema";
import { eq, isNull, and, sql, inArray, ilike, or, asc, desc, notInArray, ne, gte, lte, not } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../middleware/error-handler";
import { ERROR_MESSAGES } from "../lib/constants";
import { refreshProjectStats } from "./projects";
import { executeRules } from "../services/rule-engine.service";
import { invalidateKACache } from "../services/kesim-alani.service";

const router: IRouter = Router();

function parseMultiValue(val: unknown): string[] {
  if (typeof val !== "string" || !val.trim()) return [];
  return val.split(",").map(v => v.trim()).filter(Boolean);
}

function buildStatsFilterSQL(projectId: string, query: Record<string, unknown>) {
  const parts: ReturnType<typeof sql>[] = [
    sql`ka.project_id = ${projectId}`,
    sql`ka.deleted_at IS NULL`,
    sql`d.deleted_at IS NULL`,
  ];

  const status = typeof query.status === "string" ? query.status : "";
  if (status === "excluded") parts.push(sql`d.excluded = true`);
  else if (status === "active") parts.push(sql`d.excluded = false`);

  const excludeFieldsArr = parseMultiValue(query.excludeFields);
  const excludeSet = new Set(excludeFieldsArr);

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const pattern = `%${search}%`;
    parts.push(sql`(d.name ILIKE ${pattern} OR d.description ILIKE ${pattern} OR d.vekalet ILIKE ${pattern} OR d.notes ILIKE ${pattern} OR d.phone ILIKE ${pattern} OR d.birim ILIKE ${pattern} OR d.temsilci ILIKE ${pattern} OR d.ozellik ILIKE ${pattern} OR d.fiyat ILIKE ${pattern} OR d.yer_talebi ILIKE ${pattern} OR d.gun_talebi ILIKE ${pattern} OR d.ilk_hayvan ILIKE ${pattern} OR d.safi ILIKE ${pattern})`);
  }

  function addMulti(col: string, values: string[], fieldName: string) {
    if (values.length === 0) return;
    if (excludeSet.has(fieldName)) {
      if (values.length === 1) {
        parts.push(sql`(${sql.raw(`d.${col}`)} IS NULL OR ${sql.raw(`d.${col}`)} = '' OR ${sql.raw(`d.${col}`)} != ${values[0]})`);
      } else {
        parts.push(sql`(${sql.raw(`d.${col}`)} IS NULL OR ${sql.raw(`d.${col}`)} = '' OR ${sql.raw(`d.${col}`)} NOT IN (${sql.join(values.map(v => sql`${v}`), sql`, `)}))`);
      }
    } else {
      if (values.length === 1) parts.push(sql`${sql.raw(`d.${col}`)} = ${values[0]}`);
      else parts.push(sql`${sql.raw(`d.${col}`)} IN (${sql.join(values.map(v => sql`${v}`), sql`, `)})`);
    }
  }

  addMulti("donation_type", parseMultiValue(query.donationType), "donationType");
  addMulti("birim", parseMultiValue(query.birim), "birim");
  addMulti("temsilci", parseMultiValue(query.temsilci), "temsilci");
  addMulti("ozellik", parseMultiValue(query.ozellik), "ozellik");
  addMulti("fiyat", parseMultiValue(query.fiyat), "fiyat");
  addMulti("yer_talebi", parseMultiValue(query.yerTalebi), "yerTalebi");
  addMulti("gun_talebi", parseMultiValue(query.gunTalebi), "gunTalebi");
  addMulti("ilk_hayvan", parseMultiValue(query.ilkHayvan), "ilkHayvan");
  addMulti("safi", parseMultiValue(query.safi), "safi");

  const kesimAlaniId = typeof query.kesimAlaniId === "string" ? query.kesimAlaniId.trim() : "";
  if (kesimAlaniId) parts.push(sql`d.kesim_alani_id = ${kesimAlaniId}`);

  const tagIdValues = parseMultiValue(query.tagIds);
  if (tagIdValues.length > 0) {
    const tagSub = sql`d.id IN (SELECT dt.donation_id FROM donation_tags dt WHERE dt.tag_id IN (${sql.join(tagIdValues.map(t => sql`${t}`), sql`, `)}))`;
    if (excludeSet.has("tags")) {
      parts.push(sql`NOT (${tagSub})`);
    } else {
      parts.push(tagSub);
    }
  }

  const shareCountMin = query.shareCountMin ? Number(query.shareCountMin) : null;
  const shareCountMax = query.shareCountMax ? Number(query.shareCountMax) : null;
  if (shareCountMin !== null && !isNaN(shareCountMin)) parts.push(sql`d.share_count >= ${shareCountMin}`);
  if (shareCountMax !== null && !isNaN(shareCountMax)) parts.push(sql`d.share_count <= ${shareCountMax}`);

  const aiCategory = typeof query.aiCategory === "string" ? query.aiCategory.trim() : "";
  if (aiCategory) {
    if (excludeSet.has("aiCategory")) {
      parts.push(sql`(d.ai_categories IS NULL OR d.ai_categories::text = '[]' OR NOT (d.ai_categories::text ILIKE ${'%' + aiCategory + '%'}))`);
    } else {
      parts.push(sql`d.ai_categories::text ILIKE ${'%' + aiCategory + '%'}`);
    }
  }

  const notesFilter = typeof query.notesFilter === "string" ? query.notesFilter.trim() : "";
  if (notesFilter) {
    const noteTerms = notesFilter.split(",").map((t: string) => t.trim()).filter(Boolean);
    for (const term of noteTerms) {
      parts.push(sql`d.notes ILIKE ${'%' + term + '%'}`);
    }
  }

  const dateField = typeof query.dateField === "string" ? query.dateField.trim() : "updatedAt";
  const dateFrom = typeof query.dateFrom === "string" ? query.dateFrom.trim() : "";
  const dateTo = typeof query.dateTo === "string" ? query.dateTo.trim() : "";

  if (dateField === "transfer" && (dateFrom || dateTo)) {
    const dtParts: ReturnType<typeof sql>[] = [sql`dt2.donation_id = d.id`];
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!isNaN(d.getTime())) dtParts.push(sql`dt2.created_at >= ${d}`);
    }
    if (dateTo) {
      const d = new Date(dateTo + "T23:59:59.999Z");
      if (!isNaN(d.getTime())) dtParts.push(sql`dt2.created_at <= ${d}`);
    }
    if (dtParts.length > 1) {
      parts.push(sql`EXISTS (SELECT 1 FROM donation_transfers dt2 WHERE ${sql.join(dtParts, sql` AND `)})`);
    }
  } else {
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!isNaN(d.getTime())) parts.push(sql`d.updated_at >= ${d}`);
    }
    if (dateTo) {
      const d = new Date(dateTo + "T23:59:59.999Z");
      if (!isNaN(d.getTime())) parts.push(sql`d.updated_at <= ${d}`);
    }
  }

  return sql.join(parts, sql` AND `);
}

router.get("/projects/:id/donations", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 5000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const donationTypes = parseMultiValue(req.query.donationType);
  const birimValues = parseMultiValue(req.query.birim);
  const temsilciValues = parseMultiValue(req.query.temsilci);
  const kesimAlaniId = typeof req.query.kesimAlaniId === "string" ? req.query.kesimAlaniId.trim() : "";
  const aiCategory = typeof req.query.aiCategory === "string" ? req.query.aiCategory.trim() : "";
  const ozellikValues = parseMultiValue(req.query.ozellik);
  const fiyatValues = parseMultiValue(req.query.fiyat);
  const yerTalebiValues = parseMultiValue(req.query.yerTalebi);
  const gunTalebiValues = parseMultiValue(req.query.gunTalebi);
  const ilkHayvanValues = parseMultiValue(req.query.ilkHayvan);
  const safiValues = parseMultiValue(req.query.safi);
  const tagIdValues = parseMultiValue(req.query.tagIds);
  const notesFilter = typeof req.query.notesFilter === "string" ? req.query.notesFilter.trim() : "";
  const sortByRaw = typeof req.query.sortBy === "string" ? req.query.sortBy : "sortOrder";
  const sortDir = typeof req.query.sortDir === "string" && req.query.sortDir === "desc" ? "desc" : "asc";

  const shareCountMin = req.query.shareCountMin ? Number(req.query.shareCountMin) : null;
  const shareCountMax = req.query.shareCountMax ? Number(req.query.shareCountMax) : null;
  const excludeFields = parseMultiValue(req.query.excludeFields);
  const excludeSet = new Set(excludeFields);
  const dateField = typeof req.query.dateField === "string" ? req.query.dateField.trim() : "updatedAt";
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom.trim() : "";
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo.trim() : "";
  const sortBy2 = typeof req.query.sortBy2 === "string" ? req.query.sortBy2 : "";
  const sortDir2 = typeof req.query.sortDir2 === "string" && req.query.sortDir2 === "desc" ? "desc" : "asc";
  const sortBy3 = typeof req.query.sortBy3 === "string" ? req.query.sortBy3 : "";
  const sortDir3 = typeof req.query.sortDir3 === "string" && req.query.sortDir3 === "desc" ? "desc" : "asc";

  const kaRows = await db.select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  if (kaRows.length === 0) {
    res.json({ items: [], total: 0, kesimAlanlari: [], allFilteredIds: [] });
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

  function addMultiFilter(col: ReturnType<typeof eq> extends infer T ? Parameters<typeof eq>[0] : never, values: string[], fieldName: string) {
    if (values.length === 0) return;
    if (excludeSet.has(fieldName)) {
      conditions.push(
        or(
          sql`${col} IS NULL`,
          eq(col, ""),
          values.length === 1 ? ne(col, values[0]) : notInArray(col, values),
        )!
      );
    } else {
      if (values.length === 1) conditions.push(eq(col, values[0]));
      else conditions.push(inArray(col, values));
    }
  }

  addMultiFilter(donationsTable.donationType, donationTypes, "donationType");
  addMultiFilter(donationsTable.birim, birimValues, "birim");
  addMultiFilter(donationsTable.temsilci, temsilciValues, "temsilci");
  addMultiFilter(donationsTable.ozellik, ozellikValues, "ozellik");
  addMultiFilter(donationsTable.fiyat, fiyatValues, "fiyat");
  addMultiFilter(donationsTable.yerTalebi, yerTalebiValues, "yerTalebi");
  addMultiFilter(donationsTable.gunTalebi, gunTalebiValues, "gunTalebi");
  addMultiFilter(donationsTable.ilkHayvan, ilkHayvanValues, "ilkHayvan");
  addMultiFilter(donationsTable.safi, safiValues, "safi");

  if (kesimAlaniId) conditions.push(eq(donationsTable.kesimAlaniId, kesimAlaniId));

  if (tagIdValues.length > 0) {
    const tagSql = sql`${donationsTable.id} IN (
      SELECT dt.donation_id FROM donation_tags dt
      WHERE dt.tag_id IN (${sql.join(tagIdValues.map(t => sql`${t}`), sql`, `)})
    )`;
    if (excludeSet.has("tags")) {
      conditions.push(not(tagSql));
    } else {
      conditions.push(tagSql);
    }
  }

  if (shareCountMin !== null && !isNaN(shareCountMin)) {
    conditions.push(gte(donationsTable.shareCount, shareCountMin));
  }
  if (shareCountMax !== null && !isNaN(shareCountMax)) {
    conditions.push(lte(donationsTable.shareCount, shareCountMax));
  }

  if (dateField === "transfer" && (dateFrom || dateTo)) {
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo + "T23:59:59.999Z") : null;
    const fromValid = fromDate && !isNaN(fromDate.getTime());
    const toValid = toDate && !isNaN(toDate.getTime());
    if (fromValid && toValid) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM donation_transfers dt2
        WHERE dt2.donation_id = ${donationsTable.id}
          AND dt2.created_at >= ${fromDate}
          AND dt2.created_at <= ${toDate}
      )`);
    } else if (fromValid) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM donation_transfers dt2
        WHERE dt2.donation_id = ${donationsTable.id}
          AND dt2.created_at >= ${fromDate}
      )`);
    } else if (toValid) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM donation_transfers dt2
        WHERE dt2.donation_id = ${donationsTable.id}
          AND dt2.created_at <= ${toDate}
      )`);
    }
  } else {
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!isNaN(d.getTime())) conditions.push(gte(donationsTable.updatedAt, d));
    }
    if (dateTo) {
      const d = new Date(dateTo + "T23:59:59.999Z");
      if (!isNaN(d.getTime())) conditions.push(lte(donationsTable.updatedAt, d));
    }
  }

  if (status === "excluded") {
    conditions.push(eq(donationsTable.excluded, true));
  } else if (status === "active") {
    conditions.push(eq(donationsTable.excluded, false));
  }

  if (aiCategory) {
    if (excludeSet.has("aiCategory")) {
      conditions.push(
        or(
          sql`${donationsTable.aiCategories} IS NULL`,
          sql`${donationsTable.aiCategories}::text = '[]'`,
          sql`NOT (${donationsTable.aiCategories}::text ILIKE ${'%' + aiCategory + '%'})`,
        )!
      );
    } else {
      conditions.push(sql`${donationsTable.aiCategories}::text ILIKE ${'%' + aiCategory + '%'}`);
    }
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
    description: "description",
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
    notes: "notes",
    updatedAt: "updated_at",
  };

  const sortLevels = [
    { key: sortByRaw, dir: sortDir },
    { key: sortBy2, dir: sortDir2 },
    { key: sortBy3, dir: sortDir3 },
  ];
  const sortParts: ReturnType<typeof sql>[] = [];
  const usedCols = new Set<string>();
  for (const level of sortLevels) {
    const col = sortColumnMap[level.key];
    if (col && !usedCols.has(col)) {
      usedCols.add(col);
      sortParts.push(level.dir === "desc"
        ? sql`${sql.raw(`"${col}"`)} DESC NULLS LAST`
        : sql`${sql.raw(`"${col}"`)} ASC NULLS LAST`
      );
    }
  }
  if (!usedCols.has("sort_order")) {
    sortParts.push(sql`"sort_order" ASC`);
  }

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(donationsTable).where(whereClause),
    db.select().from(donationsTable).where(whereClause)
      .orderBy(...sortParts)
      .limit(limit).offset(offset),
  ]);

  const total = countResult[0]?.count ?? 0;

  const allIdsResult = total > limit
    ? await db.select({ id: donationsTable.id }).from(donationsTable).where(whereClause)
    : null;
  const allFilteredIds = allIdsResult ? allIdsResult.map(r => r.id) : rows.map(r => r.id);

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
    aiCategories: d.aiCategories ? (() => { try { const p = JSON.parse(d.aiCategories); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } })() : [],
    aiWarnings: d.aiWarnings || "",
    isFlagged: d.isFlagged,
    flagReason: d.flagReason,
  }));

  res.json({ items, total, kesimAlanlari: kaRows, allFilteredIds });
}));

router.get("/projects/:id/donations/stats", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const filterWhere = buildStatsFilterSQL(projectId, req.query as Record<string, unknown>);

  const result = await db.execute(sql`
    SELECT
      COUNT(d.id)::int AS total,
      COUNT(d.id) FILTER (WHERE d.excluded = false)::int AS active,
      COUNT(d.id) FILTER (WHERE d.excluded = true)::int AS excluded,
      COALESCE(SUM(d.share_count), 0)::int AS total_shares,
      COUNT(DISTINCT d.birim) FILTER (WHERE d.birim != '')::int AS birim_count,
      COUNT(DISTINCT d.temsilci) FILTER (WHERE d.temsilci != '')::int AS temsilci_count,
      COUNT(DISTINCT d.donation_type) FILTER (WHERE d.donation_type != '')::int AS type_count
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ${filterWhere}
  `);

  const stats = result.rows[0] || { total: 0, active: 0, excluded: 0, total_shares: 0 };

  const birimDist = await db.execute(sql`
    SELECT d.birim, COUNT(*)::int AS count, SUM(d.share_count)::int AS shares
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ${filterWhere} AND d.birim != ''
    GROUP BY d.birim ORDER BY count DESC LIMIT 50
  `);

  const temsilciDist = await db.execute(sql`
    SELECT d.temsilci, COUNT(*)::int AS count, SUM(d.share_count)::int AS shares
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ${filterWhere} AND d.temsilci != ''
    GROUP BY d.temsilci ORDER BY count DESC LIMIT 50
  `);

  const typeDist = await db.execute(sql`
    SELECT d.donation_type AS type, COUNT(*)::int AS count, SUM(d.share_count)::int AS shares
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ${filterWhere} AND d.donation_type != ''
    GROUP BY d.donation_type ORDER BY count DESC LIMIT 50
  `);

  const kaDist = await db.execute(sql`
    SELECT ka.id, ka.name, COUNT(d.id)::int AS count, SUM(d.share_count)::int AS shares
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ${filterWhere}
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

  const multiLocByNameResult = await db.execute(sql`
    SELECT d.name, COUNT(DISTINCT d.kesim_alani_id)::int AS loc_count, array_agg(DISTINCT d.vekalet) AS vekalets
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ka.project_id = ${projectId}
      AND ka.deleted_at IS NULL AND d.deleted_at IS NULL
      AND d.excluded = false AND d.name IS NOT NULL AND d.name != ''
    GROUP BY d.name
    HAVING COUNT(DISTINCT d.kesim_alani_id) > 1
    LIMIT 100
  `);
  const multiLocationNames = multiLocByNameResult.rows.map((r: Record<string, unknown>) => ({
    name: String(r.name),
    count: Number(r.loc_count),
    vekalets: (r.vekalets as string[]) || [],
  }));

  const transferredCountResult = await db.execute(sql`
    SELECT COUNT(DISTINCT d.id)::int AS transferred
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    JOIN animal_group_donations agd ON agd.donation_id = d.id
    WHERE ka.project_id = ${projectId}
      AND ka.deleted_at IS NULL AND d.deleted_at IS NULL
      AND ka.name != '__havuz__'
  `);
  const transferredToLists = (transferredCountResult.rows[0] as Record<string, unknown>)?.transferred ?? 0;

  const inGroupCountResult = await db.execute(sql`
    SELECT COUNT(DISTINCT d.id)::int AS in_groups
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    JOIN animal_group_donations agd ON agd.donation_id = d.id
    WHERE ka.project_id = ${projectId}
      AND ka.deleted_at IS NULL AND d.deleted_at IS NULL
  `);
  const inGroups = (inGroupCountResult.rows[0] as Record<string, unknown>)?.in_groups ?? 0;

  const DIST_ALLOWED_COLS = new Set(["ozellik", "fiyat", "yer_talebi", "gun_talebi", "ilk_hayvan", "safi"]);
  const distQuery = (col: string) => {
    if (!DIST_ALLOWED_COLS.has(col)) throw new Error(`Invalid dist column: ${col}`);
    return db.execute(sql`
      SELECT ${sql.raw(`d.${col}`)} AS value, COUNT(*)::int AS count
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ${filterWhere} AND ${sql.raw(`d.${col}`)} != ''
      GROUP BY ${sql.raw(`d.${col}`)} ORDER BY count DESC LIMIT 50
    `);
  };

  const [ozellikDist, fiyatDist, yerTalebiDist, gunTalebiDist, ilkHayvanDist, safiDist] = await Promise.all([
    distQuery("ozellik"),
    distQuery("fiyat"),
    distQuery("yer_talebi"),
    distQuery("gun_talebi"),
    distQuery("ilk_hayvan"),
    distQuery("safi"),
  ]);

  const tagCountResult = await db.execute(sql`
    SELECT ct.id, ct.name, ct.color, COUNT(d.id)::int AS count
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    JOIN donation_tags dt ON dt.donation_id = d.id
    JOIN custom_tags ct ON ct.id = dt.tag_id
    WHERE ${filterWhere}
    GROUP BY ct.id, ct.name, ct.color
    ORDER BY count DESC
  `);
  const tagDistribution = tagCountResult.rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    name: String(r.name),
    color: String(r.color || ""),
    count: Number(r.count),
  }));

  res.json({
    ...stats,
    birimDistribution: birimDist.rows,
    temsilciDistribution: temsilciDist.rows,
    typeDistribution: typeDist.rows,
    kesimAlaniDistribution: kaDist.rows,
    multiLocationVekalets,
    multiLocationNames,
    transferredToLists: Number(transferredToLists),
    inGroups: Number(inGroups),
    ozellikDistribution: ozellikDist.rows.map((r: Record<string, unknown>) => ({ ozellik: String(r.value), count: Number(r.count) })),
    fiyatDistribution: fiyatDist.rows.map((r: Record<string, unknown>) => ({ fiyat: String(r.value), count: Number(r.count) })),
    yerTalebiDistribution: yerTalebiDist.rows.map((r: Record<string, unknown>) => ({ yerTalebi: String(r.value), count: Number(r.count) })),
    gunTalebiDistribution: gunTalebiDist.rows.map((r: Record<string, unknown>) => ({ gunTalebi: String(r.value), count: Number(r.count) })),
    ilkHayvanDistribution: ilkHayvanDist.rows.map((r: Record<string, unknown>) => ({ ilkHayvan: String(r.value), count: Number(r.count) })),
    safiDistribution: safiDist.rows.map((r: Record<string, unknown>) => ({ safi: String(r.value), count: Number(r.count) })),
    tagDistribution,
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
  })).min(1).max(50000),
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
  donationIds: z.array(z.string()).min(1).max(50000),
  targetKesimAlaniId: z.string().min(1),
  skipExisting: z.boolean().optional(),
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

  const { donationIds, targetKesimAlaniId, skipExisting } = parsed.data;

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

  const existingIds = new Set<string>();
  const CHUNK = 5000;
  for (let i = 0; i < donationIds.length; i += CHUNK) {
    const chunk = donationIds.slice(i, i + CHUNK);
    const existingInTarget = await db.select({ id: donationsTable.id })
      .from(donationsTable)
      .where(and(
        eq(donationsTable.kesimAlaniId, targetKesimAlaniId),
        isNull(donationsTable.deletedAt),
        inArray(donationsTable.id, chunk),
      ));
    for (const r of existingInTarget) existingIds.add(r.id);
  }
  const alreadyInTarget = existingIds.size;

  let idsToMove = donationIds;
  if (alreadyInTarget > 0 && skipExisting) {
    idsToMove = donationIds.filter(id => !existingIds.has(id));
  }

  if (idsToMove.length === 0 && alreadyInTarget > 0) {
    res.json({ success: true, moved: 0, alreadyInTarget, skipped: alreadyInTarget });
    return;
  }

  const projectKAIds = await db.select({ id: kesimAlanlariTable.id })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));
  const validKAIds = new Set(projectKAIds.map(k => k.id));

  let movedCount = 0;

  await db.transaction(async (tx) => {
    const maxSortResult = await tx.execute(sql`
      SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort
      FROM donations
      WHERE kesim_alani_id = ${targetKesimAlaniId} AND deleted_at IS NULL
    `);
    let nextSort = ((maxSortResult.rows[0] as { max_sort: number })?.max_sort ?? -1) + 1;

    const MOVE_CHUNK = 500;
    for (let i = 0; i < idsToMove.length; i += MOVE_CHUNK) {
      const chunk = idsToMove.slice(i, i + MOVE_CHUNK);
      const result = await tx.update(donationsTable)
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
        await tx.execute(sql`
          UPDATE donations SET sort_order = CASE id ${sql.join(caseParts, sql` `)} END
          WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
        `);
        nextSort += result.length;
      }
      movedCount += result.length;
    }
  });

  let transferredItems: Array<{
    id: string; name: string; description: string; donationType: string;
    shareCount: number; vekalet: string; notes: string;
  }> = [];
  if (movedCount > 0) {
    const FETCH_CHUNK = 500;
    for (let i = 0; i < idsToMove.length; i += FETCH_CHUNK) {
      const chunk = idsToMove.slice(i, i + FETCH_CHUNK);
      const rows = await db.select({
        id: donationsTable.id,
        name: donationsTable.name,
        description: donationsTable.description,
        donationType: donationsTable.donationType,
        shareCount: donationsTable.shareCount,
        vekalet: donationsTable.vekalet,
        notes: donationsTable.notes,
      }).from(donationsTable).where(and(
        inArray(donationsTable.id, chunk),
        eq(donationsTable.kesimAlaniId, targetKesimAlaniId),
        isNull(donationsTable.deletedAt),
      ));
      transferredItems.push(...rows.map(r => ({
        id: r.id,
        name: r.name ?? "",
        description: r.description ?? "",
        donationType: r.donationType ?? "",
        shareCount: r.shareCount ?? 1,
        vekalet: r.vekalet ?? "",
        notes: r.notes ?? "",
      })));
    }
  }

  invalidateKACache();
  refreshProjectStats();
  res.json({ success: true, moved: movedCount, alreadyInTarget, skipped: skipExisting ? alreadyInTarget : 0, transferredItems });
}));

const bulkUpdateSchema = z.object({
  donationIds: z.array(z.string()).min(1).max(50000),
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
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));
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

  invalidateKACache();
  refreshProjectStats();
  res.json({ success: true, affected });
}));

const vekaletCheckSchema = z.object({
  vekalets: z.array(z.string().trim().min(1)).min(1).max(10000),
});

router.post("/projects/:id/donations/vekalet-check", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const parsed = vekaletCheckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.json({ conflicts: [] });
    return;
  }

  const vekalets = parsed.data.vekalets;

  const kaRows = await db.select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  if (kaRows.length === 0) {
    res.json({ conflicts: [] });
    return;
  }

  const kaIds = kaRows.map(k => k.id);
  const kaNameMap: Record<string, string> = {};
  for (const k of kaRows) kaNameMap[k.id] = k.name;

  const CHUNK = 500;
  const allConflicts: Array<{ vekalet: string; id: string; name: string; description: string; kesimAlaniId: string; kesimAlaniName: string }> = [];
  for (let i = 0; i < vekalets.length; i += CHUNK) {
    const chunk = vekalets.slice(i, i + CHUNK);
    const existing = await db.select({
      vekalet: donationsTable.vekalet,
      id: donationsTable.id,
      name: donationsTable.name,
      description: donationsTable.description,
      kesimAlaniId: donationsTable.kesimAlaniId,
    }).from(donationsTable).where(and(
      inArray(donationsTable.kesimAlaniId, kaIds),
      isNull(donationsTable.deletedAt),
      inArray(donationsTable.vekalet, chunk),
    ));
    allConflicts.push(...existing.map(e => ({
      ...e,
      vekalet: e.vekalet || "",
      description: e.description || "",
      kesimAlaniName: kaNameMap[e.kesimAlaniId] || "",
    })));
  }

  res.json({ conflicts: allConflicts });
}));

const bulkTagSchema = z.object({
  donationIds: z.array(z.string()).min(1).max(50000),
  tagId: z.string().min(1),
  action: z.enum(["add", "remove"]).default("add"),
});

router.post("/projects/:id/donations/bulk-tag", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const parsed = bulkTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { donationIds, tagId, action } = parsed.data;

  const [tag] = await db.select().from(customTagsTable).where(eq(customTagsTable.id, tagId));
  if (!tag) {
    res.status(404).json({ error: "Etiket bulunamadı" });
    return;
  }

  const projectKAIds = await db.select({ id: kesimAlanlariTable.id })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));
  const validKAIds = projectKAIds.map(k => k.id);

  if (validKAIds.length === 0) {
    res.json({ success: true, affected: 0 });
    return;
  }

  let affected = 0;
  const CHUNK = 500;

  await db.transaction(async (tx) => {
    for (let i = 0; i < donationIds.length; i += CHUNK) {
      const chunk = donationIds.slice(i, i + CHUNK);
      const validDonations = await tx.select({ id: donationsTable.id })
        .from(donationsTable)
        .where(and(
          inArray(donationsTable.id, chunk),
          inArray(donationsTable.kesimAlaniId, validKAIds),
          isNull(donationsTable.deletedAt),
        ));

      const validIds = validDonations.map(d => d.id);
      if (validIds.length === 0) continue;

      if (action === "add") {
        const values = validIds.map(donationId => ({ donationId, tagId }));
        const result = await tx.insert(donationTagsTable)
          .values(values)
          .onConflictDoNothing()
          .returning({ donationId: donationTagsTable.donationId });
        affected += result.length;
      } else {
        const result = await tx.delete(donationTagsTable)
          .where(and(
            inArray(donationTagsTable.donationId, validIds),
            eq(donationTagsTable.tagId, tagId),
          ))
          .returning({ donationId: donationTagsTable.donationId });
        affected += result.length;
      }
    }
  });

  invalidateKACache();
  res.json({ success: true, affected });
}));

const flagSchema = z.object({
  reason: z.string().default(""),
});

router.post("/projects/:projectId/donations/:id/flag", asyncHandler(async (req, res) => {
  const { projectId, id: donationId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }
  const parsed = flagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA });
    return;
  }
  const kaIds = (await db.select({ id: kesimAlanlariTable.id }).from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)))).map(k => k.id);
  if (kaIds.length === 0) { res.status(404).json({ error: "Bağış bulunamadı" }); return; }
  const [donation] = await db.select().from(donationsTable)
    .where(and(eq(donationsTable.id, donationId), inArray(donationsTable.kesimAlaniId, kaIds), isNull(donationsTable.deletedAt)));
  if (!donation) { res.status(404).json({ error: "Bağış bulunamadı" }); return; }
  await db.update(donationsTable)
    .set({ isFlagged: true, flagReason: parsed.data.reason, flagResolvedAt: null, updatedAt: new Date() })
    .where(eq(donationsTable.id, donationId));
  invalidateKACache();
  res.json({ success: true });
}));

router.post("/projects/:projectId/donations/:id/unflag", asyncHandler(async (req, res) => {
  const { projectId, id: donationId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }
  const kaIds = (await db.select({ id: kesimAlanlariTable.id }).from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)))).map(k => k.id);
  if (kaIds.length === 0) { res.status(404).json({ error: "Bağış bulunamadı" }); return; }
  const [donation] = await db.select().from(donationsTable)
    .where(and(eq(donationsTable.id, donationId), inArray(donationsTable.kesimAlaniId, kaIds), isNull(donationsTable.deletedAt)));
  if (!donation) { res.status(404).json({ error: "Bağış bulunamadı" }); return; }
  await db.update(donationsTable)
    .set({ isFlagged: false, flagReason: "", flagResolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(donationsTable.id, donationId));
  invalidateKACache();
  res.json({ success: true });
}));

router.post("/donations/:id/flag", asyncHandler(async (req, res) => {
  const donationId = req.params.id;
  const parsed = flagSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA }); return; }
  const [donation] = await db.select().from(donationsTable).where(and(eq(donationsTable.id, donationId), isNull(donationsTable.deletedAt)));
  if (!donation) { res.status(404).json({ error: "Bağış bulunamadı" }); return; }
  await db.update(donationsTable)
    .set({ isFlagged: true, flagReason: parsed.data.reason, flagResolvedAt: null, updatedAt: new Date() })
    .where(eq(donationsTable.id, donationId));
  invalidateKACache();
  res.json({ success: true });
}));

router.post("/donations/:id/unflag", asyncHandler(async (req, res) => {
  const donationId = req.params.id;
  const [donation] = await db.select().from(donationsTable).where(and(eq(donationsTable.id, donationId), isNull(donationsTable.deletedAt)));
  if (!donation) { res.status(404).json({ error: "Bağış bulunamadı" }); return; }
  await db.update(donationsTable)
    .set({ isFlagged: false, flagReason: "", flagResolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(donationsTable.id, donationId));
  invalidateKACache();
  res.json({ success: true });
}));

const EDITABLE_POOL_STRING_FIELDS = new Set([
  "vekalet", "name", "description", "donationType", "notes",
  "birim", "temsilci", "ozellik", "fiyat",
  "yerTalebi", "gunTalebi", "ilkHayvan", "safi", "phone",
]);

const EDITABLE_POOL_NUMERIC_FIELDS = new Set(["shareCount"]);

const inlineEditSchema = z.object({
  field: z.string().refine(
    f => EDITABLE_POOL_STRING_FIELDS.has(f) || EDITABLE_POOL_NUMERIC_FIELDS.has(f),
    { message: "Invalid field" },
  ),
  value: z.union([z.string().max(5000), z.number()]),
});

router.patch("/projects/:projectId/donations/:id", asyncHandler(async (req, res) => {
  const { projectId, id: donationId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const parsed = inlineEditSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA }); return; }

  const projectKAs = await db.select({ id: kesimAlanlariTable.id })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));
  const kaIds = projectKAs.map(k => k.id);
  if (kaIds.length === 0) { res.status(404).json({ error: "Bağış bulunamadı" }); return; }

  const [donation] = await db.select().from(donationsTable)
    .where(and(
      eq(donationsTable.id, donationId),
      isNull(donationsTable.deletedAt),
      inArray(donationsTable.kesimAlaniId, kaIds),
    ));
  if (!donation) { res.status(404).json({ error: "Bağış bulunamadı" }); return; }

  let dbValue: string | number = parsed.data.value;
  if (EDITABLE_POOL_NUMERIC_FIELDS.has(parsed.data.field)) {
    const num = typeof dbValue === "number" ? dbValue : parseInt(String(dbValue), 10);
    if (isNaN(num) || num < 1 || num > 7) {
      res.status(400).json({ error: "Geçersiz sayısal değer" }); return;
    }
    dbValue = num;
  } else {
    dbValue = String(dbValue);
  }

  await db.update(donationsTable)
    .set({ [parsed.data.field]: dbValue, updatedAt: new Date() })
    .where(eq(donationsTable.id, donationId));

  invalidateKACache();
  res.json({ success: true });
}));

const bulkNotesSchema = z.object({
  donationIds: z.array(z.string()).min(1).max(50000),
  note: z.string().min(1).max(5000),
  mode: z.enum(["append", "replace"]).default("append"),
});

router.post("/projects/:id/donations/bulk-notes", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const parsed = bulkNotesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { donationIds, note, mode } = parsed.data;

  const projectKAIds = await db.select({ id: kesimAlanlariTable.id })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));
  const validKAIds = projectKAIds.map(k => k.id);

  if (validKAIds.length === 0) {
    res.json({ success: true, affected: 0 });
    return;
  }

  let affected = 0;
  const CHUNK = 500;

  for (let i = 0; i < donationIds.length; i += CHUNK) {
    const chunk = donationIds.slice(i, i + CHUNK);
    const scopedWhere = and(
      inArray(donationsTable.id, chunk),
      inArray(donationsTable.kesimAlaniId, validKAIds),
      isNull(donationsTable.deletedAt),
    );

    if (mode === "replace") {
      const result = await db.update(donationsTable)
        .set({ notes: note, updatedAt: new Date() })
        .where(scopedWhere)
        .returning({ id: donationsTable.id });
      affected += result.length;
    } else {
      const result = await db.execute(sql`
        UPDATE donations SET
          notes = CASE WHEN notes IS NULL OR notes = '' THEN ${note} ELSE notes || E'\n' || ${note} END,
          updated_at = NOW()
        WHERE id IN (${sql.join(chunk.map(id => sql`${id}`), sql`, `)})
          AND kesim_alani_id IN (${sql.join(validKAIds.map(id => sql`${id}`), sql`, `)})
          AND deleted_at IS NULL
      `);
      affected += Number((result as { rowCount?: number }).rowCount || 0);
    }
  }

  invalidateKACache();
  res.json({ success: true, affected });
}));

router.get("/projects/:id/flagged-donations", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const kaRows = await db.select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  if (kaRows.length === 0) {
    res.json({ items: [] });
    return;
  }

  const kaIds = kaRows.map(k => k.id);
  const kaNameMap: Record<string, string> = {};
  for (const k of kaRows) kaNameMap[k.id] = k.name;

  const flaggedRows = await db.select().from(donationsTable)
    .where(and(
      inArray(donationsTable.kesimAlaniId, kaIds),
      isNull(donationsTable.deletedAt),
      sql`(${donationsTable.isFlagged} = true OR (${donationsTable.aiWarnings} IS NOT NULL AND ${donationsTable.aiWarnings} != '') OR ${donationsTable.flagResolvedAt} IS NOT NULL)`,
    ))
    .orderBy(sql`"updated_at" DESC`);

  const donationIds = flaggedRows.map(d => d.id);

  let groupInfoMap: Record<string, { groupId: string; animalNo: number; slotIndex: number }[]> = {};
  if (donationIds.length > 0) {
    const groupLinks = await db.execute(sql`
      SELECT agd.donation_id, agd.group_id, ag.animal_no, agd.sort_order
      FROM animal_group_donations agd
      JOIN animal_groups ag ON ag.id = agd.group_id
      WHERE agd.donation_id IN (${sql.join(donationIds.map(id => sql`${id}`), sql`, `)})
      ORDER BY ag.animal_no, agd.sort_order
    `);
    for (const row of groupLinks.rows as { donation_id: string; group_id: string; animal_no: number; sort_order: number }[]) {
      if (!groupInfoMap[row.donation_id]) groupInfoMap[row.donation_id] = [];
      groupInfoMap[row.donation_id].push({ groupId: row.group_id, animalNo: row.animal_no, slotIndex: row.sort_order });
    }
  }

  const items = flaggedRows.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    donationType: d.donationType,
    shareCount: d.shareCount,
    vekalet: d.vekalet,
    notes: d.notes,
    phone: d.phone || "",
    excluded: d.excluded,
    isFlagged: d.isFlagged,
    flagReason: d.flagReason,
    aiWarnings: d.aiWarnings || "",
    aiCategories: d.aiCategories ? (() => { try { const p = JSON.parse(d.aiCategories); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } })() : [],
    kesimAlaniId: d.kesimAlaniId,
    kesimAlaniName: kaNameMap[d.kesimAlaniId] || "",
    groups: groupInfoMap[d.id] || [],
    flagResolvedAt: d.flagResolvedAt ? d.flagResolvedAt.toISOString() : null,
    problemType: d.isFlagged ? "manual" : (d.aiWarnings ? "ai_warning" : "resolved"),
  }));

  res.json({ items });
}));

const ALLOWED_RULE_FIELDS = [
  "birim", "temsilci", "donationType", "ozellik", "fiyat",
  "yerTalebi", "gunTalebi", "ilkHayvan", "safi", "name",
  "description", "vekalet", "notes", "phone", "kesimAlaniId",
  "shareCount", "tags", "aiCategories",
] as const;

const ALLOWED_RULE_OPERATORS = [
  "equals", "not_equals", "contains", "not_contains",
  "in", "not_in", "gt", "gte", "lt", "lte", "between",
  "is_empty", "is_not_empty",
] as const;

const ruleConditionSchema = z.object({
  field: z.enum(ALLOWED_RULE_FIELDS),
  operator: z.enum(ALLOWED_RULE_OPERATORS),
  value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]),
});

const conditionGroupSchema = z.object({
  logic: z.enum(["AND", "OR"]),
  conditions: z.array(ruleConditionSchema).min(1),
});

const compoundConditionsSchema = z.object({
  logic: z.enum(["AND", "OR"]),
  groups: z.array(conditionGroupSchema).min(1),
});

const conditionsFieldSchema = z.union([
  z.array(ruleConditionSchema).min(1),
  compoundConditionsSchema,
]);

const automationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  conditions: conditionsFieldSchema,
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("transfer_to_ka"), targetKesimAlaniId: z.string().min(1) }),
    z.object({ type: z.literal("add_tag"), tagId: z.string().min(1) }),
    z.object({ type: z.literal("flag"), flagReason: z.string().optional() }),
    z.object({ type: z.literal("exclude") }),
  ]),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

router.get("/projects/:id/automation-rules", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const rules = await db.select()
    .from(automationRulesTable)
    .where(eq(automationRulesTable.projectId, projectId))
    .orderBy(asc(automationRulesTable.priority));

  res.json({ rules });
}));

router.post("/projects/:id/automation-rules", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const parsed = automationRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const maxPriorityResult = await db.execute(sql`
    SELECT COALESCE(MAX(priority), -1)::int AS max_priority
    FROM automation_rules
    WHERE project_id = ${projectId}
  `);
  const nextPriority = parsed.data.priority ?? (((maxPriorityResult.rows[0] as { max_priority: number })?.max_priority ?? -1) + 1);

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(automationRulesTable).values({
    id,
    projectId,
    name: parsed.data.name,
    conditions: parsed.data.conditions,
    action: parsed.data.action,
    priority: nextPriority,
    isActive: parsed.data.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  });

  const [rule] = await db.select().from(automationRulesTable).where(eq(automationRulesTable.id, id));
  res.status(201).json({ rule });
}));

router.put("/projects/:id/automation-rules/:ruleId", asyncHandler(async (req, res) => {
  const { id: projectId, ruleId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const [existing] = await db.select().from(automationRulesTable)
    .where(and(eq(automationRulesTable.id, ruleId), eq(automationRulesTable.projectId, projectId)));
  if (!existing) { res.status(404).json({ error: "Kural bulunamadı" }); return; }

  const updateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    conditions: conditionsFieldSchema.optional(),
    action: z.discriminatedUnion("type", [
      z.object({ type: z.literal("transfer_to_ka"), targetKesimAlaniId: z.string().min(1) }),
      z.object({ type: z.literal("add_tag"), tagId: z.string().min(1) }),
      z.object({ type: z.literal("flag"), flagReason: z.string().optional() }),
      z.object({ type: z.literal("exclude") }),
    ]).optional(),
    priority: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.conditions !== undefined) updateData.conditions = parsed.data.conditions;
  if (parsed.data.action !== undefined) updateData.action = parsed.data.action;
  if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  await db.update(automationRulesTable).set(updateData).where(eq(automationRulesTable.id, ruleId));

  const [rule] = await db.select().from(automationRulesTable).where(eq(automationRulesTable.id, ruleId));
  res.json({ rule });
}));

router.delete("/projects/:id/automation-rules/:ruleId", asyncHandler(async (req, res) => {
  const { id: projectId, ruleId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const [existing] = await db.select().from(automationRulesTable)
    .where(and(eq(automationRulesTable.id, ruleId), eq(automationRulesTable.projectId, projectId)));
  if (!existing) { res.status(404).json({ error: "Kural bulunamadı" }); return; }

  await db.delete(automationRulesTable).where(eq(automationRulesTable.id, ruleId));
  res.json({ success: true });
}));

router.post("/projects/:id/automation-rules/execute", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const result = await executeRules(projectId);
  refreshProjectStats();
  res.json(result);
}));

export default router;
