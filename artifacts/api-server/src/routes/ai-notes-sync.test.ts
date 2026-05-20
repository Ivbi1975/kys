import { describe, it, expect, afterAll, beforeAll } from "vitest";
import supertest from "supertest";
import crypto from "crypto";
import { db } from "@workspace/db";
import { donationTagsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import app from "../app";

const TEST_PREFIX = "__vitest_ai_sync__";
const API_KEY = process.env.API_KEY!;
const agent = supertest(app);
const TS = Date.now();

function get(url: string) {
  return agent.get(url).set("X-API-Key", API_KEY);
}
function post(url: string) {
  return agent.post(url).set("X-API-Key", API_KEY);
}
function put(url: string) {
  return agent.put(url).set("X-API-Key", API_KEY);
}
function del(url: string) {
  return agent.delete(url).set("X-API-Key", API_KEY);
}

function aiTagId(catName: string): string {
  return `__ai_tag__${crypto.createHash("md5").update(catName).digest("hex")}`;
}

async function getAiTagsForDonation(donationId: string): Promise<string[]> {
  const rows = await db
    .select({ tagId: donationTagsTable.tagId })
    .from(donationTagsTable)
    .where(eq(donationTagsTable.donationId, donationId));
  return rows.map((r) => r.tagId).filter((id) => id.startsWith("__ai_tag__"));
}

const poolKaId = `${TEST_PREFIX}-pool-${TS}`;
const nonPoolKaId = `${TEST_PREFIX}-non-pool-${TS}`;
const VEKALET = `VKL-SYNC-${TS}`;
const poolDonationId = `${TEST_PREFIX}-pool-don-${TS}`;
const nonPoolDonationId = `${TEST_PREFIX}-non-pool-don-${TS}`;

let projectId: string;

afterAll(async () => {
  await del(`/api/kesim-alanlari/${poolKaId}?permanent=true`);
  await del(`/api/kesim-alanlari/${nonPoolKaId}?permanent=true`);
  if (projectId) await del(`/api/projects/${projectId}`);
});

describe("AI tag sync — setup", () => {
  it("creates a project", async () => {
    const res = await post("/api/projects").send({ name: `${TEST_PREFIX} Proje ${TS}` });
    expect(res.status).toBe(201);
    projectId = res.body.id;
    expect(projectId).toBeTruthy();
  });

  it("creates a pool KA (__havuz__) and a non-pool KA", async () => {
    const pool = await post("/api/kesim-alanlari").send({
      id: poolKaId,
      name: "__havuz__",
      projectId,
      donations: [],
      animalGroups: [],
    });
    expect(pool.status).toBe(201);

    const nonPool = await post("/api/kesim-alanlari").send({
      id: nonPoolKaId,
      name: "KA-Kesim",
      projectId,
      donations: [],
      animalGroups: [],
    });
    expect(nonPool.status).toBe(201);
  });

  it("creates pool donation and transferred copy with the same vekalet", async () => {
    const d1 = await post(`/api/kesim-alanlari/${poolKaId}/donations`).send({
      id: poolDonationId,
      name: "Test Bağışçı",
      description: "Büyükbaş",
      donationType: "kurban",
      shareCount: 1,
      vekalet: VEKALET,
    });
    expect(d1.status).toBe(201);

    const d2 = await post(`/api/kesim-alanlari/${nonPoolKaId}/donations`).send({
      id: nonPoolDonationId,
      name: "Test Bağışçı",
      description: "Büyükbaş",
      donationType: "kurban",
      shareCount: 1,
      vekalet: VEKALET,
    });
    expect(d2.status).toBe(201);
  });
});

describe("AI tag sync — retroactive propagation to transferred copies", () => {
  const firstCategories = ["erken_kesim", "mevta_kurbani"];

  it("save-classifications for the pool donation returns 200", async () => {
    const res = await put("/api/ai-notes/save-classifications").send({
      classifications: [
        {
          donationId: poolDonationId,
          categories: firstCategories,
          confidence: 9,
          warnings: "",
          requests: "",
          summary: "Test özeti",
        },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("pool donation has donation_tags for each classified category", async () => {
    const tags = await getAiTagsForDonation(poolDonationId);
    for (const cat of firstCategories) {
      expect(tags).toContain(aiTagId(cat));
    }
    expect(tags.length).toBe(firstCategories.length);
  });

  it("non-pool donation inherits the same donation_tags as the pool copy", async () => {
    const tags = await getAiTagsForDonation(nonPoolDonationId);
    for (const cat of firstCategories) {
      expect(tags).toContain(aiTagId(cat));
    }
    expect(tags.length).toBe(firstCategories.length);
  });
});

describe("AI tag sync — stale tags are replaced on reclassification", () => {
  const secondCategories = ["acil", "Şafi"];

  it("reclassifies pool donation with a different category set", async () => {
    const res = await put("/api/ai-notes/save-classifications").send({
      classifications: [
        {
          donationId: poolDonationId,
          categories: secondCategories,
          confidence: 8,
          warnings: "Şafi mezhebine göre kesim gerekiyor",
          requests: "",
          summary: "Güncellenmiş özet",
        },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("non-pool donation no longer has the old AI category tags", async () => {
    const tags = await getAiTagsForDonation(nonPoolDonationId);
    const oldTagIds = ["erken_kesim", "mevta_kurbani"].map(aiTagId);
    for (const oldTag of oldTagIds) {
      expect(tags).not.toContain(oldTag);
    }
  });

  it("non-pool donation has exactly the new AI category tags", async () => {
    const tags = await getAiTagsForDonation(nonPoolDonationId);
    for (const cat of secondCategories) {
      expect(tags).toContain(aiTagId(cat));
    }
    expect(tags.length).toBe(secondCategories.length);
  });
});

describe("AI tag sync — no propagation across different projects", () => {
  const otherProjectPoolKaId = `${TEST_PREFIX}-other-pool-${TS}`;
  const otherProjectNonPoolKaId = `${TEST_PREFIX}-other-np-${TS}`;
  const otherProjectDonationId = `${TEST_PREFIX}-other-don-${TS}`;
  let otherProjectId: string;

  afterAll(async () => {
    await del(`/api/kesim-alanlari/${otherProjectPoolKaId}?permanent=true`);
    await del(`/api/kesim-alanlari/${otherProjectNonPoolKaId}?permanent=true`);
    if (otherProjectId) await del(`/api/projects/${otherProjectId}`);
  });

  it("creates a second project whose non-pool donation shares the same vekalet", async () => {
    const p2 = await post("/api/projects").send({ name: `${TEST_PREFIX} Proje2 ${TS}` });
    expect(p2.status).toBe(201);
    otherProjectId = p2.body.id;

    await post("/api/kesim-alanlari").send({
      id: otherProjectPoolKaId,
      name: "__havuz__",
      projectId: otherProjectId,
      donations: [],
      animalGroups: [],
    });

    await post("/api/kesim-alanlari").send({
      id: otherProjectNonPoolKaId,
      name: "KA-Diger",
      projectId: otherProjectId,
      donations: [],
      animalGroups: [],
    });

    const d = await post(`/api/kesim-alanlari/${otherProjectNonPoolKaId}/donations`).send({
      id: otherProjectDonationId,
      name: "Diger Bagisci",
      description: "Büyükbaş",
      donationType: "kurban",
      shareCount: 1,
      vekalet: VEKALET,
    });
    expect(d.status).toBe(201);
  });

  it("classifying the first project pool donation does not add tags to the other project donation", async () => {
    await put("/api/ai-notes/save-classifications").send({
      classifications: [
        {
          donationId: poolDonationId,
          categories: ["koç"],
          confidence: 7,
          warnings: "",
          requests: "",
          summary: "Cross-project test",
        },
      ],
    });

    const tags = await getAiTagsForDonation(otherProjectDonationId);
    expect(tags.length).toBe(0);
  });
});
