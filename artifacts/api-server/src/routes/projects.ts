import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  kesimAlanlariTable,
  animalGroupsTable,
  donationsTable,
  animalGroupDonationsTable,
  animalGroupPhotosTable,
  trackingNotesTable,
  notificationLogsTable,
  teamsTable,
} from "@workspace/db/schema";
import { eq, isNull, isNotNull, and, sql, inArray } from "drizzle-orm";
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from "../lib/cache";

const PROJECTS_CACHE_KEY = "projects:list";
const PROJECTS_TTL = 30_000;

const router: IRouter = Router();

const emptyStats = { donorCount: 0, shareCount: 0, groupCount: 0, kesildiCount: 0, lastKesildiAt: null };

let refreshInProgress = false;
let refreshQueued = false;

export async function refreshProjectStats() {
  if (refreshInProgress) {
    refreshQueued = true;
    return;
  }
  refreshInProgress = true;
  try {
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY project_stats_view`);
    cacheInvalidate(PROJECTS_CACHE_KEY);
  } catch (err) {
    console.error("Failed to refresh project_stats_view:", err);
  } finally {
    refreshInProgress = false;
    if (refreshQueued) {
      refreshQueued = false;
      refreshProjectStats();
    }
  }
}

router.get("/projects", async (_req, res) => {
  try {
    const cached = cacheGet<unknown[]>(PROJECTS_CACHE_KEY);
    if (cached) {
      res.json(cached);
      return;
    }

    const rows = await db.execute(sql`
      SELECT
        p.*,
        COALESCE(s.donor_count, 0) AS donor_count,
        COALESCE(s.share_count, 0) AS share_count,
        COALESCE(s.group_count, 0) AS group_count,
        COALESCE(s.kesildi_count, 0) AS kesildi_count,
        s.last_kesildi_at
      FROM projects p
      LEFT JOIN project_stats_view s ON s.project_id = p.id
      WHERE p.deleted_at IS NULL AND p.archived_at IS NULL
      ORDER BY p.created_at
    `);

    type ProjectRow = {
      id: string; name: string; description: string;
      created_at: string; deleted_at: string | null;
      archived_at: string | null;
      donor_count: number; share_count: number;
      group_count: number; kesildi_count: number;
      last_kesildi_at: string | null;
    };

    const result = (rows.rows as ProjectRow[]).map(r => ({
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
    }));

    cacheSet(PROJECTS_CACHE_KEY, result, PROJECTS_TTL);
    res.json(result);
  } catch (err) {
    console.error("GET /projects error:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const now = new Date();
    await db.insert(projectsTable).values({
      id,
      name: name.trim(),
      createdAt: now,
    });
    await refreshProjectStats();
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    res.status(201).json({ ...project, stats: emptyStats });
  } catch (err) {
    console.error("POST /projects error:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.put("/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Project not found" });

    await db.update(projectsTable).set({ name: name.trim() }).where(eq(projectsTable.id, id));
    cacheInvalidate(PROJECTS_CACHE_KEY);
    const [updated] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    res.json({ ...updated, stats: emptyStats });
  } catch (err) {
    console.error("PUT /projects/:id error:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Project not found" });

    await db.update(projectsTable).set({ deletedAt: new Date() }).where(eq(projectsTable.id, id));
    await db.update(kesimAlanlariTable).set({ projectId: null }).where(eq(kesimAlanlariTable.projectId, id));
    await refreshProjectStats();
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /projects/:id error:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

router.post("/projects/:id/restore", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Project not found" });

    await db.update(projectsTable).set({ deletedAt: null }).where(eq(projectsTable.id, id));
    await refreshProjectStats();
    const [restored] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    res.json({ ...restored, stats: emptyStats });
  } catch (err) {
    console.error("POST /projects/:id/restore error:", err);
    res.status(500).json({ error: "Failed to restore project" });
  }
});

router.get("/projects/deleted", async (_req, res) => {
  try {
    const deleted = await db
      .select()
      .from(projectsTable)
      .where(isNotNull(projectsTable.deletedAt));
    res.json(deleted);
  } catch (err) {
    console.error("GET /projects/deleted error:", err);
    res.status(500).json({ error: "Failed to fetch deleted projects" });
  }
});

router.get("/projects/archived", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        p.*,
        COALESCE(s.donor_count, 0) AS donor_count,
        COALESCE(s.share_count, 0) AS share_count,
        COALESCE(s.group_count, 0) AS group_count,
        COALESCE(s.kesildi_count, 0) AS kesildi_count,
        s.last_kesildi_at
      FROM projects p
      LEFT JOIN project_stats_view s ON s.project_id = p.id
      WHERE p.archived_at IS NOT NULL AND p.deleted_at IS NULL
      ORDER BY p.archived_at DESC
    `);

    type ProjectRow = {
      id: string; name: string; description: string;
      created_at: string; deleted_at: string | null;
      archived_at: string | null;
      donor_count: number; share_count: number;
      group_count: number; kesildi_count: number;
      last_kesildi_at: string | null;
    };

    const result = (rows.rows as ProjectRow[]).map(r => ({
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
    }));

    res.json(result);
  } catch (err) {
    console.error("GET /projects/archived error:", err);
    res.status(500).json({ error: "Failed to fetch archived projects" });
  }
});

