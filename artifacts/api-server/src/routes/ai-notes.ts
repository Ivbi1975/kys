import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable, donationsTable, aiJobsTable } from "@workspace/db/schema";
import { eq, inArray, lt, or } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import crypto from "crypto";

const router: IRouter = Router();

const DEFAULT_PROMPT = `Sen bir kurban/bağış yönetim sisteminin asistanısın. Sana verilen bağışçı notlarını analiz et ve her not için aşağıdaki kategorilerde sınıflandırma yap.

Notları analiz ederken:
1. Belirtilen kategorilere göre tespit et
2. Bağışçının cinsi (donationType) ile notları karşılaştır ve tutarsızlıkları bildir
3. Önemli istekler veya uyarılar varsa belirt
4. Büyük/küçük harf farkını görmezden gel. "vacip", "vacib", "VACİP", "VACİB" gibi yazımlar aynı anlama gelir, uyarı verme. Benzer şekilde "adak", "Adak", "ADAK" aynıdır

Kategoriler:
{{CATEGORIES}}

Her bağışçı için JSON formatında yanıt ver:
{
  "donationId": "...",
  "categories": ["kategori1", "kategori2"],
  "requests": "tespit edilen özel istekler",
  "warnings": "uyarılar ve tutarsızlıklar",
  "summary": "kısa özet"
}

Yanıtı JSON array olarak ver: [{...}, {...}]`;

const DEFAULT_CATEGORIES = [
  "sabah_kesimi",
  "ulke_talebi",
  "mevta_kurbani",
  "adak",
  "akika",
  "vacip",
  "nafile",
];

async function getAiSettings(): Promise<{ prompt: string; categories: string[] }> {
  const [promptRow, categoriesRow] = await Promise.all([
    db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ai_prompt")).then(r => r[0]),
    db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ai_categories")).then(r => r[0]),
  ]);

  const prompt = promptRow?.value || DEFAULT_PROMPT;
  const categories = categoriesRow ? JSON.parse(categoriesRow.value) as string[] : DEFAULT_CATEGORIES;

  return { prompt, categories };
}

const classifySchema = z.object({
  donations: z.array(z.object({
    id: z.string(),
    name: z.string().optional().default(""),
    donationType: z.string().optional().default(""),
    vekalet: z.string().optional().default(""),
    notes: z.string().optional().default(""),
  })).min(1).max(500),
});

function parseAiResults(content: string): unknown[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    const results = parsed.results || parsed.data || parsed.classifications || parsed.donations || parsed.items || null;
    if (results) return results;
    const firstArrayValue = Object.values(parsed).find(v => Array.isArray(v));
    return (firstArrayValue as unknown[]) || [];
  } catch {
    return [];
  }
}

