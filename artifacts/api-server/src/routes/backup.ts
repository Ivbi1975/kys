import { Router, type IRouter } from "express";
import crypto from "node:crypto";
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
import { auditLog } from "../services/audit-log.service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
function sanitizeColor(input: string, fallback = "#3b82f6"): string {
  const trimmed = input.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : fallback;
}

const SAFE_DATA_URI_RE = /^data:image\/(png|jpeg|jpg|gif|svg\+xml|webp|bmp|ico);base64,[A-Za-z0-9+/\n\r=]+$/;
function sanitizeLogo(input: string): string | null {
  if (SAFE_DATA_URI_RE.test(input.trim())) return input.trim();
  logger.warn("Import logo rejected: not a valid data:image URI");
  return null;
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
  const allAiTagRows = await db.select({ id: customTagsTable.id, name: customTagsTable.name })
    .from(customTagsTable).where(eq(customTagsTable.categoryId, "__ai_category__"));
  const aiTagNameMap = new Map(allAiTagRows.map(t => [t.id, t.name]));

  for (const d of allDonations) {
    const donTags = tagsByDonation[d.id] || [];
    const aiCategories = donTags.filter(id => aiTagNameMap.has(id)).map(id => aiTagNameMap.get(id) as string);
    donationsById[d.id] = {
      id: d.id,
      name: d.name,
      description: d.description,
      donationType: d.donationType,
      shareCount: d.shareCount,
      vekalet: d.vekalet,
      notes: d.notes,
      excluded: d.excluded,
      tags: donTags,
      aiCategories: aiCategories.length > 0 ? aiCategories : undefined,
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
  auditLog({ action: "export", entityType: "backup", entityName: "Yedek dışa aktarma", newValue: { kesimAlanlariCount: kesimAlanlari.length }, req: _req });
}));

const importPayloadSchema = z.object({
  mode: z.enum(["replace", "merge"]).optional().default("replace"),
  dryRun: z.boolean().optional().default(false),
  confirmReplace: z.boolean().optional().default(false),
  data: backupImportSchema,
});

const SHARE_COUNT_MIN = 1;
const SHARE_COUNT_MAX = 7;

router.post("/backup/import", asyncHandler(async (req, res) => {
  let mode: "replace" | "merge" = "replace";
  let dryRun = false;
  let confirmReplace = false;
  let data: z.infer<typeof backupImportSchema>;

  const wrappedParse = importPayloadSchema.safeParse(req.body);
  if (wrappedParse.success) {
    mode = wrappedParse.data.mode;
    dryRun = wrappedParse.data.dryRun;
    confirmReplace = wrappedParse.data.confirmReplace;
    data = wrappedParse.data.data;
  } else {
    const directParse = backupImportSchema.safeParse(req.body);
    if (!directParse.success) {
      res.status(400).json({ error: "Geçersiz yedek dosyası", details: directParse.error.issues });
      return;
    }
    data = directParse.data;
  }

  // Validate share counts up-front to surface bad data clearly
  const validationIssues: string[] = [];
  const seenDonationIds = new Set<string>();
  const seenGroupIds = new Set<string>();
  const referencedDonationIds = new Set<string>();
  for (const ka of data.kesimAlanlari) {
    for (const d of ka.donations || []) {
      if (d.shareCount != null && (d.shareCount < SHARE_COUNT_MIN || d.shareCount > SHARE_COUNT_MAX)) {
        validationIssues.push(`Bağış ${d.id || d.name}: shareCount ${d.shareCount} aralık dışı (1-7)`);
      }
      if (d.id) {
        if (seenDonationIds.has(d.id)) {
          validationIssues.push(`Yinelenen bağış ID: ${d.id}`);
        }
        seenDonationIds.add(d.id);
      }
    }
    for (const g of ka.animalGroups || []) {
      if (g.id) {
        if (seenGroupIds.has(g.id)) {
          validationIssues.push(`Yinelenen grup ID: ${g.id}`);
        }
        seenGroupIds.add(g.id);
      }
      for (const link of g.donations || []) {
        if (link.id) referencedDonationIds.add(link.id);
      }
    }
  }
  for (const refId of referencedDonationIds) {
    if (!seenDonationIds.has(refId)) {
      validationIssues.push(`Grup içinde tanımlanmayan bağış ID referansı: ${refId}`);
    }
  }
  if (validationIssues.length > 0) {
    res.status(400).json({ error: "Yedek doğrulama başarısız", issues: validationIssues.slice(0, 50) });
    return;
  }

  if (mode === "replace" && !dryRun && !confirmReplace) {
    res.status(409).json({
      error: "Yedek geri yükleme onayı gerekli",
      detail: "Replace modu mevcut tüm verileri siler. Onaylamak için confirmReplace=true gönderin veya dryRun=true ile önizleme alın.",
      hint: { confirmReplace: true, dryRun: true },
    });
    return;
  }

  const importLog = { tags: 0, tagsSkipped: 0, kesimAlanlari: 0, kesimAlanlariSkipped: 0, donations: 0, donationsSkipped: 0, groups: 0, groupsSkipped: 0 };

  if (dryRun) {
    const summary = {
      mode,
      dryRun: true,
      wouldDelete: mode === "replace",
      counts: {
        kesimAlanlari: data.kesimAlanlari.length,
        donations: data.kesimAlanlari.reduce((s, k) => s + (k.donations?.length || 0), 0),
        animalGroups: data.kesimAlanlari.reduce((s, k) => s + (k.animalGroups?.length || 0), 0),
        globalTags: data.globalTags?.length || 0,
        hasLogo: !!data.logo,
      },
    };
    res.json({ success: true, dryRun: true, summary });
    return;
  }

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
          id: tag.id, name: sanitizedName, color: sanitizeColor(tag.color || "#3b82f6"),
        });
        importLog.tags++;
      }
    }

    for (const ka of data.kesimAlanlari) {
      const kaId = ka.id || crypto.randomUUID();
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
          const donationId = d.id || crypto.randomUUID();
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
          const groupId = g.id || crypto.randomUUID();
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

    const sanitizedLogo = data.logo ? sanitizeLogo(data.logo) : null;
    if (sanitizedLogo) {
      await tx.insert(appSettingsTable).values({ key: "logo", value: sanitizedLogo })
        .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: sanitizedLogo } });
    } else if (mode === "replace") {
      await tx.delete(appSettingsTable).where(eq(appSettingsTable.key, "logo"));
    }
  });

  logger.info({ mode, importLog }, "Backup import completed");
  res.json({ success: true, count: data.kesimAlanlari.length, mode, importLog });
  refreshProjectStats();
  auditLog({ action: "import", entityType: "backup", entityName: "Yedek içe aktarma", newValue: { mode, importLog }, req });
}));

export default router;
