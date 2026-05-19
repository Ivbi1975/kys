import { Router, type IRouter } from "express";
import { parseAiCategories } from "../lib/ai-categories";
import { db } from "@workspace/db";
import {
  projectsTable,
  kesimAlanlariTable,
  donationsTable,
  donationTagsTable,
  customTagsTable,
  animalGroupDonationsTable,
  automationRulesTable,
  donationTransfersTable,
} from "@workspace/db/schema";
import { eq, isNull, and, sql, inArray, ilike, or, asc, desc, notInArray, ne, gte, lte, not } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../middleware/error-handler";
import { ERROR_MESSAGES } from "../lib/constants";
import { refreshProjectStats } from "./projects";
import { executeRules } from "../services/rule-engine.service";
import { invalidateKACache } from "../services/kesim-alani.service";
import { checkTransferConflicts, logConflicts } from "../services/conflict-log.service";
import { auditLog } from "../services/audit-log.service";

const router: IRouter = Router();

function normalizeNotes(val: string | null | undefined): string {
  if (val === null || val === undefined) return "";
  const trimmed = val.trim();
  if (/^null$/i.test(trimmed)) return "";
  return trimmed;
}

function parseMultiValue(val: unknown): string[] {
  if (typeof val !== "string" || !val.trim()) return [];
  return val.split(",").map(v => v.trim()).filter(Boolean);
}

