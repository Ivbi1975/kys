import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  kesimAlanlariTable,
  animalGroupsTable,
  donationsTable,
  animalGroupDonationsTable,
  trackingNotesTable,
  notificationLogsTable,
  animalGroupPhotosTable,
  teamsTable,
  donationTagsTable,
  donationTransfersTable,
} from "@workspace/db/schema";
import { eq, isNull, isNotNull, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from "../lib/cache";
import { asyncHandler } from "../middleware/error-handler";
import { ERROR_MESSAGES, MATERIALIZED_VIEW_DEBOUNCE_MS } from "../lib/constants";
import { logger } from "../lib/logger";
import { invalidateKACache } from "../services/kesim-alani.service";
import { auditLog } from "../services/audit-log.service";

const idParamSchema = z.object({
  id: z.string().min(1),
});

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Proje adı gerekli"),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(1, "Proje adı gerekli"),
});

const PROJECTS_CACHE_KEY = "projects:list";
const PROJECTS_TTL = 60_000;

const router: IRouter = Router();

const emptyStats = { donorCount: 0, shareCount: 0, groupCount: 0, kesildiCount: 0, lastKesildiAt: null };

let refreshInProgress = false;
let refreshQueued = false;
let lastRefreshTime = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function doRefresh() {
  if (refreshInProgress) {
    refreshQueued = true;
    return;
  }
  refreshInProgress = true;
  try {
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY project_stats_view`);
    cacheInvalidate(PROJECTS_CACHE_KEY);
    cacheInvalidatePrefix("dashboard:");
    lastRefreshTime = Date.now();
  } catch (err) {
    logger.error({ err }, "Failed to refresh project_stats_view");
  } finally {
    refreshInProgress = false;
    if (refreshQueued) {
      refreshQueued = false;
      doRefresh();
    }
  }
}

export function refreshProjectStats() {
  const elapsed = Date.now() - lastRefreshTime;
  if (elapsed >= MATERIALIZED_VIEW_DEBOUNCE_MS) {
    doRefresh();
    return;
  }
  if (debounceTimer) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    doRefresh();
  }, MATERIALIZED_VIEW_DEBOUNCE_MS - elapsed);
}

export async function refreshProjectStatsImmediate() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  await doRefresh();
}

type ProjectRow = {
  id: string; name: string; description: string;
  created_at: string; deleted_at: string | null;
  archived_at: string | null;
  donor_count: number; share_count: number;
  group_count: number; kesildi_count: number;
  last_kesildi_at: string | null;
};

function mapProjectRow(r: ProjectRow) {
  return {
    id: r.id,
    name: r.name,
    description: r.description || "",
    createdAt: new Date(r.created_at),
    deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
    archivedAt: r.archived_at ? new Date(r.archived_at) : null,
    stats: {
      donorCount: Number(r.donor_count),
      shareCount: Number(r.share_count),
      groupCount: Number(r.group_count),
      kesildiCount: Number(r.kesildi_count),
      lastKesildiAt: r.last_kesildi_at,
    },
  };
}

const projectsWithStatsQuery = sql`
  SELECT
    p.*,
    COALESCE(s.donor_count, 0) AS donor_count,
    COALESCE(s.share_count, 0) AS share_count,
    COALESCE(s.group_count, 0) AS group_count,
    COALESCE(s.kesildi_count, 0) AS kesildi_count,
    s.last_kesildi_at
  FROM projects p
  LEFT JOIN project_stats_view s ON s.project_id = p.id
`;

router.get("/projects", asyncHandler(async (_req, res) => {
  const cached = cacheGet<unknown[]>(PROJECTS_CACHE_KEY);
  if (cached) {
    res.json(cached);
    return;
  }

  const rows = await db.execute(sql`
    ${projectsWithStatsQuery}
    WHERE p.deleted_at IS NULL AND p.archived_at IS NULL
    ORDER BY p.created_at
  `);

  const result = (rows.rows as ProjectRow[]).map(mapProjectRow);
  cacheSet(PROJECTS_CACHE_KEY, result, PROJECTS_TTL);
  res.json(result);
}));

router.post("/projects", asyncHandler(async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { name } = parsed.data;
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const now = new Date();
  await db.insert(projectsTable).values({ id, name, createdAt: now });
  await refreshProjectStatsImmediate();
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  res.status(201).json({ ...project, stats: emptyStats });
  auditLog({ action: "create", entityType: "project", entityId: id, entityName: name, req });
}));

router.put("/projects/:id", asyncHandler(async (req, res) => {
  const paramsParsed = idParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: paramsParsed.error.issues });
    return;
  }
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id } = paramsParsed.data;
  const { name } = parsed.data;
  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!existing) { res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND }); return; }

  await db.update(projectsTable).set({ name }).where(eq(projectsTable.id, id));
  cacheInvalidate(PROJECTS_CACHE_KEY);
  const [updated] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  res.json({ ...updated, stats: emptyStats });
  auditLog({ action: "update", entityType: "project", entityId: id, entityName: name, oldValue: { name: existing.name }, newValue: { name }, req });
}));

router.delete("/projects/:id", asyncHandler(async (req, res) => {
  const paramsParsed = idParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: paramsParsed.error.issues });
    return;
  }

  const permanent = req.query.permanent === "true";
  const { id } = paramsParsed.data;
  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!existing) { res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND }); return; }

  if (permanent) {
    await db.transaction(async (tx) => {
      const kesimRows = await tx.select({ id: kesimAlanlariTable.id })
        .from(kesimAlanlariTable)
        .where(eq(kesimAlanlariTable.projectId, id));
      const kaIds = kesimRows.map(k => k.id);

      if (kaIds.length > 0) {
        const groupRows = await tx.select({ id: animalGroupsTable.id })
          .from(animalGroupsTable)
          .where(inArray(animalGroupsTable.kesimAlaniId, kaIds));
        const groupIds = groupRows.map(g => g.id);

        if (groupIds.length > 0) {
          await tx.delete(animalGroupPhotosTable).where(inArray(animalGroupPhotosTable.animalGroupId, groupIds));
          await tx.delete(animalGroupDonationsTable).where(inArray(animalGroupDonationsTable.groupId, groupIds));
        }

        await tx.delete(animalGroupsTable).where(inArray(animalGroupsTable.kesimAlaniId, kaIds));
        await tx.delete(trackingNotesTable).where(inArray(trackingNotesTable.kesimAlaniId, kaIds));
        await tx.delete(notificationLogsTable).where(inArray(notificationLogsTable.kesimAlaniId, kaIds));

        const donationRows = await tx.select({ id: donationsTable.id })
          .from(donationsTable)
          .where(inArray(donationsTable.kesimAlaniId, kaIds));
        const donationIds = donationRows.map(d => d.id);
        if (donationIds.length > 0) {
          await tx.delete(donationTagsTable).where(inArray(donationTagsTable.donationId, donationIds));
        }

        await tx.delete(donationsTable).where(inArray(donationsTable.kesimAlaniId, kaIds));
        await tx.delete(teamsTable).where(inArray(teamsTable.kesimAlaniId, kaIds));
        await tx.delete(kesimAlanlariTable).where(inArray(kesimAlanlariTable.id, kaIds));
      }

      await tx.delete(donationTransfersTable).where(eq(donationTransfersTable.projectId, id));
      await tx.delete(projectsTable).where(eq(projectsTable.id, id));
    });

    invalidateKACache();
    cacheInvalidate(PROJECTS_CACHE_KEY);
    cacheInvalidatePrefix("kesim-alanlari");
    await refreshProjectStatsImmediate();
    res.json({ success: true });
  } else {
    await db.update(projectsTable).set({ deletedAt: new Date() }).where(eq(projectsTable.id, id));
    await refreshProjectStatsImmediate();
    res.json({ success: true });
  }
  auditLog({ action: "delete", entityType: "project", entityId: id, entityName: existing.name, newValue: { permanent }, req });
}));

router.post("/projects/:id/restore", asyncHandler(async (req, res) => {
  const paramsParsed = idParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: paramsParsed.error.issues });
    return;
  }

  const { id } = paramsParsed.data;
  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!existing) { res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND }); return; }

  await db.update(projectsTable).set({ deletedAt: null }).where(eq(projectsTable.id, id));
  await refreshProjectStatsImmediate();
  const [restored] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  res.json({ ...restored, stats: emptyStats });
  auditLog({ action: "restore", entityType: "project", entityId: id, entityName: existing.name, req });
}));

router.get("/projects/deleted", asyncHandler(async (_req, res) => {
  const deleted = await db
    .select()
    .from(projectsTable)
    .where(isNotNull(projectsTable.deletedAt));
  res.json(deleted);
}));

router.get("/projects/archived", asyncHandler(async (_req, res) => {
  const rows = await db.execute(sql`
    ${projectsWithStatsQuery}
    WHERE p.archived_at IS NOT NULL AND p.deleted_at IS NULL
    ORDER BY p.archived_at DESC
  `);

  const result = (rows.rows as ProjectRow[]).map(mapProjectRow);
  res.json(result);
}));

router.post("/projects/:id/archive", asyncHandler(async (req, res) => {
  const paramsParsed = idParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: paramsParsed.error.issues });
    return;
  }

  const { id } = paramsParsed.data;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }
  if (project.deletedAt) { res.status(400).json({ error: ERROR_MESSAGES.DELETED_PROJECT_CANNOT_ARCHIVE }); return; }
  if (project.archivedAt) { res.status(400).json({ error: ERROR_MESSAGES.PROJECT_ALREADY_ARCHIVED }); return; }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.update(projectsTable)
      .set({ archivedAt: now })
      .where(eq(projectsTable.id, id));

    const kesimAlanlari = await tx.select({ id: kesimAlanlariTable.id })
      .from(kesimAlanlariTable)
      .where(and(
        eq(kesimAlanlariTable.projectId, id),
        isNull(kesimAlanlariTable.deletedAt)
      ));

    if (kesimAlanlari.length > 0) {
      const kaIds = kesimAlanlari.map(k => k.id);
      await tx.update(kesimAlanlariTable)
        .set({ deletedAt: now })
        .where(inArray(kesimAlanlariTable.id, kaIds));
    }
  });

  await refreshProjectStatsImmediate();
  cacheInvalidatePrefix("kesim-alanlari");

  res.json({ success: true, archivedAt: now });
  auditLog({ action: "archive", entityType: "project", entityId: id, entityName: project.name, req });
}));

router.post("/projects/:id/unarchive", asyncHandler(async (req, res) => {
  const paramsParsed = idParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: paramsParsed.error.issues });
    return;
  }

  const { id } = paramsParsed.data;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }); return; }
  if (!project.archivedAt) { res.status(400).json({ error: ERROR_MESSAGES.PROJECT_NOT_ARCHIVED }); return; }

  await db.transaction(async (tx) => {
    const archivedAt = project.archivedAt!;

    await tx.update(projectsTable)
      .set({ archivedAt: null })
      .where(eq(projectsTable.id, id));

    await tx.update(kesimAlanlariTable)
      .set({ deletedAt: null })
      .where(and(
        eq(kesimAlanlariTable.projectId, id),
        eq(kesimAlanlariTable.deletedAt, archivedAt)
      ));
  });

  await refreshProjectStatsImmediate();
  cacheInvalidatePrefix("kesim-alanlari");

  const [restored] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  res.json({ ...restored, archivedAt: null, stats: emptyStats });
  auditLog({ action: "unarchive", entityType: "project", entityId: id, entityName: project.name, req });
}));

const DASHBOARD_CACHE_TTL = 30_000;

router.get("/projects/:id/dashboard", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const dashCacheKey = `dashboard:${id}`;
  const cached = cacheGet<unknown>(dashCacheKey);
  if (cached) { res.json(cached); return; }

  const combined = await db.execute(sql`
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      p.deleted_at,
      ka.id,
      ka.name,
      COUNT(ag.id)::int AS total_animals,
      COUNT(ag.id) FILTER (WHERE ag.kesildi = true)::int AS kesildi_count,
      MAX(ag.kesildi_at) AS last_kesildi_at
    FROM projects p
    LEFT JOIN kesim_alanlari ka ON ka.project_id = p.id AND ka.deleted_at IS NULL
    LEFT JOIN animal_groups ag ON ag.kesim_alani_id = ka.id AND ag.deleted_at IS NULL
    WHERE p.id = ${id}
    GROUP BY p.id, p.name, p.deleted_at, ka.id, ka.name
    ORDER BY ka.name
  `);

  if (combined.rows.length === 0) {
    res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND });
    return;
  }

  const firstRow = combined.rows[0] as { project_id: string; project_name: string; deleted_at: string | null };
  if (!firstRow.project_id) { res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND }); return; }

  const areaStats = { rows: combined.rows.filter((r: unknown) => (r as { id: string | null }).id !== null) };

  type AreaStatRow = { id: string; name: string; total_animals: number; kesildi_count: number; last_kesildi_at: string | null };
  const rows = areaStats.rows as AreaStatRow[];

  let totalAnimals = 0;
  let kesildiCount = 0;
  let lastKesildiAt: string | null = null;

  const kesimAlanlari = rows.map(r => {
    totalAnimals += r.total_animals;
    kesildiCount += r.kesildi_count;
    if (r.last_kesildi_at && (!lastKesildiAt || r.last_kesildi_at > lastKesildiAt)) {
      lastKesildiAt = r.last_kesildi_at;
    }
    return {
      id: r.id,
      name: r.name,
      totalAnimals: r.total_animals,
      kesildiCount: r.kesildi_count,
      kesildiPercent: r.total_animals > 0 ? Math.round((r.kesildi_count / r.total_animals) * 100) : 0,
      lastKesildiAt: r.last_kesildi_at,
    };
  });

  const response = {
    projectId: id,
    projectName: firstRow.project_name,
    totalAnimals,
    kesildiCount,
    remainingCount: totalAnimals - kesildiCount,
    kesildiPercent: totalAnimals > 0 ? Math.round((kesildiCount / totalAnimals) * 100) : 0,
    lastKesildiAt,
    kesimAlanlari,
  };
  cacheSet(dashCacheKey, response, DASHBOARD_CACHE_TTL);
  res.json(response);
}));

export default router;
