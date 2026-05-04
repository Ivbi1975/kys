import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  kesimAlanlariTable,
  animalGroupsTable,
  donationsTable,
  donationTagsTable,
  customTagsTable,
} from "@workspace/db/schema";
import { eq, isNull, and, sql, inArray } from "drizzle-orm";
import { asyncHandler } from "../middleware/error-handler";

const router: IRouter = Router();

router.get("/projects", asyncHandler(async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      p.created_at,
      COALESCE(s.share_count, 0) AS total_share_count
    FROM projects p
    LEFT JOIN project_stats_view s ON s.project_id = p.id
    WHERE p.deleted_at IS NULL AND p.archived_at IS NULL
    ORDER BY p.created_at
  `);

  type Row = { id: string; name: string; created_at: string; total_share_count: number };
  const result = (rows.rows as Row[]).map(r => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    totalShareCount: Number(r.total_share_count),
  }));

  res.json(result);
}));

router.get("/projects/:id/donations", asyncHandler(async (req, res) => {
  const projectId = req.params.id;

  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), isNull(projectsTable.deletedAt), isNull(projectsTable.archivedAt)));

  if (!project) {
    res.status(404).json({ error: "Proje bulunamadı." });
    return;
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const offset = (page - 1) * limit;

  const kaRows = await db
    .select({ id: kesimAlanlariTable.id })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  if (kaRows.length === 0) {
    res.json({ items: [], total: 0, page, limit, totalPages: 0 });
    return;
  }

  const kaIds = kaRows.map(k => k.id);
  const whereClause = and(inArray(donationsTable.kesimAlaniId, kaIds), isNull(donationsTable.deletedAt))!;

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(donationsTable).where(whereClause),
    db.select({
      id: donationsTable.id,
      name: donationsTable.name,
      description: donationsTable.description,
      shareCount: donationsTable.shareCount,
      vekalet: donationsTable.vekalet,
    }).from(donationsTable).where(whereClause)
      .orderBy(donationsTable.sortOrder, donationsTable.id)
      .limit(limit).offset(offset),
  ]);

  const total = countResult[0]?.count ?? 0;
  const donationIds = rows.map(r => r.id);

  let tagsByDonation: Record<string, { id: string; name: string }[]> = {};
  if (donationIds.length > 0) {
    const tags = await db
      .select({
        donationId: donationTagsTable.donationId,
        tagId: donationTagsTable.tagId,
        tagName: customTagsTable.name,
      })
      .from(donationTagsTable)
      .innerJoin(customTagsTable, eq(customTagsTable.id, donationTagsTable.tagId))
      .where(inArray(donationTagsTable.donationId, donationIds));
    for (const t of tags) {
      if (!tagsByDonation[t.donationId]) tagsByDonation[t.donationId] = [];
      tagsByDonation[t.donationId].push({ id: t.tagId, name: t.tagName });
    }
  }

  const items = rows.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    shareCount: d.shareCount,
    vekalet: d.vekalet,
    tags: tagsByDonation[d.id] || [],
  }));

  res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

router.get("/projects/:id/kesim-alanlari", asyncHandler(async (req, res) => {
  const projectId = req.params.id;

  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), isNull(projectsTable.deletedAt), isNull(projectsTable.archivedAt)));

  if (!project) {
    res.status(404).json({ error: "Proje bulunamadı." });
    return;
  }

  const rows = await db.execute(sql`
    SELECT
      ka.id,
      ka.name,
      ka.max_animal AS capacity,
      COUNT(ag.id) FILTER (WHERE ag.deleted_at IS NULL)::int AS active_group_count
    FROM kesim_alanlari ka
    LEFT JOIN animal_groups ag ON ag.kesim_alani_id = ka.id AND ag.deleted_at IS NULL
    WHERE ka.project_id = ${projectId}
      AND ka.deleted_at IS NULL
      AND ka.name != '__havuz__'
    GROUP BY ka.id, ka.name, ka.max_animal
    ORDER BY ka.name
  `);

  type Row = { id: string; name: string; capacity: number | null; active_group_count: number };
  const result = (rows.rows as Row[]).map(r => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity ?? null,
    activeGroupCount: Number(r.active_group_count),
  }));

  res.json(result);
}));

router.get("/projects/:id/kesim-alanlari/:kesimId/groups", asyncHandler(async (req, res) => {
  const { id: projectId, kesimId } = req.params;

  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), isNull(projectsTable.deletedAt), isNull(projectsTable.archivedAt)));

  if (!project) {
    res.status(404).json({ error: "Proje bulunamadı." });
    return;
  }

  const [ka] = await db
    .select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(and(
      eq(kesimAlanlariTable.id, kesimId),
      eq(kesimAlanlariTable.projectId, projectId),
      isNull(kesimAlanlariTable.deletedAt),
    ));

  if (!ka) {
    res.status(404).json({ error: "Kesim alanı bulunamadı." });
    return;
  }

  const groups = await db
    .select({
      id: animalGroupsTable.id,
      animalNo: animalGroupsTable.animalNo,
      colorTag: animalGroupsTable.colorTag,
      kesildi: animalGroupsTable.kesildi,
      kesildiAt: animalGroupsTable.kesildiAt,
      sortOrder: animalGroupsTable.sortOrder,
    })
    .from(animalGroupsTable)
    .where(and(
      eq(animalGroupsTable.kesimAlaniId, kesimId),
      isNull(animalGroupsTable.deletedAt),
    ))
    .orderBy(animalGroupsTable.sortOrder, animalGroupsTable.animalNo);

  const groupIds = groups.map(g => g.id);
  let assignedSharesByGroup: Record<string, number> = {};
  if (groupIds.length > 0) {
    const agd = await db.execute(sql`
      SELECT agd.group_id, COALESCE(SUM(d.share_count), 0)::int AS assigned_shares
      FROM animal_group_donations agd
      JOIN donations d ON d.id = agd.donation_id AND d.deleted_at IS NULL
      WHERE agd.group_id IN (${sql.join(groupIds.map(id => sql`${id}`), sql`, `)})
      GROUP BY agd.group_id
    `);
    type AgdRow = { group_id: string; assigned_shares: number };
    for (const row of agd.rows as AgdRow[]) {
      assignedSharesByGroup[row.group_id] = Number(row.assigned_shares);
    }
  }

  const items = groups.map(g => ({
    id: g.id,
    animalNo: g.animalNo,
    colorTag: g.colorTag,
    kesildi: g.kesildi,
    kesildiAt: g.kesildiAt ?? null,
    sortOrder: g.sortOrder,
    assignedShares: assignedSharesByGroup[g.id] ?? 0,
  }));

  res.json({ kesimAlaniId: ka.id, kesimAlaniName: ka.name, items });
}));

router.get("/projects/:id/kesim-listesi", asyncHandler(async (req, res) => {
  const projectId = req.params.id;

  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), isNull(projectsTable.deletedAt), isNull(projectsTable.archivedAt)));

  if (!project) {
    res.status(404).json({ error: "Proje bulunamadı." });
    return;
  }

  const kaRows = await db.execute(sql`
    SELECT
      ka.id,
      ka.name,
      ka.max_animal AS capacity
    FROM kesim_alanlari ka
    WHERE ka.project_id = ${projectId}
      AND ka.deleted_at IS NULL
      AND ka.name != '__havuz__'
    ORDER BY ka.name
  `);

  type KaRow = { id: string; name: string; capacity: number | null };
  const kesimAlanlari = kaRows.rows as KaRow[];

  if (kesimAlanlari.length === 0) {
    res.json([]);
    return;
  }

  const kaIds = kesimAlanlari.map(k => k.id);

  const groupRows = await db.execute(sql`
    SELECT
      ag.id,
      ag.kesim_alani_id,
      ag.animal_no,
      ag.color_tag,
      ag.kesildi,
      ag.kesildi_at,
      ag.sort_order,
      COALESCE(
        (SELECT SUM(d.share_count)
         FROM animal_group_donations agd
         JOIN donations d ON d.id = agd.donation_id AND d.deleted_at IS NULL
         WHERE agd.group_id = ag.id
        ), 0
      )::int AS assigned_shares
    FROM animal_groups ag
    WHERE ag.kesim_alani_id IN (${sql.join(kaIds.map(id => sql`${id}`), sql`, `)})
      AND ag.deleted_at IS NULL
    ORDER BY ag.kesim_alani_id, ag.sort_order, ag.animal_no
  `);

  type GroupRow = {
    id: string;
    kesim_alani_id: string;
    animal_no: number;
    color_tag: string | null;
    kesildi: boolean;
    kesildi_at: string | null;
    sort_order: number;
    assigned_shares: number;
  };

  const groupsByKa: Record<string, GroupRow[]> = {};
  for (const row of groupRows.rows as GroupRow[]) {
    if (!groupsByKa[row.kesim_alani_id]) groupsByKa[row.kesim_alani_id] = [];
    groupsByKa[row.kesim_alani_id].push(row);
  }

  const result = kesimAlanlari.map(ka => ({
    id: ka.id,
    name: ka.name,
    capacity: ka.capacity ?? null,
    groups: (groupsByKa[ka.id] || []).map(g => ({
      id: g.id,
      animalNo: g.animal_no,
      colorTag: g.color_tag,
      kesildi: g.kesildi,
      kesildiAt: g.kesildi_at ?? null,
      sortOrder: g.sort_order,
      assignedShares: Number(g.assigned_shares),
    })),
  }));

  res.json(result);
}));

router.get("/projects/:id/summary", asyncHandler(async (req, res) => {
  const projectId = req.params.id;

  const [project] = await db
    .select({ id: projectsTable.id, name: projectsTable.name })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), isNull(projectsTable.deletedAt), isNull(projectsTable.archivedAt)));

  if (!project) {
    res.status(404).json({ error: "Proje bulunamadı." });
    return;
  }

  const statsRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(d.share_count), 0)::int AS total_shares,
      COUNT(DISTINCT d.id)::int AS total_donations
    FROM kesim_alanlari ka
    JOIN donations d ON d.kesim_alani_id = ka.id AND d.deleted_at IS NULL AND d.excluded = false
    WHERE ka.project_id = ${projectId}
      AND ka.deleted_at IS NULL
  `);

  const groupStatsRows = await db.execute(sql`
    SELECT
      COUNT(ag.id)::int AS total_groups,
      COUNT(ag.id) FILTER (WHERE ag.kesildi = true)::int AS kesildi_groups,
      COALESCE(
        (SELECT SUM(d2.share_count)
         FROM animal_group_donations agd2
         JOIN donations d2 ON d2.id = agd2.donation_id AND d2.deleted_at IS NULL AND d2.excluded = false
         JOIN animal_groups ag2 ON ag2.id = agd2.group_id AND ag2.deleted_at IS NULL
         WHERE ag2.kesim_alani_id IN (
           SELECT id FROM kesim_alanlari WHERE project_id = ${projectId} AND deleted_at IS NULL
         )), 0
      )::int AS assigned_shares
    FROM animal_groups ag
    JOIN kesim_alanlari ka ON ka.id = ag.kesim_alani_id AND ka.deleted_at IS NULL
    WHERE ka.project_id = ${projectId}
      AND ag.deleted_at IS NULL
  `);

  type StatsRow = { total_shares: number; total_donations: number };
  type GroupRow = { total_groups: number; kesildi_groups: number; assigned_shares: number };

  const statsRow = statsRows.rows[0] as StatsRow;
  const groupRow = groupStatsRows.rows[0] as GroupRow;

  const totalShares = Number(statsRow?.total_shares ?? 0);
  const assignedShares = Number(groupRow?.assigned_shares ?? 0);
  const totalGroups = Number(groupRow?.total_groups ?? 0);
  const kesildiGroups = Number(groupRow?.kesildi_groups ?? 0);

  res.json({
    projectId: project.id,
    projectName: project.name,
    totalShares,
    assignedShares,
    unassignedShares: Math.max(totalShares - assignedShares, 0),
    totalGroups,
    kesildiGroups,
    remainingGroups: totalGroups - kesildiGroups,
  });
}));

export default router;