router.get("/ai-notes/settings", async (_req, res) => {
  try {
    const [promptRow, categoriesRow] = await Promise.all([
      db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ai_prompt")).then(r => r[0]),
      db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ai_categories")).then(r => r[0]),
    ]);

    res.json({
      prompt: promptRow?.value || DEFAULT_PROMPT,
      categories: categoriesRow ? JSON.parse(categoriesRow.value) : DEFAULT_CATEGORIES,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("GET /ai-notes/settings error:", message);
    res.status(500).json({ error: message });
  }
});

router.put("/ai-notes/settings", async (req, res) => {
  try {
    const parsed = z.object({
      prompt: z.string().optional(),
      categories: z.array(z.string()).optional(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
      return;
    }

    const { prompt, categories } = parsed.data;

    if (prompt !== undefined) {
      await db.insert(appSettingsTable)
        .values({ key: "ai_prompt", value: prompt })
        .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: prompt } });
    }

    if (categories !== undefined) {
      const val = JSON.stringify(categories);
      await db.insert(appSettingsTable)
        .values({ key: "ai_categories", value: val })
        .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: val } });
    }

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("PUT /ai-notes/settings error:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/ai-notes/classify", async (req, res) => {
  const parsed = classifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  try {
    const { donations } = parsed.data;
    const { prompt, categories } = await getAiSettings();

    const systemPrompt = prompt.replace("{{CATEGORIES}}", categories.join(", "));

    const userContent = donations.map(d => ({
      donationId: d.id,
      isim: d.name,
      cinsi: d.donationType,
      vekalet: d.vekalet,
      not: d.notes,
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userContent) },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const results = parseAiResults(content);

    res.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("POST /ai-notes/classify error:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/ai-notes/classify-async", async (req, res) => {
  const parsed = classifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  try {
    const { donations } = parsed.data;
    const jobId = crypto.randomUUID();

    await db.insert(aiJobsTable).values({
      id: jobId,
      status: "pending",
      totalDonations: donations.length,
      processedDonations: 0,
    });

    res.status(202).json({ jobId, status: "pending", totalDonations: donations.length });

    processClassifyJob(jobId, donations).catch(err => {
      console.error(`[ai-job:${jobId}] Unhandled error:`, err);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("POST /ai-notes/classify-async error:", message);
    res.status(500).json({ error: message });
  }
});

const CHUNK_SIZE = 50;

async function processClassifyJob(
  jobId: string,
  donations: Array<{ id: string; name: string; donationType: string; vekalet: string; notes: string }>
) {
  try {
    await db.update(aiJobsTable)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(aiJobsTable.id, jobId));

    const { prompt, categories } = await getAiSettings();
    const systemPrompt = prompt.replace("{{CATEGORIES}}", categories.join(", "));

    const allResults: unknown[] = [];

    for (let i = 0; i < donations.length; i += CHUNK_SIZE) {
      const chunk = donations.slice(i, i + CHUNK_SIZE);

      const userContent = chunk.map(d => ({
        donationId: d.id,
        isim: d.name,
        cinsi: d.donationType,
        vekalet: d.vekalet,
        not: d.notes,
      }));

      let retries = 3;
      let chunkResults: unknown[] = [];

      while (retries > 0) {
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-5-mini",
            max_completion_tokens: 8192,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: JSON.stringify(userContent) },
            ],
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content || "{}";
          chunkResults = parseAiResults(content);
          break;
        } catch (err) {
          retries--;
          if (retries === 0) {
            console.error(`[ai-job:${jobId}] Chunk ${i / CHUNK_SIZE + 1} failed after 3 retries:`, err);
            chunkResults = chunk.map(d => ({
              donationId: d.id,
              categories: [],
              requests: "",
              warnings: "AI işlemi başarısız oldu",
              summary: "",
            }));
          } else {
            const delay = (4 - retries) * 2000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      allResults.push(...chunkResults);

      await db.update(aiJobsTable)
        .set({
          processedDonations: Math.min(i + chunk.length, donations.length),
          updatedAt: new Date(),
        })
        .where(eq(aiJobsTable.id, jobId));
    }

    await db.update(aiJobsTable)
      .set({
        status: "completed",
        processedDonations: donations.length,
        result: JSON.stringify(allResults),
        updatedAt: new Date(),
      })
      .where(eq(aiJobsTable.id, jobId));

    console.log(`[ai-job:${jobId}] Completed: ${donations.length} donations processed`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`[ai-job:${jobId}] Failed:`, message);

    await db.update(aiJobsTable)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(aiJobsTable.id, jobId));
  }
}

router.get("/ai-notes/jobs/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const [job] = await db.select().from(aiJobsTable).where(eq(aiJobsTable.id, jobId));

    if (!job) {
      res.status(404).json({ error: "İş bulunamadı" });
      return;
    }

    const response: Record<string, unknown> = {
      jobId: job.id,
      status: job.status,
      totalDonations: job.totalDonations,
      processedDonations: job.processedDonations,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };

    if (job.status === "completed" && job.result) {
      try {
        response.results = JSON.parse(job.result);
      } catch {
        response.results = [];
        response.error = "Sonuç ayrıştırılamadı";
      }
    }

    if (job.status === "failed" && job.error) {
      response.error = job.error;
    }

    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("GET /ai-notes/jobs/:jobId error:", message);
    res.status(500).json({ error: message });
  }
});

router.put("/ai-notes/save-classifications", async (req, res) => {
  try {
    const parsed = z.object({
      classifications: z.array(z.object({
        donationId: z.string(),
        categories: z.array(z.string()),
        warnings: z.string().optional().default(""),
      })).max(500),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
      return;
    }

    const { classifications } = parsed.data;

    await db.transaction(async (tx) => {
      for (const c of classifications) {
        await tx.update(donationsTable)
          .set({
            aiCategories: JSON.stringify(c.categories),
            aiWarnings: c.warnings,
          })
          .where(eq(donationsTable.id, c.donationId));
      }
    });

    res.json({ success: true, count: classifications.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("PUT /ai-notes/save-classifications error:", message);
    res.status(500).json({ error: message });
  }
});

router.put("/ai-notes/bulk-update", async (req, res) => {
  try {
    const parsed = z.object({
      kesimAlaniId: z.string(),
      updates: z.array(z.object({
        donationId: z.string(),
        notes: z.string(),
      })).max(500),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
      return;
    }

    const { updates } = parsed.data;

    await db.transaction(async (tx) => {
      for (const u of updates) {
        await tx.update(donationsTable)
          .set({ notes: u.notes })
          .where(eq(donationsTable.id, u.donationId));
      }
    });

    res.json({ success: true, count: updates.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("PUT /ai-notes/bulk-update error:", message);
    res.status(500).json({ error: message });
  }
});

(async () => {
  try {
    const staleCondition = or(
      eq(aiJobsTable.status, "pending"),
      eq(aiJobsTable.status, "processing"),
    );
    await db.update(aiJobsTable)
      .set({ status: "failed", error: "Sunucu yeniden başlatıldı", updatedAt: new Date() })
      .where(staleCondition!);
    console.log("[ai-jobs] Startup: marked stale jobs as failed");
  } catch (err) {
    console.error("[ai-jobs] Startup cleanup error:", err);
  }
})();

setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.delete(aiJobsTable).where(lt(aiJobsTable.createdAt, cutoff));
  } catch (err) {
    console.error("[ai-jobs] Cleanup error:", err);
  }
}, 60 * 60 * 1000);

export default router;