router.post("/projects/:id/archive", async (req, res) => {
  try {
    const { id } = req.params;
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) return res.status(404).json({ error: "Proje bulunamadı" });
    if (project.deletedAt) return res.status(400).json({ error: "Silinmiş proje arşivlenemez" });
    if (project.archivedAt) return res.status(400).json({ error: "Proje zaten arşivlenmiş" });

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

    await refreshProjectStats();
    cacheInvalidatePrefix("kesim-alanlari");

    res.json({ success: true, archivedAt: now });
  } catch (err) {
    console.error("POST /projects/:id/archive error:", err);
    res.status(500).json({ error: "Arşivleme başarısız" });
  }
});

router.post("/projects/:id/unarchive", async (req, res) => {
  try {
    const { id } = req.params;
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) return res.status(404).json({ error: "Proje bulunamadı" });
    if (!project.archivedAt) return res.status(400).json({ error: "Proje arşivde değil" });

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

    await refreshProjectStats();
    cacheInvalidatePrefix("kesim-alanlari");

    const [restored] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    res.json({ ...restored, archivedAt: null, stats: emptyStats });
  } catch (err) {
    console.error("POST /projects/:id/unarchive error:", err);
    res.status(500).json({ error: "Arşivden geri yükleme başarısız" });
  }
});

router.get("/projects/:id/dashboard", async (req, res) => {
  try {
    const { id } = req.params;
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) return res.status(404).json({ error: "Project not found" });

    const kesimRows = await db.select({
      id: kesimAlanlariTable.id,
      name: kesimAlanlariTable.name,
    }).from(kesimAlanlariTable).where(
      and(
        eq(kesimAlanlariTable.projectId, id),
        isNull(kesimAlanlariTable.deletedAt)
      )
    );

    const kesimIds = kesimRows.map(k => k.id);
    if (kesimIds.length === 0) {
      res.json({
        projectId: id,
        projectName: project.name,
        totalAnimals: 0,
        kesildiCount: 0,
        remainingCount: 0,
        kesildiPercent: 0,
        lastKesildiAt: null,
        kesimAlanlari: [],
      });
      return;
    }

    const groups = await db.select({
      id: animalGroupsTable.id,
      kesimAlaniId: animalGroupsTable.kesimAlaniId,
      kesildi: animalGroupsTable.kesildi,
      kesildiAt: animalGroupsTable.kesildiAt,
    }).from(animalGroupsTable).where(
      inArray(animalGroupsTable.kesimAlaniId, kesimIds)
    );

    const totalAnimals = groups.length;
    const kesildiCount = groups.filter(g => g.kesildi).length;
    const allTimes = groups.filter(g => g.kesildiAt).map(g => g.kesildiAt!).sort();
    const lastKesildiAt = allTimes.length > 0 ? allTimes[allTimes.length - 1] : null;

    const perArea = kesimRows.map(k => {
      const areaGroups = groups.filter(g => g.kesimAlaniId === k.id);
      const areaKesildi = areaGroups.filter(g => g.kesildi).length;
      const areaTimes = areaGroups.filter(g => g.kesildiAt).map(g => g.kesildiAt!).sort();
      return {
        id: k.id,
        name: k.name,
        totalAnimals: areaGroups.length,
        kesildiCount: areaKesildi,
        kesildiPercent: areaGroups.length > 0 ? Math.round((areaKesildi / areaGroups.length) * 100) : 0,
        lastKesildiAt: areaTimes.length > 0 ? areaTimes[areaTimes.length - 1] : null,
      };
    });

    res.json({
      projectId: id,
      projectName: project.name,
      totalAnimals,
      kesildiCount,
      remainingCount: totalAnimals - kesildiCount,
      kesildiPercent: totalAnimals > 0 ? Math.round((kesildiCount / totalAnimals) * 100) : 0,
      lastKesildiAt,
      kesimAlanlari: perArea,
    });
  } catch (err) {
    console.error("GET /projects/:id/dashboard error:", err);
    res.status(500).json({ error: "Failed to fetch project dashboard" });
  }
});

export default router;
