import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { refreshProjectStats } from "./projects";
import {
  kesimAlanlariTable,
  donationsTable,
  animalGroupsTable,
  animalGroupDonationsTable,
  customTagsTable,
  donationTagsTable,
  appSettingsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../middleware/error-handler";
import { logger } from "../lib/logger";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

const router: IRouter = Router();

interface DonationExport {
  id: string;
  name: string;
  description: string;
  donationType: string;
  shareCount: number;
  vekalet: string;
  notes: string;
  excluded: boolean;
  tags: string[];
  aiCategories?: string[];
  aiWarnings?: string;
}

const backupImportSchema = z.object({
  kesimAlanlari: z.array(z.object({
    id: z.string().optional(),
    name: z.string().optional().default("İsimsiz"),
    createdAt: z.string().optional(),
    donations: z.array(z.object({
      id: z.string().optional(),
      name: z.string().optional().default(""),
      description: z.string().optional().default(""),
      donationType: z.string().optional().default(""),
      shareCount: z.number().optional().default(1),
      vekalet: z.string().optional().default(""),
      notes: z.string().optional().default(""),
      excluded: z.boolean().optional().default(false),
      tags: z.array(z.string()).optional().default([]),
      aiCategories: z.array(z.string()).optional(),
      aiWarnings: z.string().optional(),
    })).optional().default([]),
    animalGroups: z.array(z.object({
      id: z.string().optional(),
      animalNo: z.number().optional().default(0),
      colorTag: z.string().optional().default(""),
      locked: z.boolean().optional().default(false),
      notes: z.string().optional().default(""),
      donations: z.array(z.object({
        id: z.string(),
      })).optional().default([]),
    })).optional().default([]),
    customTags: z.array(z.object({
      id: z.string(),
      name: z.string(),
      color: z.string().optional().default("#3b82f6"),
    })).optional().default([]),
  })),
  logo: z.string().nullable().optional(),
  globalTags: z.array(z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().optional().default("#3b82f6"),
  })).optional().default([]),
});

router.post("/backup/export", asyncHandler(async (_req, res) => {
  const kesimAlanlari = await db.select().from(kesimAlanlariTable).orderBy(kesimAlanlariTable.createdAt);
  const allDonations = await db.select().from(donationsTable).orderBy(donationsTable.sortOrder);
  const allGroups = await db.select().from(animalGroupsTable).orderBy(animalGroupsTable.sortOrder);
  const allGroupDonations = await db.select().from(animalGroupDonationsTable).orderBy(animalGroupDonationsTable.sortOrder);
  const allDonationTags = await db.select().from(donationTagsTable);
  const tags = await db.select().from(customTagsTable);
  const [logoSetting] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "logo"));

  const tagsByDonation: Record<string, string[]> = {};
  for (const dt of allDonationTags) {
    if (!tagsByDonation[dt.donationId]) tagsByDonation[dt.donationId] = [];
    tagsByDonation[dt.donationId].push(dt.tagId);
  }

  const donationsById: Record<string, DonationExport> = {};
  for (const d of allDonations) {
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
      aiCategories: d.aiCategories ? JSON.parse(d.aiCategories) : undefined,
      aiWarnings: d.aiWarnings || undefined,
    };
  }

  const donationsByKa: Record<string, DonationExport[]> = {};
  for (const d of allDonations) {
    if (!donationsByKa[d.kesimAlaniId]) donationsByKa[d.kesimAlaniId] = [];
    donationsByKa[d.kesimAlaniId].push(donationsById[d.id]);
  }

  const groupLinksByGroup: Record<string, { donationId: string; sortOrder: number }[]> = {};
  for (const link of allGroupDonations) {
    if (!groupLinksByGroup[link.groupId]) groupLinksByGroup[link.groupId] = [];
    groupLinksByGroup[link.groupId].push(link);
  }

  interface GroupExport {
    id: string;
    animalNo: number;
    colorTag: string;
    locked: boolean;
    notes: string;
    donations: DonationExport[];
  }

  const groupsByKa: Record<string, GroupExport[]> = {};
  for (const g of allGroups) {
    if (!groupsByKa[g.kesimAlaniId]) groupsByKa[g.kesimAlaniId] = [];
    const links = (groupLinksByGroup[g.id] || []).sort((a, b) => a.sortOrder - b.sortOrder);
    groupsByKa[g.kesimAlaniId].push({
      id: g.id,
      animalNo: g.animalNo,
      colorTag: g.colorTag,
      locked: g.locked,
      notes: g.notes,
      donations: links.map(l => donationsById[l.donationId]).filter(Boolean),
    });
  }

  const data = {
    version: 1,
    timestamp: new Date().toISOString(),
    kesimAlanlari: kesimAlanlari.map(ka => ({
      id: ka.id,
      name: ka.name,
      createdAt: ka.createdAt,
      donations: donationsByKa[ka.id] || [],
      animalGroups: groupsByKa[ka.id] || [],
      customTags: tags,
    })),
    logo: logoSetting?.value || null,
    globalTags: tags,
  };

  res.json(data);
}));

