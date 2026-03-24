import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  kesimAlanlariTable,
  donationsTable,
  animalGroupsTable,
} from "@workspace/db/schema";
import { eq, isNull, isNotNull, and, sql, inArray } from "drizzle-orm";

const router: IRouter = Router();

router.get("/projects", async (_req, res) => {
  try {
    const projects = await db
      .select()
      .from(projectsTable)
      .where(isNull(projectsTable.deletedAt))
      .orderBy(projectsTable.createdAt);

    const projectIds = projects.map((p) => p.id);

    const statsMap: Record<string, { donorCount: number; shareCount: number; groupCount: number }> = {};

    if (projectIds.length > 0) {
      const kesimRows = await db
        .select({
          projectId: kesimAlanlariTable.projectId,
          kesimId: kesimAlanlariTable.id,
        })
        .from(kesimAlanlariTable)
        .where(
          and(
            isNull(kesimAlanlariTable.deletedAt),
            isNotNull(kesimAlanlariTable.projectId)
          )
        );

      const projectKesimIds: Record<string, string[]> = {};
      for (const row of kesimRows) {
        if (row.projectId) {
          if (!projectKesimIds[row.projectId]) projectKesimIds[row.projectId] = [];
          projectKesimIds[row.projectId].push(row.kesimId);
        }
      }

      for (const pid of projectIds) {
        const kesimIds = projectKesimIds[pid] || [];
        if (kesimIds.length === 0) {
          statsMap[pid] = { donorCount: 0, shareCount: 0, groupCount: 0, kesildiCount: 0, lastKesildiAt: null };
          continue;
        }

        const kesimIdList = sql`ARRAY[${sql.join(kesimIds.map(id => sql`${id}`), sql`, `)}]`;
        const [donorStats, groupStats, kesildiStats] = await Promise.all([
          db
            .select({
              count: sql<number>`count(*)::int`,
              shares: sql<number>`coalesce(sum(${donationsTable.shareCount}), 0)::int`,
            })
            .from(donationsTable)
            .where(
              and(
                sql`${donationsTable.kesimAlaniId} = ANY(${kesimIdList})`,
                isNull(donationsTable.deletedAt),
                eq(donationsTable.excluded, false)
              )
            ),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(animalGroupsTable)
            .where(sql`${animalGroupsTable.kesimAlaniId} = ANY(${kesimIdList})`),
          db
            .select({
              kesildiCount: sql<number>`count(*) filter (where ${animalGroupsTable.kesildi} = true)::int`,
              lastKesildiAt: sql<string | null>`max(${animalGroupsTable.kesildiAt})`,
            })
            .from(animalGroupsTable)
            .where(sql`${animalGroupsTable.kesimAlaniId} = ANY(${kesimIdList})`),
        ]);

        statsMap[pid] = {
          donorCount: donorStats[0]?.count ?? 0,
          shareCount: donorStats[0]?.shares ?? 0,
          groupCount: groupStats[0]?.count ?? 0,
          kesildiCount: kesildiStats[0]?.kesildiCount ?? 0,
          lastKesildiAt: kesildiStats[0]?.lastKesildiAt ?? null,
        };
      }
    }

    const result = projects.map((p) => ({
      ...p,
      stats: statsMap[p.id] || { donorCount: 0, shareCount: 0, groupCount: 0, kesildiCount: 0, lastKesildiAt: null },
    }));

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
    const now = new Date().toISOString();
    await db.insert(projectsTable).values({
      id,
      name: name.trim(),
      createdAt: now,
    });
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    res.status(201).json({ ...project, stats: { donorCount: 0, shareCount: 0, groupCount: 0, kesildiCount: 0, lastKesildiAt: null } });
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
    const [updated] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    res.json({ ...updated, stats: { donorCount: 0, shareCount: 0, groupCount: 0, kesildiCount: 0, lastKesildiAt: null } });
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

    await db.update(projectsTable).set({ deletedAt: new Date().toISOString() }).where(eq(projectsTable.id, id));
    await db.update(kesimAlanlariTable).set({ projectId: null }).where(eq(kesimAlanlariTable.projectId, id));
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
    const [restored] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    res.json({ ...restored, stats: { donorCount: 0, shareCount: 0, groupCount: 0, kesildiCount: 0, lastKesildiAt: null } });
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