// Builds a WHERE clause for project-wide donation stats.
// Includes ALL non-deleted kesim alanları (not just __havuz__) — project-wide scope by design.
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
    const hasEmpty = values.includes("__empty__");
    const nonEmpty = values.filter(v => v !== "__empty__");
    if (excludeSet.has(fieldName)) {
      if (hasEmpty && nonEmpty.length > 0) {
        parts.push(sql`(${sql.raw(`d.${col}`)} IS NOT NULL AND ${sql.raw(`d.${col}`)} != '' AND ${sql.raw(`d.${col}`)} NOT IN (${sql.join(nonEmpty.map(v => sql`${v}`), sql`, `)}))`);
      } else if (hasEmpty) {
        parts.push(sql`(${sql.raw(`d.${col}`)} IS NOT NULL AND ${sql.raw(`d.${col}`)} != '')`);
      } else if (nonEmpty.length === 1) {
        parts.push(sql`(${sql.raw(`d.${col}`)} IS NULL OR ${sql.raw(`d.${col}`)} = '' OR ${sql.raw(`d.${col}`)} != ${nonEmpty[0]})`);
      } else {
        parts.push(sql`(${sql.raw(`d.${col}`)} IS NULL OR ${sql.raw(`d.${col}`)} = '' OR ${sql.raw(`d.${col}`)} NOT IN (${sql.join(nonEmpty.map(v => sql`${v}`), sql`, `)}))`);
      }
    } else {
      if (hasEmpty && nonEmpty.length > 0) {
        parts.push(sql`(${sql.raw(`d.${col}`)} IS NULL OR ${sql.raw(`d.${col}`)} = '' OR ${sql.raw(`d.${col}`)} IN (${sql.join(nonEmpty.map(v => sql`${v}`), sql`, `)}))`);
      } else if (hasEmpty) {
        parts.push(sql`(${sql.raw(`d.${col}`)} IS NULL OR ${sql.raw(`d.${col}`)} = '')`);
      } else if (nonEmpty.length === 1) {
        parts.push(sql`${sql.raw(`d.${col}`)} = ${nonEmpty[0]}`);
      } else {
        parts.push(sql`${sql.raw(`d.${col}`)} IN (${sql.join(nonEmpty.map(v => sql`${v}`), sql`, `)})`);
      }
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
  if (kesimAlaniId === "none") {
    parts.push(sql`d.kesim_alani_id IN (SELECT id FROM kesim_alanlari WHERE project_id = ${projectId} AND name = '__havuz__' AND deleted_at IS NULL)`);
  } else if (kesimAlaniId) {
    parts.push(sql`d.kesim_alani_id = ${kesimAlaniId}`);
  } else {
    // "Tümü": havuz-originated donations (currently in havuz OR transferred from havuz).
    parts.push(sql`(
      d.kesim_alani_id IN (SELECT id FROM kesim_alanlari WHERE project_id = ${projectId} AND name = '__havuz__' AND deleted_at IS NULL)
      OR d.id IN (
        SELECT dt.donation_id FROM donation_transfers dt
        JOIN kesim_alanlari ka ON ka.id = dt.from_kesim_alani_id AND ka.name = '__havuz__' AND ka.project_id = ${projectId}
        WHERE dt.project_id = ${projectId}
      )
    )`);
  }

  const tagIdValues = parseMultiValue(query.tagIds);
  if (tagIdValues.length > 0) {
    const hasNoTag = tagIdValues.includes("__no_tag__");
    const realTagIds = tagIdValues.filter(t => t !== "__no_tag__");
    if (excludeSet.has("tags")) {
      if (hasNoTag && realTagIds.length > 0) {
        const tagSub = sql`d.id IN (SELECT dt.donation_id FROM donation_tags dt WHERE dt.tag_id IN (${sql.join(realTagIds.map(t => sql`${t}`), sql`, `)}))`;
        parts.push(sql`(d.id IN (SELECT dt2.donation_id FROM donation_tags dt2) AND NOT (${tagSub}))`);
      } else if (hasNoTag) {
        parts.push(sql`d.id IN (SELECT dt2.donation_id FROM donation_tags dt2)`);
      } else {
        const tagSub = sql`d.id IN (SELECT dt.donation_id FROM donation_tags dt WHERE dt.tag_id IN (${sql.join(realTagIds.map(t => sql`${t}`), sql`, `)}))`;
        parts.push(sql`NOT (${tagSub})`);
      }
    } else {
      if (hasNoTag && realTagIds.length > 0) {
        parts.push(sql`d.id NOT IN (SELECT dt2.donation_id FROM donation_tags dt2)`);
        for (const t of realTagIds) {
          parts.push(sql`d.id IN (SELECT dt.donation_id FROM donation_tags dt WHERE dt.tag_id = ${t})`);
        }
      } else if (hasNoTag) {
        parts.push(sql`d.id NOT IN (SELECT dt2.donation_id FROM donation_tags dt2)`);
      } else {
        for (const t of realTagIds) {
          parts.push(sql`d.id IN (SELECT dt.donation_id FROM donation_tags dt WHERE dt.tag_id = ${t})`);
        }
      }
    }
  }

  const shareCountMin = query.shareCountMin ? Number(query.shareCountMin) : null;
  const shareCountMax = query.shareCountMax ? Number(query.shareCountMax) : null;
  if (shareCountMin !== null && !isNaN(shareCountMin)) parts.push(sql`d.share_count >= ${shareCountMin}`);
  if (shareCountMax !== null && !isNaN(shareCountMax)) parts.push(sql`d.share_count <= ${shareCountMax}`);

  const aiCategoryValues = parseMultiValue(query.aiCategory);
  if (aiCategoryValues.length > 0) {
    if (excludeSet.has("aiCategory")) {
      for (const cat of aiCategoryValues) {
        parts.push(sql`(d.ai_categories IS NULL OR d.ai_categories::text = '[]' OR NOT (d.ai_categories::text ILIKE ${'%' + cat + '%'}))`);
      }
    } else {
      for (const cat of aiCategoryValues) {
        parts.push(sql`d.ai_categories::text ILIKE ${'%' + cat + '%'}`);
      }
    }
  }

  const notesFilter = typeof query.notesFilter === "string" ? query.notesFilter.trim() : "";
  if (notesFilter) {
    const noteTerms = notesFilter.split(",").map((t: string) => t.trim()).filter(Boolean);
    for (const term of noteTerms) {
      parts.push(sql`d.notes ILIKE ${'%' + term + '%'}`);
    }
  }

  const flagFilter = typeof query.flagFilter === "string" ? query.flagFilter.trim() : "";
  if (flagFilter === "flagged") parts.push(sql`d.is_flagged = true`);
  else if (flagFilter === "unflagged") parts.push(sql`d.is_flagged = false`);

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

// Returns ALL donations in the project across every kesim alanı (including __havuz__).
// This is intentional: the "bağış havuzu" view is project-wide, not limited to the pool KA.
// Frontend KA dropdown filters out __havuz__ for transfer targets, but the data shown is project-wide.
router.get("/projects/:id/donations", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 100000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const donationTypes = parseMultiValue(req.query.donationType);
  const birimValues = parseMultiValue(req.query.birim);
  const temsilciValues = parseMultiValue(req.query.temsilci);
  const kesimAlaniId = typeof req.query.kesimAlaniId === "string" ? req.query.kesimAlaniId.trim() : "";
  const aiCategoryValues = parseMultiValue(req.query.aiCategory);
  const ozellikValues = parseMultiValue(req.query.ozellik);
  const fiyatValues = parseMultiValue(req.query.fiyat);
  const yerTalebiValues = parseMultiValue(req.query.yerTalebi);
  const gunTalebiValues = parseMultiValue(req.query.gunTalebi);
  const ilkHayvanValues = parseMultiValue(req.query.ilkHayvan);
  const safiValues = parseMultiValue(req.query.safi);
  const tagIdValues = parseMultiValue(req.query.tagIds);
  const notesFilter = typeof req.query.notesFilter === "string" ? req.query.notesFilter.trim() : "";
  const flagFilter = typeof req.query.flagFilter === "string" ? req.query.flagFilter.trim() : "";
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

  const kaRows = await db.select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name, kesimListeId: kesimAlanlariTable.kesimListeId })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  if (kaRows.length === 0) {
    res.json({ items: [], total: 0, kesimAlanlari: [], allFilteredIds: [] });
    return;
  }

  const kaIds = kaRows.map(k => k.id);
  const kaNameMap: Record<string, string> = {};
  const kaKesimListeIdMap: Record<string, string | null> = {};
  for (const k of kaRows) {
    kaNameMap[k.id] = k.name;
    kaKesimListeIdMap[k.id] = k.kesimListeId ?? null;
  }

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
    const hasEmpty = values.includes("__empty__");
    const nonEmpty = values.filter(v => v !== "__empty__");
    if (excludeSet.has(fieldName)) {
      if (hasEmpty && nonEmpty.length > 0) {
        conditions.push(and(sql`${col} IS NOT NULL`, ne(col, ""), nonEmpty.length === 1 ? ne(col, nonEmpty[0]) : notInArray(col, nonEmpty))!);
      } else if (hasEmpty) {
        conditions.push(and(sql`${col} IS NOT NULL`, ne(col, ""))!);
      } else {
        conditions.push(or(sql`${col} IS NULL`, eq(col, ""), nonEmpty.length === 1 ? ne(col, nonEmpty[0]) : notInArray(col, nonEmpty))!);
      }
    } else {
      if (hasEmpty && nonEmpty.length > 0) {
        conditions.push(or(sql`${col} IS NULL`, eq(col, ""), nonEmpty.length === 1 ? eq(col, nonEmpty[0]) : inArray(col, nonEmpty))!);
      } else if (hasEmpty) {
        conditions.push(or(sql`${col} IS NULL`, eq(col, ""))!);
      } else {
        if (nonEmpty.length === 1) conditions.push(eq(col, nonEmpty[0]));
        else conditions.push(inArray(col, nonEmpty));
      }
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

  const havuzKaIds = kaRows.filter(k => k.name === "__havuz__").map(k => k.id);

  if (kesimAlaniId === "none") {
    // Show only donations currently in havuz
    if (havuzKaIds.length > 0) {
      conditions.push(inArray(donationsTable.kesimAlaniId, havuzKaIds));
    } else {
      conditions.push(sql`false`);
    }
  } else if (kesimAlaniId) {
    conditions.push(eq(donationsTable.kesimAlaniId, kesimAlaniId));
  } else {
    // "Tümü": havuz-originated donations (currently in havuz OR transferred from havuz).
    // The Durum column uses animal_group_donations to show the correct label even when
    // the donation's kesim_alani_id still points to __havuz__.
    if (havuzKaIds.length > 0) {
      conditions.push(
        or(
          inArray(donationsTable.kesimAlaniId, havuzKaIds),
          sql`${donationsTable.id} IN (
            SELECT dt.donation_id FROM donation_transfers dt
            WHERE dt.from_kesim_alani_id IN (${sql.join(havuzKaIds.map(id => sql`${id}`), sql`, `)})
              AND dt.project_id = ${projectId}
          )`,
        )!,
      );
    } else {
      conditions.push(sql`false`);
    }
  }

  if (tagIdValues.length > 0) {
    const hasNoTag = tagIdValues.includes("__no_tag__");
    const realTagIds = tagIdValues.filter(t => t !== "__no_tag__");
    const noTagSql = sql`${donationsTable.id} NOT IN (SELECT dt2.donation_id FROM donation_tags dt2)`;
    const hasSomeSql = sql`${donationsTable.id} IN (SELECT dt2.donation_id FROM donation_tags dt2)`;
    if (excludeSet.has("tags")) {
      if (hasNoTag && realTagIds.length > 0) {
        const tagSql = sql`${donationsTable.id} IN (SELECT dt.donation_id FROM donation_tags dt WHERE dt.tag_id IN (${sql.join(realTagIds.map(t => sql`${t}`), sql`, `)}))`;
        conditions.push(and(hasSomeSql, not(tagSql))!);
      } else if (hasNoTag) {
        conditions.push(hasSomeSql);
      } else {
        const tagSql = sql`${donationsTable.id} IN (SELECT dt.donation_id FROM donation_tags dt WHERE dt.tag_id IN (${sql.join(realTagIds.map(t => sql`${t}`), sql`, `)}))`;
        conditions.push(not(tagSql));
      }
    } else {
      if (hasNoTag && realTagIds.length > 0) {
        conditions.push(noTagSql);
        for (const t of realTagIds) {
          conditions.push(sql`${donationsTable.id} IN (SELECT dt.donation_id FROM donation_tags dt WHERE dt.tag_id = ${t})`);
        }
      } else if (hasNoTag) {
        conditions.push(noTagSql);
      } else {
        for (const t of realTagIds) {
          conditions.push(sql`${donationsTable.id} IN (SELECT dt.donation_id FROM donation_tags dt WHERE dt.tag_id = ${t})`);
        }
      }
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

  if (aiCategoryValues.length > 0) {
    if (excludeSet.has("aiCategory")) {
      for (const cat of aiCategoryValues) {
        conditions.push(
          or(
            sql`${donationsTable.aiCategories} IS NULL`,
            sql`${donationsTable.aiCategories}::text = '[]'`,
            sql`NOT (${donationsTable.aiCategories}::text ILIKE ${'%' + cat + '%'})`,
          )!
        );
      }
    } else {
      for (const cat of aiCategoryValues) {
        conditions.push(sql`${donationsTable.aiCategories}::text ILIKE ${'%' + cat + '%'}`);
      }
    }
  }

  if (notesFilter) {
    const noteTerms = notesFilter.split(",").map((t: string) => t.trim()).filter(Boolean);
    for (const term of noteTerms) {
      conditions.push(ilike(donationsTable.notes, `%${term}%`));
    }
  }

  if (flagFilter === "flagged") conditions.push(eq(donationsTable.isFlagged, true));
  else if (flagFilter === "unflagged") conditions.push(eq(donationsTable.isFlagged, false));

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
      if (col === "kesim_alani_id") {
        sortParts.push(level.dir === "desc"
          ? sql`(SELECT name FROM kesim_alanlari WHERE id = ${sql.raw('"kesim_alani_id"')}) DESC NULLS LAST`
          : sql`(SELECT name FROM kesim_alanlari WHERE id = ${sql.raw('"kesim_alani_id"')}) ASC NULLS LAST`
        );
      } else if (col === "fiyat" || col === "gun_talebi") {
        sortParts.push(level.dir === "desc"
          ? sql`NULLIF(${sql.raw(`"${col}"`)}, '')::numeric DESC NULLS LAST`
          : sql`NULLIF(${sql.raw(`"${col}"`)}, '')::numeric ASC NULLS LAST`
        );
      } else {
        sortParts.push(level.dir === "desc"
          ? sql`${sql.raw(`"${col}"`)} DESC NULLS LAST`
          : sql`${sql.raw(`"${col}"`)} ASC NULLS LAST`
        );
      }
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
  // Map donation_id → effective kesim_alani_id derived from animal_group_donations.
  // Donations may still have kesim_alani_id = havuz even after being assigned
  // to an animal group in a real kesim alanı, so we look up the group assignment
  // and use that KA to show the correct "Durum" label.
  const groupKaMap: Record<string, string> = {};
  if (donationIds.length > 0) {
    const [tags, groupAssignments] = await Promise.all([
      db.select({
        donationId: donationTagsTable.donationId,
        tagId: donationTagsTable.tagId,
      }).from(donationTagsTable).where(inArray(donationTagsTable.donationId, donationIds)),
      db.execute(sql`
        SELECT DISTINCT ON (agd.donation_id) agd.donation_id, ag.kesim_alani_id
        FROM animal_group_donations agd
        JOIN animal_groups ag ON ag.id = agd.group_id AND ag.deleted_at IS NULL
        WHERE agd.donation_id IN (${sql.join(donationIds.map(id => sql`${id}`), sql`, `)})
        ORDER BY agd.donation_id, agd.id ASC
      `),
    ]);

    for (const t of tags) {
      if (!tagsByDonation[t.donationId]) tagsByDonation[t.donationId] = [];
      tagsByDonation[t.donationId].push(t.tagId);
    }

    type GaRow = { donation_id: string; kesim_alani_id: string };
    for (const row of groupAssignments.rows as GaRow[]) {
      // Only use group KA if it's a known, non-havuz KA
      if (kaNameMap[row.kesim_alani_id] && kaNameMap[row.kesim_alani_id] !== "__havuz__") {
        groupKaMap[row.donation_id] = row.kesim_alani_id;
      }
    }
  }

  const items = rows.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    donationType: d.donationType,
    shareCount: d.shareCount,
    vekalet: d.vekalet,
    notes: normalizeNotes(d.notes),
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
    // Derive effective KA: if the donation is assigned to a group in a real
    // kesim alanı (via animal_group_donations), use that KA for the label even
    // if the donation's own kesim_alani_id still points to the havuz.
    kesimAlaniName: kaNameMap[groupKaMap[d.id] ?? d.kesimAlaniId] || "",
    kesimListeId: kaKesimListeIdMap[groupKaMap[d.id] ?? d.kesimAlaniId] ?? null,
    tags: tagsByDonation[d.id] || [],
    aiCategories: parseAiCategories(d.aiCategories),
    aiWarnings: d.aiWarnings || "",
    aiConfidenceScore: d.aiConfidenceScore ?? null,
    isFlagged: d.isFlagged,
    flagReason: d.flagReason,
  }));

  const donorMissedCounts: Record<string, number> = {};
  const hasActiveFilters = conditions.length > 2;
  const pageNames = hasActiveFilters ? [...new Set(rows.map(r => r.name).filter(Boolean))] : [];
  if (pageNames.length > 0) {
    const [totalByName, filteredByName] = await Promise.all([
      db.select({ name: donationsTable.name, cnt: sql<number>`count(*)::int` })
        .from(donationsTable)
        .where(and(
          inArray(donationsTable.kesimAlaniId, kaIds),
          isNull(donationsTable.deletedAt),
          inArray(donationsTable.name, pageNames),
        ))
        .groupBy(donationsTable.name),
      db.select({ name: donationsTable.name, cnt: sql<number>`count(*)::int` })
        .from(donationsTable)
        .where(and(whereClause, inArray(donationsTable.name, pageNames)))
        .groupBy(donationsTable.name),
    ]);
    const totalMap = new Map(totalByName.map(r => [r.name, r.cnt]));
    const filteredMap = new Map(filteredByName.map(r => [r.name, r.cnt]));
    for (const name of pageNames) {
      const total = totalMap.get(name) ?? 0;
      const filtered = filteredMap.get(name) ?? 0;
      const missed = total - filtered;
      if (missed > 0) donorMissedCounts[name] = missed;
    }
  }

  res.json({ items, total, kesimAlanlari: kaRows, allFilteredIds, donorMissedCounts });
}));