const importPayloadSchema = z.object({
  mode: z.enum(["replace", "merge"]).optional().default("replace"),
  data: backupImportSchema,
});

router.post("/backup/import", asyncHandler(async (req, res) => {
  let mode: "replace" | "merge" = "replace";
  let data: z.infer<typeof backupImportSchema>;

  const wrappedParse = importPayloadSchema.safeParse(req.body);
  if (wrappedParse.success) {
    mode = wrappedParse.data.mode;
    data = wrappedParse.data.data;
  } else {
    const directParse = backupImportSchema.safeParse(req.body);
    if (!directParse.success) {
      res.status(400).json({ error: "Geçersiz yedek dosyası", details: directParse.error.issues });
      return;
    }
    data = directParse.data;
  }

  const importLog = { tags: 0, tagsSkipped: 0, kesimAlanlari: 0, kesimAlanlariSkipped: 0, donations: 0, donationsSkipped: 0, groups: 0, groupsSkipped: 0 };

  await db.transaction(async (tx) => {
    if (mode === "replace") {
      await tx.delete(animalGroupDonationsTable);
      await tx.delete(donationTagsTable);
      await tx.delete(animalGroupsTable);
      await tx.delete(donationsTable);
      await tx.delete(kesimAlanlariTable);
      await tx.delete(customTagsTable);
    }

    if (data.globalTags && data.globalTags.length > 0) {
      for (const tag of data.globalTags) {
        const sanitizedName = stripHtml(tag.name);
        if (mode === "merge") {
          const existing = await tx.select({ id: customTagsTable.id }).from(customTagsTable).where(eq(customTagsTable.id, tag.id));
          if (existing.length > 0) {
            importLog.tagsSkipped++;
            continue;
          }
        }
        await tx.insert(customTagsTable).values({
          id: tag.id, name: sanitizedName, color: tag.color || "#3b82f6",
        });
        importLog.tags++;
      }
    }

    for (const ka of data.kesimAlanlari) {
      const kaId = ka.id || Math.random().toString(36).substring(2, 12);
      const kaValues = {
        id: kaId,
        name: stripHtml(ka.name || "İsimsiz"),
        createdAt: ka.createdAt ? new Date(ka.createdAt) : new Date(),
      };
      if (mode === "merge") {
        const existing = await tx.select({ id: kesimAlanlariTable.id }).from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, kaId));
        if (existing.length > 0) {
          importLog.kesimAlanlariSkipped++;
          continue;
        }
        await tx.insert(kesimAlanlariTable).values(kaValues);
        importLog.kesimAlanlari++;
      } else {
        await tx.insert(kesimAlanlariTable).values(kaValues);
        importLog.kesimAlanlari++;
      }

      if (ka.donations && ka.donations.length > 0) {
        for (let i = 0; i < ka.donations.length; i++) {
          const d = ka.donations[i];
          const donationId = d.id || Math.random().toString(36).substring(2, 12);
          const dValues: typeof donationsTable.$inferInsert = {
            id: donationId,
            kesimAlaniId: kaId,
            name: stripHtml(d.name || ""),
            description: stripHtml(d.description || ""),
            donationType: stripHtml(d.donationType || ""),
            shareCount: d.shareCount || 1,
            vekalet: stripHtml(d.vekalet || ""),
            notes: stripHtml(d.notes || ""),
            excluded: d.excluded || false,
            sortOrder: i,
          };
          if (d.aiCategories && d.aiCategories.length > 0) {
            dValues.aiCategories = JSON.stringify(d.aiCategories.map(stripHtml));
          }
          if (d.aiWarnings) {
            dValues.aiWarnings = stripHtml(d.aiWarnings);
          }
          if (mode === "merge") {
            const existing = await tx.select({ id: donationsTable.id, kesimAlaniId: donationsTable.kesimAlaniId }).from(donationsTable).where(eq(donationsTable.id, donationId));
            if (existing.length > 0) {
              if (existing[0].kesimAlaniId !== kaId) {
                logger.warn({ donationId, existingKaId: existing[0].kesimAlaniId, importKaId: kaId }, "Import donation ID collision: belongs to different kesim alanı");
              }
              importLog.donationsSkipped++;
              continue;
            }
            await tx.insert(donationsTable).values(dValues);
          } else {
            await tx.insert(donationsTable).values(dValues);
          }
          importLog.donations++;

          if (d.tags && d.tags.length > 0) {
            let existingTagIds: Set<string> | undefined;
            if (mode === "merge") {
              const existing = await tx.select().from(donationTagsTable)
                .where(eq(donationTagsTable.donationId, donationId));
              existingTagIds = new Set(existing.map(e => e.tagId));
            }
            for (const tagId of d.tags) {
              if (existingTagIds?.has(tagId)) continue;
              await tx.insert(donationTagsTable).values({ donationId, tagId })
                .onConflictDoNothing();
            }
          }
        }
      }

      if (ka.animalGroups && ka.animalGroups.length > 0) {
        for (let i = 0; i < ka.animalGroups.length; i++) {
          const g = ka.animalGroups[i];
          const groupId = g.id || Math.random().toString(36).substring(2, 12);
          const gValues = {
            id: groupId,
            kesimAlaniId: kaId,
            animalNo: g.animalNo || 0,
            colorTag: stripHtml(g.colorTag || ""),
            locked: g.locked || false,
            notes: stripHtml(g.notes || ""),
            sortOrder: i,
          };
          if (mode === "merge") {
            const existing = await tx.select({ id: animalGroupsTable.id, kesimAlaniId: animalGroupsTable.kesimAlaniId }).from(animalGroupsTable).where(eq(animalGroupsTable.id, groupId));
            if (existing.length > 0) {
              if (existing[0].kesimAlaniId !== kaId) {
                logger.warn({ groupId, existingKaId: existing[0].kesimAlaniId, importKaId: kaId }, "Import group ID collision: belongs to different kesim alanı");
              }
              importLog.groupsSkipped++;
              continue;
            }
            await tx.insert(animalGroupsTable).values(gValues);
            importLog.groups++;
          } else {
            await tx.insert(animalGroupsTable).values(gValues);
            importLog.groups++;
          }
          if (g.donations && g.donations.length > 0) {
            let existingDonationIds: Set<string> | undefined;
            if (mode === "merge") {
              const existing = await tx.select().from(animalGroupDonationsTable)
                .where(eq(animalGroupDonationsTable.groupId, groupId));
              existingDonationIds = new Set(existing.map(e => e.donationId));
            }
            for (let j = 0; j < g.donations.length; j++) {
              if (existingDonationIds?.has(g.donations[j].id)) continue;
              await tx.insert(animalGroupDonationsTable).values({
                groupId,
                donationId: g.donations[j].id,
                sortOrder: j,
              }).onConflictDoNothing();
            }
          }
        }
      }
    }

    if (data.logo) {
      await tx.insert(appSettingsTable).values({ key: "logo", value: data.logo })
        .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: data.logo } });
    } else if (mode === "replace") {
      await tx.delete(appSettingsTable).where(eq(appSettingsTable.key, "logo"));
    }
  });

  logger.info({ mode, importLog }, "Backup import completed");
  res.json({ success: true, count: data.kesimAlanlari.length, mode, importLog });
  refreshProjectStats();
}));

export default router;
