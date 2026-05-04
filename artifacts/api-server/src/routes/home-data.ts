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
export const WARNINGS_CACHE_KEY = "projects:warnings";
const WARNINGS_TTL = 30_000;
export const DELETED_PROJECTS_CACHE_KEY = "projects:deleted";
const DELETED_PROJECTS_TTL = 60_000;
export const ARCHIVED_PROJECTS_CACHE_KEY = "projects:archived";
const ARCHIVED_PROJECTS_TTL = 60_000;

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

type ProjectWarnings = {
  unassignedShares: number;
  duplicateVekalets: number;
  wrongCountGroups: number;
  missingVekalet: number;
};

async function fetchProjectWarnings(): Promise<Record<string, ProjectWarnings>> {
  const cached = cacheGet<Record<string, ProjectWarnings>>(WARNINGS_CACHE_KEY);
  if (cached) return cached;

  const result = await db.execute(sql`
    WITH active_projects AS (
      SELECT id FROM projects WHERE deleted_at IS NULL AND archived_at IS NULL
    ),
    unassigned AS (
      SELECT ka.project_id, COUNT(d.id)::int AS cnt
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ka.project_id IN (SELECT id FROM active_projects)
        AND ka.deleted_at IS NULL
        AND d.deleted_at IS NULL
        AND d.excluded = false
        AND ka.name != '__havuz__'
        AND NOT EXISTS (
          SELECT 1 FROM animal_group_donations agd
          JOIN animal_groups ag ON ag.id = agd.group_id
          WHERE agd.donation_id = d.id AND ag.deleted_at IS NULL
        )
      GROUP BY ka.project_id
    ),
    dup_vekalet AS (
      SELECT project_id, COUNT(*)::int AS cnt
      FROM (
        SELECT ka.project_id, d.vekalet
        FROM donations d
        JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
        WHERE ka.project_id IN (SELECT id FROM active_projects)
          AND ka.deleted_at IS NULL
          AND ka.name != '__havuz__'
          AND d.deleted_at IS NULL
          AND d.vekalet IS NOT NULL AND d.vekalet != ''
        GROUP BY ka.project_id, d.vekalet
        HAVING COUNT(*) > 1
      ) t
      GROUP BY project_id
    ),
    wrong_groups AS (
      SELECT project_id, COUNT(*)::int AS cnt
      FROM (
        SELECT ag.id, ka.project_id,
          COALESCE(SUM(CASE WHEN d.deleted_at IS NULL AND NOT d.excluded THEN d.share_count ELSE 0 END), 0) AS total_shares
        FROM animal_groups ag
        JOIN kesim_alanlari ka ON ka.id = ag.kesim_alani_id
        LEFT JOIN animal_group_donations agd ON agd.group_id = ag.id
        LEFT JOIN donations d ON d.id = agd.donation_id
        WHERE ka.project_id IN (SELECT id FROM active_projects)
          AND ka.deleted_at IS NULL
          AND ag.deleted_at IS NULL
        GROUP BY ag.id, ka.project_id
        HAVING COALESCE(SUM(CASE WHEN d.deleted_at IS NULL AND NOT d.excluded THEN d.share_count ELSE 0 END), 0) NOT IN (0, 7)
      ) t
      GROUP BY project_id
    ),
    missing_vekalet AS (
      SELECT ka.project_id, COUNT(d.id)::int AS cnt
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE ka.project_id IN (SELECT id FROM active_projects)
        AND ka.deleted_at IS NULL
        AND d.deleted_at IS NULL
        AND d.excluded = false
        AND (d.vekalet IS NULL OR d.vekalet = '')
        AND ka.name != '__havuz__'
      GROUP BY ka.project_id
    )
    SELECT
      p.id AS project_id,
      COALESCE(u.cnt, 0) AS unassigned_shares,
      COALESCE(dv.cnt, 0) AS duplicate_vekalets,
      COALESCE(wg.cnt, 0) AS wrong_count_groups,
      COALESCE(mv.cnt, 0) AS missing_vekalet
    FROM active_projects p
    LEFT JOIN unassigned u ON u.project_id = p.id
    LEFT JOIN dup_vekalet dv ON dv.project_id = p.id
    LEFT JOIN wrong_groups wg ON wg.project_id = p.id
    LEFT JOIN missing_vekalet mv ON mv.project_id = p.id
  `);

  const map: Record<string, ProjectWarnings> = {};
  for (const row of result.rows as { project_id: string; unassigned_shares: number; duplicate_vekalets: number; wrong_count_groups: number; missing_vekalet: number }[]) {
    map[row.project_id] = {
      unassignedShares: Number(row.unassigned_shares),
      duplicateVekalets: Number(row.duplicate_vekalets),
      wrongCountGroups: Number(row.wrong_count_groups),
      missingVekalet: Number(row.missing_vekalet),
    };
  }
  cacheSet(WARNINGS_CACHE_KEY, map, WARNINGS_TTL);
  return map;
}

router.get("/home-data", asyncHandler(async (_req, res) => {
  const [
    kaResult,
    deletedKaResult,
    tags,
    logoResult,
    activeProjectsRows,
    deletedProjects,
    archivedProjectsRows,
    warnings,
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
    (async () => {
      const cached = cacheGet<unknown[]>(DELETED_PROJECTS_CACHE_KEY);
      if (cached) return cached;
      const rows = await db.select().from(projectsTable).where(isNotNull(projectsTable.deletedAt));
      cacheSet(DELETED_PROJECTS_CACHE_KEY, rows, DELETED_PROJECTS_TTL);
      return rows;
    })(),
    (async () => {
      const cached = cacheGet<ReturnType<typeof mapProjectRow>[]>(ARCHIVED_PROJECTS_CACHE_KEY);
      if (cached) return cached;
      const rows = await db.execute(sql`
        ${projectsWithStatsQuery}
        WHERE p.archived_at IS NOT NULL AND p.deleted_at IS NULL
        ORDER BY p.archived_at DESC
      `);
      const result = (rows.rows as ProjectRow[]).map(mapProjectRow);
      cacheSet(ARCHIVED_PROJECTS_CACHE_KEY, result, ARCHIVED_PROJECTS_TTL);
      return result;
    })(),
    fetchProjectWarnings().catch(() => ({} as Record<string, ProjectWarnings>)),
  ]);

  const projectsWithWarnings = (activeProjectsRows as ReturnType<typeof mapProjectRow>[]).map(p => ({
    ...p,
    warnings: warnings[p.id] ?? { unassignedShares: 0, duplicateVekalets: 0, wrongCountGroups: 0, missingVekalet: 0 },
  }));

  res.json({
    kesimAlanlari: kaResult.data,
    deletedKesimAlanlari: deletedKaResult.data,
    tags,
    logo: logoResult,
    projects: projectsWithWarnings,
    deletedProjects,
    archivedProjects: archivedProjectsRows,
  });
}));

export default router;
