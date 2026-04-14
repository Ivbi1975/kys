import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  customTagsTable,
  appSettingsTable,
  projectsTable,
} from "@workspace/db/schema";
import { isNotNull, sql, eq } from "drizzle-orm";
import { asyncHandler } from "../middleware/error-handler";
import { cacheGet, cacheSet } from "../lib/cache";
import { listKesimAlanlari, listDeletedKesimAlanlari } from "../services/core.service";

const router: IRouter = Router();

const TAGS_CACHE_KEY = "tags:list";
const TAGS_TTL = 300_000;
const LOGO_CACHE_KEY = "settings:logo";
const LOGO_TTL = 600_000;
const PROJECTS_CACHE_KEY = "projects:list";
const PROJECTS_TTL = 60_000;

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

router.get("/home-data", asyncHandler(async (_req, res) => {
  const [
    kaResult,
    deletedKaResult,
    tags,
    logoResult,
    activeProjectsRows,
    deletedProjects,
    archivedProjectsRows,
  ] = await Promise.all([
    listKesimAlanlari(false),
    listDeletedKesimAlanlari(),
    (async () => {
      const cached = cacheGet<unknown[]>(TAGS_CACHE_KEY);
      if (cached) return cached;
      const rows = await db.select().from(customTagsTable);
      cacheSet(TAGS_CACHE_KEY, rows, TAGS_TTL);
      return rows;
    })(),
    (async () => {
      const cached = cacheGet<{ logo: string | null }>(LOGO_CACHE_KEY);
      if (cached) return cached.logo;
      const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "logo"));
      const result = { logo: row?.value || null };
      cacheSet(LOGO_CACHE_KEY, result, LOGO_TTL);
      return result.logo;
    })(),
    (async () => {
      const cached = cacheGet<unknown[]>(PROJECTS_CACHE_KEY);
      if (cached) return cached;
      const rows = await db.execute(sql`
        ${projectsWithStatsQuery}
        WHERE p.deleted_at IS NULL AND p.archived_at IS NULL
        ORDER BY p.created_at
      `);
      const result = (rows.rows as ProjectRow[]).map(mapProjectRow);
      cacheSet(PROJECTS_CACHE_KEY, result, PROJECTS_TTL);
      return result;
    })(),
    db.select().from(projectsTable).where(isNotNull(projectsTable.deletedAt)),
    (async () => {
      const rows = await db.execute(sql`
        ${projectsWithStatsQuery}
        WHERE p.archived_at IS NOT NULL AND p.deleted_at IS NULL
        ORDER BY p.archived_at DESC
      `);
      return (rows.rows as ProjectRow[]).map(mapProjectRow);
    })(),
  ]);

  res.json({
    kesimAlanlari: kaResult.data,
    deletedKesimAlanlari: deletedKaResult.data,
    tags,
    logo: logoResult,
    projects: activeProjectsRows,
    deletedProjects,
    archivedProjects: archivedProjectsRows,
  });
}));

export default router;
