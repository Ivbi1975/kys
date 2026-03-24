import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  animalGroupsTable,
  animalGroupDonationsTable,
  donationTagsTable,
  projectsTable,
} from "@workspace/db/schema";
import { eq, inArray, isNull, isNotNull, and } from "drizzle-orm";
import { z } from "zod";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface DonationPayload {
  id: string;
  name?: string;
  description?: string;
  donationType?: string;
  shareCount?: number;
  vekalet?: string;
  notes?: string;
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
  donations: z.array(donationPayloadSchema).optional().default([]),
  animalGroups: z.array(animalGroupPayloadSchema).optional().default([]),
});

const updateKesimAlaniSchema = z.object({
  name: z.string().min(1).optional(),
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

async function getFullKesimAlani(id: string) {
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.id, id));
  if (!ka) return null;

  const [donations, groups] = await Promise.all([
    db.select().from(donationsTable)
      .where(and(eq(donationsTable.kesimAlaniId, id), isNull(donationsTable.deletedAt)))
      .orderBy(donationsTable.sortOrder),
    db.select().from(animalGroupsTable)
      .where(eq(animalGroupsTable.kesimAlaniId, id))
      .orderBy(animalGroupsTable.sortOrder),
  ]);

  const donationIds = donations.map(d => d.id);
  const groupIds = groups.map(g => g.id);

  const [donationTags, groupDonationLinks] = await Promise.all([
    donationIds.length > 0
      ? db.select({
          donationId: donationTagsTable.donationId,
          tagId: donationTagsTable.tagId,
        }).from(donationTagsTable).where(inArray(donationTagsTable.donationId, donationIds))
      : Promise.resolve([] as { donationId: string; tagId: string }[]),
    groupIds.length > 0
      ? db.select({
          groupId: animalGroupDonationsTable.groupId,
          donationId: animalGroupDonationsTable.donationId,
          sortOrder: animalGroupDonationsTable.sortOrder,
        }).from(animalGroupDonationsTable).where(inArray(animalGroupDonationsTable.groupId, groupIds))
      : Promise.resolve([] as { groupId: string; donationId: string; sortOrder: number }[]),
  ]);

  const tagsByDonation: Record<string, string[]> = {};
  for (const dt of donationTags) {
    if (!tagsByDonation[dt.donationId]) tagsByDonation[dt.donationId] = [];
    tagsByDonation[dt.donationId].push(dt.tagId);
  }

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
      donations: links.map(l => donationsById[l.donationId]).filter(Boolean),
    };
  });

  return {
    id: ka.id,
    name: ka.name,
    createdAt: ka.createdAt,
    deletedAt: ka.deletedAt || null,
    projectId: ka.projectId || null,
    donations: mappedDonations,
    animalGroups: mappedGroups,
  };
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

    const results = await Promise.all(rows.map(r => getFullKesimAlani(r.id)));
    res.json(results.filter(Boolean));
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

    const results = await Promise.all(rows.map(r => getFullKesimAlani(r.id)));
    res.json(results.filter(Boolean));
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

  const { id, name, createdAt, donations, animalGroups } = parsed.data;
  const projectId = req.body.projectId || null;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(kesimAlanlariTable).values({
        id,
        name,
        createdAt: createdAt || new Date().toISOString(),
        projectId,
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
  const { name, donations, animalGroups } = parsed.data;

  try {
    const kaCheck = await requireActiveKesimAlani(id);
    if (kaCheck.error) {
      res.status(kaCheck.status).json({ error: kaCheck.error });
      return;
    }

    await db.transaction(async (tx) => {
      if (name !== undefined) {
        await tx.update(kesimAlanlariTable).set({ name }).where(eq(kesimAlanlariTable.id, id));
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
        await saveAnimalGroups(tx, id, animalGroups);
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
        await saveAnimalGroups(tx, id, animalGroups);
      }
    });

    const result = await getFullKesimAlani(id);
    res.json(result);
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
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(kesimAlanlariTable.id, id));
    }

    res.json({ success: true });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`POST /kesim-alanlari/${req.params.id}/restore error:`, message);
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
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(donationsTable.id, donationId));
    }
    res.json({ success: true });
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

    await db.transaction(async (tx) => {
      await tx.delete(animalGroupDonationsTable).where(
        inArray(animalGroupDonationsTable.groupId,
          tx.select({ id: animalGroupsTable.id }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId))
        )
      );
      await tx.delete(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId));
      await saveAnimalGroups(tx, kesimAlaniId, animalGroups);
    });

    const result = await getFullKesimAlani(kesimAlaniId);
    res.json(result);
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

    const dbUpdates: Record<string, string | number | boolean> = {};
    if (updates.animalNo !== undefined) dbUpdates.animalNo = updates.animalNo;
    if (updates.colorTag !== undefined) dbUpdates.colorTag = updates.colorTag;
    if (updates.locked !== undefined) dbUpdates.locked = updates.locked;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

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

    const result = await getFullKesimAlani(kesimAlaniId);
    res.json(result);
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

async function saveAnimalGroups(tx: Tx, kesimAlaniId: string, groups: AnimalGroupPayload[]) {
  if (groups.length === 0) return;

  const groupRows = groups.map((g, i) => ({
    id: g.id,
    kesimAlaniId,
    animalNo: g.animalNo || 0,
    colorTag: g.colorTag || "",
    locked: g.locked || false,
    notes: g.notes || "",
    sortOrder: i,
  }));

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

export default router;
