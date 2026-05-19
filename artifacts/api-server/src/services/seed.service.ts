import { db } from "@workspace/db";
import { customTagsTable, automationRulesTable, projectsTable, donationTagsTable } from "@workspace/db/schema";
import { eq, inArray, isNull, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

export const SEED_TAG_IDS = {
  UGANDA: "seed-tag-uganda",
  SOMALI: "seed-tag-somali",
  CAD: "seed-tag-cad",
  AFGANISTAN: "seed-tag-afganistan",
  HINDISTAN: "seed-tag-hindistan",
  AYNI_HAYVAN: "seed-tag-ayni-hayvan",
  KOC: "seed-tag-koc",
  KOYUN: "seed-tag-koyun",
  GUN1: "seed-tag-1gun",
  GUN2: "seed-tag-2gun",
  GUN3: "seed-tag-3gun",
  DIKKAT: "seed-tag-dikkat",
  MEVTA_KURBANI: "seed-tag-mevta-kurbani",
};

const SEED_TAGS = [
  { id: SEED_TAG_IDS.UGANDA, name: "Uganda", color: "#D90000" },
  { id: SEED_TAG_IDS.SOMALI, name: "Somali", color: "#4189DD" },
  { id: SEED_TAG_IDS.CAD, name: "Çad", color: "#003082" },
  { id: SEED_TAG_IDS.AFGANISTAN, name: "Afganistan", color: "#007A36" },
  { id: SEED_TAG_IDS.HINDISTAN, name: "Hindistan", color: "#FF9933" },
  { id: SEED_TAG_IDS.AYNI_HAYVAN, name: "Aynı Hayvan", color: "#7c3aed" },
  { id: SEED_TAG_IDS.KOC, name: "Koç", color: "#0284c7" },
  { id: SEED_TAG_IDS.KOYUN, name: "Koyun", color: "#9333ea" },
  { id: SEED_TAG_IDS.GUN1, name: "1. Gün", color: "#374151" },
  { id: SEED_TAG_IDS.GUN2, name: "2. Gün", color: "#374151" },
  { id: SEED_TAG_IDS.GUN3, name: "3. Gün", color: "#374151" },
  { id: SEED_TAG_IDS.DIKKAT, name: "Dikkat", color: "#ef4444" },
  { id: SEED_TAG_IDS.MEVTA_KURBANI, name: "Mevta Kurbanı", color: "#0e7490" },
];

function buildSeedRulesForProject(projectId: string) {
  return [
    {
      id: `${projectId}-seed-rule-uganda`,
      projectId,
      name: "AI: Uganda etiketi",
      conditions: [{ field: "aiCategories", operator: "contains", value: "uganda" }],
      action: { type: "add_tag", tagId: SEED_TAG_IDS.UGANDA },
      priority: 100,
    },
    {
      id: `${projectId}-seed-rule-somali`,
      projectId,
      name: "AI: Somali etiketi",
      conditions: [{ field: "aiCategories", operator: "contains", value: "somali" }],
      action: { type: "add_tag", tagId: SEED_TAG_IDS.SOMALI },
      priority: 101,
    },
    {
      id: `${projectId}-seed-rule-cad`,
      projectId,
      name: "AI: Çad etiketi",
      conditions: [{ field: "aiCategories", operator: "contains", value: "çad" }],
      action: { type: "add_tag", tagId: SEED_TAG_IDS.CAD },
      priority: 102,
    },
    {
      id: `${projectId}-seed-rule-afganistan`,
      projectId,
      name: "AI: Afganistan etiketi",
      conditions: [{ field: "aiCategories", operator: "contains", value: "afganistan" }],
      action: { type: "add_tag", tagId: SEED_TAG_IDS.AFGANISTAN },
      priority: 103,
    },
    {
      id: `${projectId}-seed-rule-hindistan`,
      projectId,
      name: "AI: Hindistan etiketi",
      conditions: [{ field: "aiCategories", operator: "contains", value: "hindistan" }],
      action: { type: "add_tag", tagId: SEED_TAG_IDS.HINDISTAN },
      priority: 104,
    },
    {
      id: `${projectId}-seed-rule-ayni-hayvan`,
      projectId,
      name: "AI: Aynı Hayvan etiketi",
      conditions: [{ field: "aiCategories", operator: "contains", value: "aynı_hayvan" }],
      action: { type: "add_tag", tagId: SEED_TAG_IDS.AYNI_HAYVAN },
      priority: 105,
    },
    {
      id: `${projectId}-seed-rule-koc`,
      projectId,
      name: "AI: Koç etiketi",
      conditions: [{ field: "aiCategories", operator: "contains", value: "koç" }],
      action: { type: "add_tag", tagId: SEED_TAG_IDS.KOC },
      priority: 106,
    },
    {
      id: `${projectId}-seed-rule-koyun`,
      projectId,
      name: "AI: Koyun etiketi",
      conditions: [{ field: "aiCategories", operator: "contains", value: "koyun" }],
      action: { type: "add_tag", tagId: SEED_TAG_IDS.KOYUN },
      priority: 107,
    },
    {
      id: `${projectId}-seed-rule-1gun`,
      projectId,
      name: "AI: 1. Gün etiketi",
      conditions: [{ field: "aiCategories", operator: "contains", value: "1.gün" }],
      action: { type: "add_tag", tagId: SEED_TAG_IDS.GUN1 },
      priority: 108,
    },
    {
      id: `${projectId}-seed-rule-2gun`,
      projectId,
      name: "AI: 2. Gün etiketi",
      conditions: [{ field: "aiCategories", operator: "contains", value: "2.gün" }],
      action: { type: "add_tag", tagId: SEED_TAG_IDS.GUN2 },
      priority: 109,
    },
    {
      id: `${projectId}-seed-rule-3gun`,
      projectId,
      name: "AI: 3. Gün etiketi",
      conditions: [{ field: "aiCategories", operator: "contains", value: "3.gün" }],
      action: { type: "add_tag", tagId: SEED_TAG_IDS.GUN3 },
      priority: 110,
    },
    {
      id: `${projectId}-seed-rule-dikkat`,
      projectId,
      name: "AI: Dikkat etiketi + İşaret",
      conditions: [{ field: "aiWarnings", operator: "is_not_empty" }],
      action: {
        type: "compound",
        actions: [
          { type: "add_tag", tagId: SEED_TAG_IDS.DIKKAT },
          { type: "flag", flagReason: "AI uyarısı tespit edildi" },
        ],
      },
      priority: 200,
    },
  ];
}

async function migrateMevtaTags(): Promise<void> {
  try {
    const canonicalId = SEED_TAG_IDS.MEVTA_KURBANI;

    const oldTags = await db.select({ id: customTagsTable.id, name: customTagsTable.name })
      .from(customTagsTable)
      .where(
        sql`lower(${customTagsTable.name}) IN ('mevta', 'mevta kurbani', 'mevta kurbanı') AND ${customTagsTable.id} != ${canonicalId}`
      );

    if (oldTags.length === 0) {
      return;
    }

    const oldIds = oldTags.map(t => t.id);
    logger.info({ oldIds }, "[seed] Migrating Mevta tags to Mevta Kurbanı");

    for (const oldId of oldIds) {
      const oldDonationTags = await db.select({ donationId: donationTagsTable.donationId })
        .from(donationTagsTable)
        .where(eq(donationTagsTable.tagId, oldId));

      for (const dt of oldDonationTags) {
        await db.insert(donationTagsTable)
          .values({ donationId: dt.donationId, tagId: canonicalId, updatedAt: new Date() })
          .onConflictDoNothing();
      }

      await db.delete(donationTagsTable)
        .where(eq(donationTagsTable.tagId, oldId));
    }

    await db.delete(customTagsTable)
      .where(inArray(customTagsTable.id, oldIds));

    logger.info({ oldIds }, "[seed] Mevta tags merged into Mevta Kurbanı");
  } catch (err) {
    logger.error({ err }, "[seed] Failed to migrate Mevta tags");
  }
}

export async function seedTagsAndRules(): Promise<void> {
  try {
    for (const tag of SEED_TAGS) {
      await db.insert(customTagsTable)
        .values({ id: tag.id, name: tag.name, color: tag.color, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: customTagsTable.id,
          set: { color: tag.color, name: tag.name, updatedAt: new Date() },
        });
    }
    logger.info("[seed] Custom tags seeded");

    await migrateMevtaTags();

    const projects = await db.select({ id: projectsTable.id })
      .from(projectsTable)
      .where(isNull(projectsTable.deletedAt));

    for (const project of projects) {
      await seedRulesForProject(project.id);
    }

    logger.info({ projectCount: projects.length }, "[seed] Automation rules seeded for all projects");
  } catch (err) {
    logger.error({ err }, "[seed] Failed to seed tags and rules");
  }
}

export async function seedRulesForProject(projectId: string): Promise<void> {
  try {
    const rules = buildSeedRulesForProject(projectId);
    for (const rule of rules) {
      const existing = await db.select({ id: automationRulesTable.id })
        .from(automationRulesTable)
        .where(and(
          eq(automationRulesTable.id, rule.id),
          eq(automationRulesTable.projectId, projectId),
        ))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(automationRulesTable).values({
          id: rule.id,
          projectId: rule.projectId,
          name: rule.name,
          conditions: rule.conditions,
          action: rule.action,
          priority: rule.priority,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).onConflictDoNothing();
      }
    }
  } catch (err) {
    logger.error({ err, projectId }, "[seed] Failed to seed rules for project");
  }
}