router.get("/projects/:id/donations/stats", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const filterWhere = buildStatsFilterSQL(projectId, req.query as Record<string, unknown>);

  const DIST_ALLOWED_COLS = new Set(["ozellik", "fiyat", "yer_talebi", "gun_talebi", "ilk_hayvan", "safi"]);
  const distQuery = (col: string) => {
    if (!DIST_ALLOWED_COLS.has(col)) throw new Error(`Invalid dist column: ${col}`);
    return db.execute(sql`
      SELECT ${sql.raw(`d.${col}`)} AS value, COUNT(*)::int AS count
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ${filterWhere} AND ${sql.raw(`d.${col}`)} != ''
      GROUP BY ${sql.raw(`d.${col}`)} ORDER BY count DESC LIMIT 500
    `);
  };

  const [
    result,
    birimDist,
    temsilciDist,
    typeDist,
    kaDist,
    multiLocResult,
    multiLocByNameResult,
    transferredCountResult,
    inGroupCountResult,
    ozellikDist,
    fiyatDist,
    yerTalebiDist,
    gunTalebiDist,
    ilkHayvanDist,
    safiDist,
    tagCountResult,
    untaggedCountResult,
  ] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(d.id)::int AS total,
        COUNT(d.id) FILTER (WHERE d.excluded = false)::int AS active,
        COUNT(d.id) FILTER (WHERE d.excluded = true)::int AS excluded,
        COALESCE(SUM(d.share_count), 0)::int AS total_shares,
        COUNT(DISTINCT d.birim) FILTER (WHERE d.birim != '')::int AS birim_count,
        COUNT(DISTINCT d.temsilci) FILTER (WHERE d.temsilci != '')::int AS temsilci_count,
        COUNT(DISTINCT d.donation_type) FILTER (WHERE d.donation_type != '')::int AS type_count,
        COUNT(d.id) FILTER (WHERE d.donation_type IS NULL OR d.donation_type = '')::int AS empty_type_count,
        COUNT(d.id) FILTER (WHERE d.birim IS NULL OR d.birim = '')::int AS empty_birim_count,
        COUNT(d.id) FILTER (WHERE d.temsilci IS NULL OR d.temsilci = '')::int AS empty_temsilci_count,
        COUNT(d.id) FILTER (WHERE d.ozellik IS NULL OR d.ozellik = '')::int AS empty_ozellik_count,
        COUNT(d.id) FILTER (WHERE d.fiyat IS NULL OR d.fiyat = '')::int AS empty_fiyat_count,
        COUNT(d.id) FILTER (WHERE d.yer_talebi IS NULL OR d.yer_talebi = '')::int AS empty_yer_talebi_count,
        COUNT(d.id) FILTER (WHERE d.gun_talebi IS NULL OR d.gun_talebi = '')::int AS empty_gun_talebi_count,
        COUNT(d.id) FILTER (WHERE d.ilk_hayvan IS NULL OR d.ilk_hayvan = '')::int AS empty_ilk_hayvan_count,
        COUNT(d.id) FILTER (WHERE d.safi IS NULL OR d.safi = '')::int AS empty_safi_count
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ${filterWhere}
    `),
    db.execute(sql`
      SELECT d.birim, COUNT(*)::int AS count, SUM(d.share_count)::int AS shares
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ${filterWhere} AND d.birim != ''
      GROUP BY d.birim ORDER BY count DESC LIMIT 500
    `),
    db.execute(sql`
      SELECT d.temsilci, COUNT(*)::int AS count, SUM(d.share_count)::int AS shares
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ${filterWhere} AND d.temsilci != ''
      GROUP BY d.temsilci ORDER BY count DESC LIMIT 500
    `),
    db.execute(sql`
      SELECT d.donation_type AS type, COUNT(*)::int AS count, SUM(d.share_count)::int AS shares
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ${filterWhere} AND d.donation_type != ''
      GROUP BY d.donation_type ORDER BY count DESC LIMIT 500
    `),
    db.execute(sql`
      SELECT ka.id, ka.name, COUNT(d.id)::int AS count, SUM(d.share_count)::int AS shares
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ${filterWhere}
      GROUP BY ka.id, ka.name ORDER BY ka.name
    `),
    db.execute(sql`
      SELECT d.vekalet, COUNT(DISTINCT d.kesim_alani_id)::int AS loc_count
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ka.project_id = ${projectId}
        AND ka.deleted_at IS NULL AND d.deleted_at IS NULL
        AND ka.name != '__havuz__'
        AND d.excluded = false AND d.vekalet IS NOT NULL AND d.vekalet != ''
      GROUP BY d.vekalet
      HAVING COUNT(DISTINCT d.kesim_alani_id) > 1
    `),
    db.execute(sql`
      SELECT d.name, COUNT(DISTINCT d.kesim_alani_id)::int AS loc_count, array_agg(DISTINCT d.vekalet) AS vekalets
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ka.project_id = ${projectId}
        AND ka.deleted_at IS NULL AND d.deleted_at IS NULL
        AND ka.name != '__havuz__'
        AND d.excluded = false AND d.name IS NOT NULL AND d.name != ''
      GROUP BY d.name
      HAVING COUNT(DISTINCT d.kesim_alani_id) > 1
      LIMIT 100
    `),
    db.execute(sql`
      SELECT COUNT(DISTINCT d.id)::int AS transferred
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      JOIN animal_group_donations agd ON agd.donation_id = d.id
      WHERE ka.project_id = ${projectId}
        AND ka.deleted_at IS NULL AND d.deleted_at IS NULL
        AND ka.name != '__havuz__'
    `),
    db.execute(sql`
      SELECT COUNT(DISTINCT d.id)::int AS in_groups
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      JOIN animal_group_donations agd ON agd.donation_id = d.id
      WHERE ka.project_id = ${projectId}
        AND ka.deleted_at IS NULL AND d.deleted_at IS NULL
    `),
    distQuery("ozellik"),
    distQuery("fiyat"),
    distQuery("yer_talebi"),
    distQuery("gun_talebi"),
    distQuery("ilk_hayvan"),
    distQuery("safi"),
    db.execute(sql`
      SELECT ct.id, ct.name, ct.color, COUNT(d.id)::int AS count
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      JOIN donation_tags dt ON dt.donation_id = d.id
      JOIN custom_tags ct ON ct.id = dt.tag_id
      WHERE ${filterWhere}
      GROUP BY ct.id, ct.name, ct.color
      ORDER BY count DESC
    `),
    db.execute(sql`
      SELECT COUNT(DISTINCT d.id)::int AS untagged_count
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ${filterWhere}
        AND NOT EXISTS (
          SELECT 1 FROM donation_tags dt WHERE dt.donation_id = d.id
        )
    `),
  ]);

  const stats = result.rows[0] || { total: 0, active: 0, excluded: 0, total_shares: 0 };
  const multiLocationVekalets = multiLocResult.rows.map((r: Record<string, unknown>) => String(r.vekalet));
  const multiLocationNames = multiLocByNameResult.rows.map((r: Record<string, unknown>) => ({
    name: String(r.name),
    count: Number(r.loc_count),
    vekalets: (r.vekalets as string[]) || [],
  }));
  const transferredToLists = (transferredCountResult.rows[0] as Record<string, unknown>)?.transferred ?? 0;
  const inGroups = (inGroupCountResult.rows[0] as Record<string, unknown>)?.in_groups ?? 0;
  const tagDistribution = tagCountResult.rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    name: String(r.name),
    color: String(r.color || ""),
    count: Number(r.count),
  }));
  const untaggedCount = Number((untaggedCountResult.rows[0] as Record<string, unknown>)?.untagged_count ?? 0);

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
    untagged_count: untaggedCount,
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
        notes: normalizeNotes(d.notes),
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
  auditLog({
    action: "bulk_import",
    entityType: "donation",
    req,
    projectId,
    affectedCount: inserted,
    metadata: { totalRequested: donations.length, inserted },
  });
}));

const siblingsSchema = z.object({
  donationIds: z.array(z.string()).min(1).max(50000),
});

router.post("/projects/:id/donations/siblings", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const parsed = siblingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { donationIds } = parsed.data;

  // Get ALL kesim alanı IDs for this project (pool + assigned)
  const allKARows = await db.select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(and(
      eq(kesimAlanlariTable.projectId, projectId),
      isNull(kesimAlanlariTable.deletedAt),
    ));

  if (allKARows.length === 0) { res.json({ siblings: [] }); return; }
  const allKAIds = allKARows.map(k => k.id);
  const kaNameMap = new Map(allKARows.map(k => [k.id, k.name]));

  // Verify selected donations belong to this project
  const selectedDonations = await db.select({ id: donationsTable.id, name: donationsTable.name })
    .from(donationsTable)
    .where(and(
      inArray(donationsTable.id, donationIds),
      inArray(donationsTable.kesimAlaniId, allKAIds),
      isNull(donationsTable.deletedAt),
    ));

  const donorNames = [...new Set(selectedDonations.map(d => d.name).filter(Boolean))] as string[];

  if (donorNames.length === 0) { res.json({ siblings: [] }); return; }

  // Find ALL project donations with same donor names not in the selection (pool + kesim listesi)
  const siblingRows = await db.select({
    id: donationsTable.id,
    name: donationsTable.name,
    description: donationsTable.description,
    vekalet: donationsTable.vekalet,
    shareCount: donationsTable.shareCount,
    donationType: donationsTable.donationType,
    birim: donationsTable.birim,
    temsilci: donationsTable.temsilci,
    ozellik: donationsTable.ozellik,
    fiyat: donationsTable.fiyat,
    phone: donationsTable.phone,
    notes: donationsTable.notes,
    kesimAlaniId: donationsTable.kesimAlaniId,
  })
    .from(donationsTable)
    .where(and(
      inArray(donationsTable.kesimAlaniId, allKAIds),
      isNull(donationsTable.deletedAt),
      inArray(donationsTable.name, donorNames),
      notInArray(donationsTable.id, donationIds),
    ));

  type SiblingDonation = {
    id: string; name: string; description: string; vekalet: string | null;
    shareCount: number; donationType: string | null;
    birim: string; temsilci: string; ozellik: string; fiyat: string;
    phone: string; notes: string; kesimAlaniName: string | null;
  };
  const grouped = new Map<string, SiblingDonation[]>();
  for (const s of siblingRows) {
    if (!s.name) continue;
    if (!grouped.has(s.name)) grouped.set(s.name, []);
    const kaName = s.kesimAlaniId ? (kaNameMap.get(s.kesimAlaniId) ?? null) : null;
    grouped.get(s.name)!.push({
      id: s.id,
      name: s.name,
      description: s.description || "",
      vekalet: s.vekalet || null,
      shareCount: s.shareCount,
      donationType: s.donationType || null,
      birim: s.birim || "",
      temsilci: s.temsilci || "",
      ozellik: s.ozellik || "",
      fiyat: s.fiyat || "",
      phone: s.phone || "",
      notes: s.notes || "",
      kesimAlaniName: kaName === "__havuz__" ? null : (kaName ?? null),
    });
  }

  const siblings = Array.from(grouped.entries()).map(([donorName, donations]) => ({
    donorName,
    extraCount: donations.length,
    extraIds: donations.map(d => d.id),
    donations,
  }));

  res.json({ siblings });
}));

const transferSchema = z.object({
  donationIds: z.array(z.string()).min(1).max(50000),
  targetKesimAlaniId: z.string().min(1),
  skipExisting: z.boolean().optional(),
  force: z.boolean().optional().default(false),
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

  const { donationIds, targetKesimAlaniId, skipExisting, force } = parsed.data;

  const [targetKA] = await db.select()
    .from(kesimAlanlariTable)
    .where(and(
      eq(kesimAlanlariTable.id, targetKesimAlaniId),
      eq(kesimAlanlariTable.projectId, projectId),
      isNull(kesimAlanlariTable.deletedAt),
    ));
  if (!targetKA) {
    const [existsElsewhere] = await db.select({ id: kesimAlanlariTable.id })
      .from(kesimAlanlariTable)
      .where(and(eq(kesimAlanlariTable.id, targetKesimAlaniId), isNull(kesimAlanlariTable.deletedAt)));
    if (existsElsewhere) {
      res.status(400).json({ error: ERROR_MESSAGES.MUST_BE_SAME_PROJECT });
    } else {
      res.status(404).json({ error: ERROR_MESSAGES.TARGET_KESIM_NOT_FOUND });
    }
    return;
  }

  const projectKAIds = await db.select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));
  const validKAIds = new Set(projectKAIds.map(k => k.id));
  const poolKAId = projectKAIds.find(k => k.name === "__havuz__")?.id;
  // Source KAs exclude the target so donations already there are never "re-moved" to themselves
  const sourceKAIds = [...validKAIds].filter(id => id !== targetKesimAlaniId);

  // Conflict detection: check if any donations have vekalet numbers that already exist in target
  const poolKaId = poolKAId ?? sourceKAIds[0] ?? "";
  const conflictCheck = await checkTransferConflicts(donationIds, poolKaId, targetKesimAlaniId, projectId);
  if (conflictCheck.hasConflicts && !force) {
    await logConflicts(
      projectId,
      conflictCheck.conflicts,
      poolKaId,
      conflictCheck.sourceKesimAlaniName || "Bağış Havuzu",
      targetKesimAlaniId,
      conflictCheck.targetKesimAlaniName,
      "blocked",
    ).catch(() => {});
    res.status(409).json({
      error: "transfer_conflict",
      conflicts: conflictCheck.conflicts,
      sourceKesimAlaniName: conflictCheck.sourceKesimAlaniName || "Bağış Havuzu",
      targetKesimAlaniName: conflictCheck.targetKesimAlaniName,
    });
    return;
  }

  let movedCount = 0;
  let alreadyInTarget = 0;
  // IDs that were successfully moved (pool or non-pool) — used for fetching transferredItems
  let movedIds: string[] = [];
  // Only pool-source IDs — used for server-authoritative undo batchId logging
  let poolMovedIds: string[] = [];

  await db.transaction(async (tx) => {
    const CHUNK = 5000;

    // ── Separate pool vs non-pool source donations ──────────────────────────
    let poolSourceIds: string[] = [];
    let nonPoolSourceIds: string[] = [];

    if (!poolKAId) {
      // No __havuz__ KA found for this project. All donations fall to the
      // non-pool path which uses the broader sourceKAIds filter. Log a warning
      // so this edge case is visible in server logs.
      console.warn(`[transfer] poolKAId is undefined for project ${projectId}. All ${donationIds.length} donation(s) will be treated as non-pool.`);
    }

    if (poolKAId) {
      const DETECT_CHUNK = 1000;
      const poolSet = new Set<string>();
      for (let i = 0; i < donationIds.length; i += DETECT_CHUNK) {
        const chunk = donationIds.slice(i, i + DETECT_CHUNK);
        const poolRows = await tx.select({ id: donationsTable.id })
          .from(donationsTable)
          .where(and(
            inArray(donationsTable.id, chunk),
            eq(donationsTable.kesimAlaniId, poolKAId),
            isNull(donationsTable.deletedAt),
          ));
        for (const r of poolRows) poolSet.add(r.id);
      }
      poolSourceIds = donationIds.filter(id => poolSet.has(id));
      nonPoolSourceIds = donationIds.filter(id => !poolSet.has(id));
    } else {
      // sourceKAIds already includes every non-deleted KA for this project
      // (excluding targetKesimAlaniId), so the non-pool UPDATE below will
      // still move donations that are in any KA — including any pool-like KA.
      nonPoolSourceIds = donationIds;
    }

    // ── Check already in target (by donation ID) ─────────────────────────────
    const existingIds = new Set<string>();
    for (let i = 0; i < donationIds.length; i += CHUNK) {
      const chunk = donationIds.slice(i, i + CHUNK);
      const existingInTarget = await tx.select({ id: donationsTable.id })
        .from(donationsTable)
        .where(and(
          eq(donationsTable.kesimAlaniId, targetKesimAlaniId),
          isNull(donationsTable.deletedAt),
          inArray(donationsTable.id, chunk),
        ));
      for (const r of existingInTarget) existingIds.add(r.id);
    }
    alreadyInTarget = existingIds.size;

    // ── Get max sort for target ──────────────────────────────────────────────
    const maxSortResult = await tx.execute(sql`
      SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort
      FROM donations
      WHERE kesim_alani_id = ${targetKesimAlaniId} AND deleted_at IS NULL
    `);
    let nextSort = ((maxSortResult.rows[0] as { max_sort: number })?.max_sort ?? -1) + 1;

    // ── POOL donations: MOVE (update kesimAlaniId — no copy created) ──────────
    // A pool donation simply moves to the target KA. The total project donation
    // count stays the same. The pool VIEW (which shows all project donations) still
    // shows it; the "unassigned" filter just no longer matches it.
    if (poolSourceIds.length > 0) {
      const idsToMove = skipExisting
        ? poolSourceIds.filter(id => !existingIds.has(id))
        : poolSourceIds;

      if (idsToMove.length > 0) {
        const MOVE_CHUNK = 500;
        for (let i = 0; i < idsToMove.length; i += MOVE_CHUNK) {
          const chunk = idsToMove.slice(i, i + MOVE_CHUNK);
          const result = await tx.update(donationsTable)
            .set({ kesimAlaniId: targetKesimAlaniId, updatedAt: new Date() })
            .where(and(
              inArray(donationsTable.id, chunk),
              eq(donationsTable.kesimAlaniId, poolKAId!),
              isNull(donationsTable.deletedAt),
            ))
            .returning({ id: donationsTable.id });

          if (result.length > 0) {
            const caseParts = result.map((r, idx) =>
              sql`WHEN id = ${r.id} THEN ${sql.raw(String(nextSort + idx))}`
            );
            const ids = result.map(r => r.id);
            await tx.execute(sql`
              UPDATE donations SET sort_order = CASE ${sql.join(caseParts, sql` `)} END
              WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
            `);
            movedIds.push(...result.map(r => r.id));
            poolMovedIds.push(...result.map(r => r.id));
            movedCount += result.length;
            nextSort += result.length;
          }
        }
      }
    }

    // ── NON-POOL donations: MOVE (kesimAlaniId update) ───────────────────────
    if (nonPoolSourceIds.length > 0) {
      const idsToMove = skipExisting
        ? nonPoolSourceIds.filter(id => !existingIds.has(id))
        : nonPoolSourceIds;

      if (idsToMove.length > 0 && sourceKAIds.length > 0) {
        const MOVE_CHUNK = 500;
        for (let i = 0; i < idsToMove.length; i += MOVE_CHUNK) {
          const chunk = idsToMove.slice(i, i + MOVE_CHUNK);
          const result = await tx.update(donationsTable)
            .set({ kesimAlaniId: targetKesimAlaniId, updatedAt: new Date() })
            .where(and(
              inArray(donationsTable.id, chunk),
              inArray(donationsTable.kesimAlaniId, sourceKAIds),
              isNull(donationsTable.deletedAt),
            ))
            .returning({ id: donationsTable.id });

          if (result.length > 0) {
            const caseParts = result.map((r, idx) =>
              sql`WHEN id = ${r.id} THEN ${sql.raw(String(nextSort + idx))}`
            );
            const ids = result.map(r => r.id);
            await tx.execute(sql`
              UPDATE donations SET sort_order = CASE ${sql.join(caseParts, sql` `)} END
              WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
            `);
            movedIds.push(...result.map(r => r.id));
            nextSort += result.length;
          }
          movedCount += result?.length ?? 0;
        }
      }
    }
  });

  if (movedCount === 0 && alreadyInTarget > 0) {
    invalidateKACache();
    refreshProjectStats();
    res.json({ success: true, moved: 0, alreadyInTarget, skipped: alreadyInTarget });
    return;
  }

  let transferredItems: Array<{
    id: string; name: string; description: string; donationType: string;
    shareCount: number; vekalet: string; notes: string;
  }> = [];
  if (movedIds.length > 0) {
    const FETCH_CHUNK = 500;
    for (let i = 0; i < movedIds.length; i += FETCH_CHUNK) {
      const chunk = movedIds.slice(i, i + FETCH_CHUNK);
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
        notes: normalizeNotes(r.notes),
      })));
    }
  }

  if (conflictCheck.hasConflicts && force && conflictCheck.conflicts.length > 0) {
    await logConflicts(
      projectId,
      conflictCheck.conflicts,
      poolKaId,
      conflictCheck.sourceKesimAlaniName || "Bağış Havuzu",
      targetKesimAlaniId,
      conflictCheck.targetKesimAlaniName,
      "forced",
    ).catch(() => {});
  }

  let batchId: string | undefined;
  if (poolMovedIds.length > 0 && poolKAId) {
    batchId = crypto.randomUUID();
    const [poolKA] = await db.select({ name: kesimAlanlariTable.name })
      .from(kesimAlanlariTable)
      .where(eq(kesimAlanlariTable.id, poolKAId));
    const now = new Date();
    const logEntries = poolMovedIds.map(donationId => {
      const item = transferredItems.find(t => t.id === donationId);
      return {
        id: crypto.randomUUID(),
        projectId,
        donationId,
        donorName: item?.name ?? "",
        donorDescription: item?.description ?? "",
        fromKesimAlaniId: poolKAId,
        fromKesimAlaniName: poolKA?.name ?? "__havuz__",
        toKesimAlaniId: targetKesimAlaniId,
        toKesimAlaniName: targetKA.name ?? "",
        removedFromSource: true,
        shareCount: item?.shareCount ?? 1,
        transferType: "donation",
        batchId,
        createdAt: now.toISOString(),
      };
    });
    const CHUNK = 500;
    for (let i = 0; i < logEntries.length; i += CHUNK) {
      await db.insert(donationTransfersTable).values(
        logEntries.slice(i, i + CHUNK).map(e => ({ ...e, createdAt: new Date(e.createdAt) }))
      );
    }
  }

  invalidateKACache();
  refreshProjectStats();
  res.json({ success: true, moved: movedCount, alreadyInTarget, skipped: skipExisting ? alreadyInTarget : 0, transferredItems, batchId });
  auditLog({
    action: "bulk_transfer",
    entityType: "pool",
    req,
    projectId,
    targetKesimAlaniId,
    affectedCount: movedCount,
    metadata: {
      targetKesimAlaniName: targetKA.name,
      alreadyInTarget,
      skipped: skipExisting ? alreadyInTarget : 0,
      donationIds: donationIds.slice(0, 100),
    },
  });
}));

async function getFilteredDonationIds(projectId: string, filter: Record<string, unknown>): Promise<string[]> {
  const filterWhere = buildStatsFilterSQL(projectId, filter);
  const result = await db.execute(sql`
    SELECT d.id
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ${filterWhere}
  `);
  return (result.rows as { id: string }[]).map(r => r.id);
}

const bulkUpdateSchema = z.object({
  donationIds: z.array(z.string()).max(50000).optional(),
  filter: z.record(z.unknown()).optional(),
  action: z.enum(["exclude", "include", "delete"]),
}).refine(d => (d.donationIds && d.donationIds.length > 0) || d.filter, {
  message: ERROR_MESSAGES.BULK_IDS_OR_FILTER_REQUIRED,
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

  let donationIds: string[];
  const { action } = parsed.data;
  if (parsed.data.filter && (!parsed.data.donationIds || parsed.data.donationIds.length === 0)) {
    donationIds = await getFilteredDonationIds(projectId, parsed.data.filter as Record<string, unknown>);
  } else {
    donationIds = parsed.data.donationIds!;
  }

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
  auditLog({
    action: "bulk_action",
    entityType: "donation",
    req,
    projectId,
    affectedCount: affected,
    filters: parsed.data.filter ?? null,
    metadata: { action, donationIdCount: parsed.data.donationIds?.length ?? 0 },
  });
}));

const logFilterSchema = z.object({
  filters: z.record(z.unknown()).default({}),
  affectedCount: z.number().int().nonnegative().optional(),
});

router.post("/projects/:id/pool/log-filter", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const parsed = logFilterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  res.json({ success: true });
  auditLog({
    action: "filter_apply",
    entityType: "pool",
    req,
    projectId,
    filters: parsed.data.filters,
    affectedCount: parsed.data.affectedCount,
  });
}));

router.post("/projects/:id/donations/bulk-delete-preview", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const kaRows = await db.select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  if (kaRows.length === 0) {
    res.json({ total: 0, inKesimListesi: 0, kesimListeleri: [] });
    return;
  }

  const filterWhere = buildStatsFilterSQL(projectId, req.body as Record<string, unknown>);

  const allMatchingResult = await db.execute(sql`
    SELECT d.id, ka.name AS ka_name, ka.id AS ka_id
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ${filterWhere}
  `);

  const allRows = allMatchingResult.rows as { id: string; ka_name: string; ka_id: string }[];
  const total = allRows.length;

  const inKesimMap = new Map<string, { id: string; name: string; count: number }>();
  for (const row of allRows) {
    if (row.ka_name !== "__havuz__") {
      const existing = inKesimMap.get(row.ka_id);
      if (existing) {
        existing.count++;
      } else {
        inKesimMap.set(row.ka_id, { id: row.ka_id, name: row.ka_name, count: 1 });
      }
    }
  }

  const kesimListeleri = Array.from(inKesimMap.values());
  const inKesimListesi = kesimListeleri.reduce((acc, k) => acc + k.count, 0);

  res.json({ total, inKesimListesi, kesimListeleri });
}));

router.post("/projects/:id/donations/bulk-delete", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const body = req.body as Record<string, unknown>;
  if (body.force !== true) {
    res.status(400).json({ error: "force: true bayrağı zorunludur" });
    return;
  }

  const kaRows = await db.select({ id: kesimAlanlariTable.id })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  const { force: _force, ...appliedFilters } = body;
  const loggedFilters = Object.keys(appliedFilters).length > 0 ? appliedFilters : null;

  if (kaRows.length === 0) {
    res.json({ success: true, affected: 0 });
    auditLog({ action: "delete", entityType: "donation", req, projectId, affectedCount: 0, filters: loggedFilters });
    return;
  }

  const filterWhere = buildStatsFilterSQL(projectId, body);

  const matchingIdsResult = await db.execute(sql`
    SELECT d.id
    FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ${filterWhere}
  `);

  const ids = (matchingIdsResult.rows as { id: string }[]).map(r => r.id);

  if (ids.length === 0) {
    res.json({ success: true, affected: 0 });
    auditLog({ action: "delete", entityType: "donation", req, projectId, affectedCount: 0, filters: loggedFilters });
    return;
  }

  await db.transaction(async (tx) => {
    const CHUNK = 1000;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      await tx.delete(donationTagsTable).where(inArray(donationTagsTable.donationId, chunk));
      await tx.delete(donationsTable).where(inArray(donationsTable.id, chunk));
    }
  });

  invalidateKACache();
  refreshProjectStats();
  res.json({ success: true, affected: ids.length });
  auditLog({
    action: "delete",
    entityType: "donation",
    req,
    projectId,
    affectedCount: ids.length,
    filters: loggedFilters,
  });
}));

router.delete("/projects/:id/donations", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const projectKAIds = await db.select({ id: kesimAlanlariTable.id })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));
  const validKAIds = projectKAIds.map(k => k.id);

  if (validKAIds.length === 0) {
    res.json({ success: true, affected: 0 });
    return;
  }

  const result = await db.update(donationsTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(
      inArray(donationsTable.kesimAlaniId, validKAIds),
      isNull(donationsTable.deletedAt),
    ))
    .returning({ id: donationsTable.id });

  invalidateKACache();
  refreshProjectStats();
  res.json({ success: true, affected: result.length });
}));

router.get("/projects/:id/donations/assigned-vekalets", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  // With the MOVE model, a transferred donation is no longer in __havuz__ —
  // it lives directly in the target kesim alanı. So "assigned" vekalets are
  // simply all vekalets currently in non-pool (non-__havuz__) KAs.
  const result = await db.execute(sql`
    SELECT DISTINCT d.vekalet
    FROM donations d
    JOIN kesim_alanlari ka ON d.kesim_alani_id = ka.id
    WHERE ka.project_id = ${projectId}
      AND ka.name != '__havuz__'
      AND ka.deleted_at IS NULL
      AND d.deleted_at IS NULL
      AND d.vekalet IS NOT NULL
      AND d.vekalet != ''
  `);

  const vekalets = result.rows.map((r: Record<string, unknown>) => r.vekalet as string);
  res.json({ vekalets });
}));

const vekaletCheckSchema = z.object({
  vekalets: z.array(z.string().trim().min(1)).min(1).max(100000),
  scope: z.enum(["pool", "kesim", "all"]).default("all"),
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

  const { vekalets, scope } = parsed.data;

  const CHUNK = 500;
  const allConflicts: Array<{ vekalet: string; id: string; name: string; description: string; kesimAlaniId: string; kesimAlaniName: string }> = [];
  for (let i = 0; i < vekalets.length; i += CHUNK) {
    const chunk = vekalets.slice(i, i + CHUNK);
    const scopeCondition = scope === "pool"
      ? eq(kesimAlanlariTable.name, "__havuz__")
      : scope === "kesim"
        ? ne(kesimAlanlariTable.name, "__havuz__")
        : undefined;
    const existing = await db.select({
      vekalet: donationsTable.vekalet,
      id: donationsTable.id,
      name: donationsTable.name,
      description: donationsTable.description,
      kesimAlaniId: donationsTable.kesimAlaniId,
      kesimAlaniName: kesimAlanlariTable.name,
    }).from(donationsTable)
      .innerJoin(kesimAlanlariTable, eq(donationsTable.kesimAlaniId, kesimAlanlariTable.id))
      .where(and(
        isNull(donationsTable.deletedAt),
        isNull(kesimAlanlariTable.deletedAt),
        eq(kesimAlanlariTable.projectId, projectId),
        inArray(donationsTable.vekalet, chunk),
        scopeCondition,
      ));
    allConflicts.push(...existing.map(e => ({
      ...e,
      vekalet: e.vekalet || "",
      description: e.description || "",
      kesimAlaniName: e.kesimAlaniName === "__havuz__" ? "Bağış Havuzu" : (e.kesimAlaniName || ""),
    })));
  }

  res.json({ conflicts: allConflicts });
}));

const bulkTagSchema = z.object({
  donationIds: z.array(z.string()).max(50000).optional(),
  filter: z.record(z.unknown()).optional(),
  tagId: z.string().min(1),
  action: z.enum(["add", "remove"]).default("add"),
}).refine(d => (d.donationIds && d.donationIds.length > 0) || d.filter, {
  message: ERROR_MESSAGES.BULK_IDS_OR_FILTER_REQUIRED,
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

  let donationIds: string[];
  const { tagId, action } = parsed.data;
  if (parsed.data.filter && (!parsed.data.donationIds || parsed.data.donationIds.length === 0)) {
    donationIds = await getFilteredDonationIds(projectId, parsed.data.filter as Record<string, unknown>);
  } else {
    donationIds = parsed.data.donationIds!;
  }

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

  const CHUNK = 500;
  const affectedIds: string[] = [];
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
        affectedIds.push(...result.map(r => r.donationId));
      } else {
        const result = await tx.delete(donationTagsTable)
          .where(and(
            inArray(donationTagsTable.donationId, validIds),
            eq(donationTagsTable.tagId, tagId),
          ))
          .returning({ donationId: donationTagsTable.donationId });
        affectedIds.push(...result.map(r => r.donationId));
      }
    }
  });

  invalidateKACache();
  res.json({ success: true, affected: affectedIds.length, affectedIds });
}));

const flagSchema = z.object({
  reason: z.string().default(""),
});

router.post("/projects/:projectId/donations/:id/flag", asyncHandler(async (req, res) => {
  const { projectId, id: donationId } = req.params;
  const parsed = flagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA });
    return;
  }
  const [donation] = await db.select({ id: donationsTable.id })
    .from(donationsTable)
    .innerJoin(kesimAlanlariTable, eq(donationsTable.kesimAlaniId, kesimAlanlariTable.id))
    .where(and(
      eq(donationsTable.id, donationId),
      eq(kesimAlanlariTable.projectId, projectId),
      isNull(donationsTable.deletedAt),
      isNull(kesimAlanlariTable.deletedAt),
    ));
  if (!donation) { res.status(404).json({ error: "Bağış bulunamadı" }); return; }
  await db.update(donationsTable)
    .set({ isFlagged: true, flagReason: parsed.data.reason, flagResolvedAt: null, updatedAt: new Date() })
    .where(eq(donationsTable.id, donationId));
  invalidateKACache();
  res.json({ success: true });
}));

router.post("/projects/:projectId/donations/:id/unflag", asyncHandler(async (req, res) => {
  const { projectId, id: donationId } = req.params;
  const [donation] = await db.select({ id: donationsTable.id })
    .from(donationsTable)
    .innerJoin(kesimAlanlariTable, eq(donationsTable.kesimAlaniId, kesimAlanlariTable.id))
    .where(and(
      eq(donationsTable.id, donationId),
      eq(kesimAlanlariTable.projectId, projectId),
      isNull(donationsTable.deletedAt),
      isNull(kesimAlanlariTable.deletedAt),
    ));
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

  const parsed = inlineEditSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA }); return; }

  const [donation] = await db.select({ id: donationsTable.id })
    .from(donationsTable)
    .innerJoin(kesimAlanlariTable, eq(donationsTable.kesimAlaniId, kesimAlanlariTable.id))
    .where(and(
      eq(donationsTable.id, donationId),
      eq(kesimAlanlariTable.projectId, projectId),
      isNull(donationsTable.deletedAt),
      isNull(kesimAlanlariTable.deletedAt),
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
    if (parsed.data.field === "notes") {
      dbValue = normalizeNotes(dbValue);
    }
  }

  await db.update(donationsTable)
    .set({ [parsed.data.field]: dbValue, updatedAt: new Date() })
    .where(eq(donationsTable.id, donationId));

  invalidateKACache();
  res.json({ success: true });
}));

const bulkNotesSchema = z.object({
  donationIds: z.array(z.string()).max(50000).optional(),
  filter: z.record(z.unknown()).optional(),
  note: z.string().min(1).max(5000),
  mode: z.enum(["append", "replace"]).default("append"),
}).refine(d => (d.donationIds && d.donationIds.length > 0) || d.filter, {
  message: ERROR_MESSAGES.BULK_IDS_OR_FILTER_REQUIRED,
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

  let donationIds: string[];
  const { note, mode } = parsed.data;
  if (parsed.data.filter && (!parsed.data.donationIds || parsed.data.donationIds.length === 0)) {
    donationIds = await getFilteredDonationIds(projectId, parsed.data.filter as Record<string, unknown>);
  } else {
    donationIds = parsed.data.donationIds!;
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
  const previousNotes: { donationId: string; notes: string }[] = [];

  for (let i = 0; i < donationIds.length; i += CHUNK) {
    const chunk = donationIds.slice(i, i + CHUNK);
    const scopedWhere = and(
      inArray(donationsTable.id, chunk),
      inArray(donationsTable.kesimAlaniId, validKAIds),
      isNull(donationsTable.deletedAt),
    );

    await db.transaction(async (tx) => {
      const snapshots = await tx.select({ id: donationsTable.id, notes: donationsTable.notes })
        .from(donationsTable)
        .where(scopedWhere)
        .for("update");
      for (const snap of snapshots) {
        previousNotes.push({ donationId: snap.id, notes: snap.notes ?? "" });
      }

      if (mode === "replace") {
        const result = await tx.update(donationsTable)
          .set({ notes: note, updatedAt: new Date() })
          .where(scopedWhere)
          .returning({ id: donationsTable.id });
        affected += result.length;
      } else {
        const result = await tx.execute(sql`
          UPDATE donations SET
            notes = CASE WHEN notes IS NULL OR notes = '' THEN ${note} ELSE notes || E'\n' || ${note} END,
            updated_at = NOW()
          WHERE id IN (${sql.join(chunk.map(id => sql`${id}`), sql`, `)})
            AND kesim_alani_id IN (${sql.join(validKAIds.map(id => sql`${id}`), sql`, `)})
            AND deleted_at IS NULL
        `);
        affected += Number((result as { rowCount?: number }).rowCount || 0);
      }
    });
  }

  invalidateKACache();
  res.json({ success: true, affected, previousNotes });
}));

router.post("/projects/:id/donations/restore-notes", asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }

  const parsed = z.object({
    restores: z.array(z.object({
      donationId: z.string().min(1),
      notes: z.string(),
    })).min(1).max(50000),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
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
  const restores = parsed.data.restores;

  for (let i = 0; i < restores.length; i += CHUNK) {
    const chunk = restores.slice(i, i + CHUNK);
    await db.transaction(async (tx) => {
      for (const { donationId, notes } of chunk) {
        const result = await tx.update(donationsTable)
          .set({ notes, updatedAt: new Date() })
          .where(and(
            eq(donationsTable.id, donationId),
            inArray(donationsTable.kesimAlaniId, validKAIds),
            isNull(donationsTable.deletedAt),
          ))
          .returning({ id: donationsTable.id });
        affected += result.length;
      }
    });
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
    notes: normalizeNotes(d.notes),
    phone: d.phone || "",
    excluded: d.excluded,
    isFlagged: d.isFlagged,
    flagReason: d.flagReason,
    aiWarnings: d.aiWarnings || "",
    aiCategories: parseAiCategories(d.aiCategories),
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
  "shareCount", "tags", "aiCategories", "aiWarnings",
] as const;

const ALLOWED_RULE_OPERATORS = [
  "equals", "not_equals", "contains", "not_contains",
  "in", "not_in", "gt", "gte", "lt", "lte", "between",
  "is_empty", "is_not_empty",
] as const;

const ruleConditionSchema = z.object({
  field: z.enum(ALLOWED_RULE_FIELDS),
  operator: z.enum(ALLOWED_RULE_OPERATORS),
  value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]).optional(),
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

const baseRuleActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("transfer_to_ka"), targetKesimAlaniId: z.string().min(1) }),
  z.object({ type: z.literal("add_tag"), tagId: z.string().min(1) }),
  z.object({ type: z.literal("flag"), flagReason: z.string().optional() }),
  z.object({ type: z.literal("exclude") }),
]);

const ruleActionSchema: z.ZodType<unknown> = z.union([
  baseRuleActionSchema,
  z.object({
    type: z.literal("compound"),
    actions: z.array(baseRuleActionSchema).min(1),
  }),
]);

const automationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  conditions: conditionsFieldSchema,
  action: ruleActionSchema,
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
    action: ruleActionSchema.optional(),
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
