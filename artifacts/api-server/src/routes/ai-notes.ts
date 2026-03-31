import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable, donationsTable, aiJobsTable } from "@workspace/db/schema";
import { eq, lt, or, desc, and } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import crypto from "crypto";
import { asyncHandler } from "../middleware/error-handler";
import { logger } from "../lib/logger";
import { TX_BATCH_SIZE, AiJobStatus, STALE_JOB_CUTOFF_MS, STALE_JOB_CLEANUP_INTERVAL_MS, ERROR_MESSAGES } from "../lib/constants";

const router: IRouter = Router();

const DEFAULT_PROMPT = `Sen bir kurban/bağış yönetim sisteminin asistanısın. Sana verilen bağışçı notlarını analiz et ve her not için aşağıdaki kategorilerde sınıflandırma yap.

Notları analiz ederken:
1. Belirtilen kategorilere göre tespit et
2. Bağışçının cinsi (donationType) ile notları karşılaştır ve tutarsızlıkları bildir
3. Önemli istekler veya uyarılar varsa belirt
4. Büyük/küçük harf farkını görmezden gel. "vacip", "vacib", "VACİP", "VACİB" gibi yazımlar aynı anlama gelir, uyarı verme. Benzer şekilde "adak", "Adak", "ADAK" aynıdır

Kategoriler:
{{CATEGORIES}}

Kategori kuralları:
- "3.gün": Notta "üçüncü gün kesilsin", "üçüncü gün", "3.gün", "seferi olacağım üçüncü gün kesilsin" gibi ifadeler varsa bu etiketi ata.
- "2.gün": Notta "mutlaka 2.gün kesilecek", "2.gün", "ikinci gün", "3.gün seferi olacağım" (yani 3.gün seferi = 2.gün kesilmeli) gibi ifadeler varsa bu etiketi ata.
- "erken_kesim": Notta "seferi olacağım ilk hayvanda kesilsin", "ilk hayvan", "birinci hayvan", "ılk hayvan", "erken kesim", "erkenden kesim", "yola çıkacağım", "mümkünse erkenden kesilsin", "sabah erken saatte kesilsin", "öğleden önce kesilsin", "geç kesim", "erken saat", "seferi" gibi ifadeler varsa bu etiketi ata. Zaman hassasiyeti olan tüm istekleri kapsar.
- "özel_kesim": Notta belirli bir saat belirtiliyorsa (ör: "saat 10'da", "14:00'te"), özel zaman talebi varsa (ör: "öğleden sonra kesilsin", "akşama doğru") bu etiketi ata.
- "Şafi": Notta "şafi", "şafi mezhebindeyim", "şafii", "safi", "safı" gibi ifadeler varsa bu etiketi ata VE uyarı olarak "Şafi mezhebine göre kesim gerekiyor" yaz. Bu önemli bir uyarıdır.
- "Sünnet" bağış cinsi: Notta "sünnet", "sunnet" ifadesi geçerse, categories listesine "sünnet" ekle. Bu bir donationType (bağış cinsi) olarak değerlendirilmeli.

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
  "3.gün",
  "2.gün",
  "erken_kesim",
  "özel_kesim",
  "Şafi",
  "sünnet",
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

router.get("/ai-notes/settings", asyncHandler(async (_req, res) => {
  const [promptRow, categoriesRow] = await Promise.all([
    db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ai_prompt")).then(r => r[0]),
    db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ai_categories")).then(r => r[0]),
  ]);

  res.json({
    prompt: promptRow?.value || DEFAULT_PROMPT,
    categories: categoriesRow ? JSON.parse(categoriesRow.value) : DEFAULT_CATEGORIES,
  });
}));

router.put("/ai-notes/settings", asyncHandler(async (req, res) => {
  const parsed = z.object({
    prompt: z.string().optional(),
    categories: z.array(z.string()).optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
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
}));

router.post("/ai-notes/classify", asyncHandler(async (req, res) => {
  const parsed = classifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

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
}));

const classifyAsyncSchema = z.object({
  donations: z.array(z.object({
    id: z.string(),
    name: z.string().optional().default(""),
    donationType: z.string().optional().default(""),
    vekalet: z.string().optional().default(""),
    notes: z.string().optional().default(""),
  })).min(1).max(5000),
  kesimAlaniId: z.string().optional(),
});

router.post("/ai-notes/classify-async", asyncHandler(async (req, res) => {
  const parsed = classifyAsyncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { donations, kesimAlaniId } = parsed.data;
  const jobId = crypto.randomUUID();

  await db.insert(aiJobsTable).values({
    id: jobId,
    status: AiJobStatus.PENDING,
    totalDonations: donations.length,
    processedDonations: 0,
    ...(kesimAlaniId ? { kesimAlaniId } : {}),
  });

  res.status(202).json({ jobId, status: AiJobStatus.PENDING, totalDonations: donations.length });

  processClassifyJob(jobId, donations).catch(err => {
    logger.error({ err, jobId }, "AI job unhandled error");
  });
}));

const CHUNK_SIZE = 50;
const PARALLEL_CHUNKS = 3;

async function isJobCancelled(jobId: string): Promise<boolean> {
  const [job] = await db.select({ status: aiJobsTable.status }).from(aiJobsTable).where(eq(aiJobsTable.id, jobId));
  return !job || job.status === AiJobStatus.CANCELLED;
}

async function processOneChunk(
  systemPrompt: string,
  chunk: Array<{ id: string; name: string; donationType: string; vekalet: string; notes: string }>,
  jobId: string,
  chunkIndex: number,
): Promise<unknown[]> {
  const userContent = chunk.map(d => ({
    donationId: d.id,
    isim: d.name,
    cinsi: d.donationType,
    vekalet: d.vekalet,
    not: d.notes,
  }));

  let retries = 3;
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
      return parseAiResults(content);
    } catch (err) {
      retries--;
      if (retries === 0) {
        logger.error({ err, jobId, chunk: chunkIndex + 1 }, "AI job chunk failed after 3 retries");
        return chunk.map(d => ({
          donationId: d.id,
          categories: [],
          requests: "",
          warnings: "AI işlemi başarısız oldu",
          summary: "",
        }));
      }
      const delay = (4 - retries) * 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return [];
}

async function processClassifyJob(
  jobId: string,
  donations: Array<{ id: string; name: string; donationType: string; vekalet: string; notes: string }>
) {
  try {
    await db.update(aiJobsTable)
      .set({ status: AiJobStatus.PROCESSING, updatedAt: new Date() })
      .where(eq(aiJobsTable.id, jobId));

    const { prompt, categories } = await getAiSettings();
    const systemPrompt = prompt.replace("{{CATEGORIES}}", categories.join(", "));

    const allResults: unknown[] = [];
    const chunks: Array<{ id: string; name: string; donationType: string; vekalet: string; notes: string }>[] = [];
    for (let i = 0; i < donations.length; i += CHUNK_SIZE) {
      chunks.push(donations.slice(i, i + CHUNK_SIZE));
    }

    let processedCount = 0;

    for (let i = 0; i < chunks.length; i += PARALLEL_CHUNKS) {
      if (await isJobCancelled(jobId)) {
        logger.info({ jobId }, "AI job cancelled by user");
        return;
      }

      const parallelChunks = chunks.slice(i, i + PARALLEL_CHUNKS);
      const parallelResults = await Promise.all(
        parallelChunks.map((chunk, idx) => processOneChunk(systemPrompt, chunk, jobId, i + idx))
      );

      for (const results of parallelResults) {
        allResults.push(...results);
      }

      processedCount += parallelChunks.reduce((sum, c) => sum + c.length, 0);
      processedCount = Math.min(processedCount, donations.length);

      await db.update(aiJobsTable)
        .set({
          processedDonations: processedCount,
          result: JSON.stringify(allResults),
          updatedAt: new Date(),
        })
        .where(eq(aiJobsTable.id, jobId));
    }

    const updateResult = await db.update(aiJobsTable)
      .set({
        status: AiJobStatus.COMPLETED,
        processedDonations: donations.length,
        result: JSON.stringify(allResults),
        updatedAt: new Date(),
      })
      .where(and(eq(aiJobsTable.id, jobId), or(eq(aiJobsTable.status, AiJobStatus.PENDING), eq(aiJobsTable.status, AiJobStatus.PROCESSING))));

    if (updateResult.rowCount === 0) {
      logger.info({ jobId }, "AI job was cancelled before completion could be written");
      return;
    }

    logger.info({ jobId, count: donations.length }, "AI job completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.UNKNOWN_ERROR;
    logger.error({ jobId, error: message }, "AI job failed");

    await db.update(aiJobsTable)
      .set({ status: AiJobStatus.FAILED, error: message, updatedAt: new Date() })
      .where(eq(aiJobsTable.id, jobId));
  }
}

router.get("/ai-notes/jobs/:jobId", asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const [job] = await db.select().from(aiJobsTable).where(eq(aiJobsTable.id, jobId));

  if (!job) {
    res.status(404).json({ error: ERROR_MESSAGES.JOB_NOT_FOUND });
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

  if ((job.status === AiJobStatus.COMPLETED || job.status === AiJobStatus.PROCESSING || job.status === AiJobStatus.CANCELLED) && job.result) {
    try {
      response.results = JSON.parse(job.result);
    } catch {
      response.results = [];
      response.error = ERROR_MESSAGES.RESULT_PARSE_ERROR;
    }
  }

  if (job.status === AiJobStatus.FAILED && job.error) {
    response.error = job.error;
  }

  res.json(response);
}));

router.post("/ai-notes/jobs/:jobId/cancel", asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const [job] = await db.select().from(aiJobsTable).where(eq(aiJobsTable.id, jobId));

  if (!job) {
    res.status(404).json({ error: ERROR_MESSAGES.JOB_NOT_FOUND });
    return;
  }

  if (job.status !== AiJobStatus.PENDING && job.status !== AiJobStatus.PROCESSING) {
    res.status(400).json({ error: ERROR_MESSAGES.JOB_NOT_CANCELLABLE });
    return;
  }

  await db.update(aiJobsTable)
    .set({ status: AiJobStatus.CANCELLED, updatedAt: new Date() })
    .where(eq(aiJobsTable.id, jobId));

  res.json({ success: true, jobId, status: AiJobStatus.CANCELLED });
}));

router.get("/ai-notes/active-job", asyncHandler(async (req, res) => {
  const { kesimAlaniId } = req.query;
  if (!kesimAlaniId || typeof kesimAlaniId !== "string") {
    res.json({ job: null });
    return;
  }

  const jobs = await db.select().from(aiJobsTable)
    .where(
      and(
        eq(aiJobsTable.kesimAlaniId, kesimAlaniId),
        or(eq(aiJobsTable.status, AiJobStatus.PENDING), eq(aiJobsTable.status, AiJobStatus.PROCESSING))
      )
    )
    .orderBy(desc(aiJobsTable.createdAt))
    .limit(1);

  const job = jobs[0];
  if (!job) {
    res.json({ job: null });
    return;
  }

  res.json({
    job: {
      jobId: job.id,
      status: job.status,
      totalDonations: job.totalDonations,
      processedDonations: job.processedDonations,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
  });
}));

router.put("/ai-notes/save-classifications", asyncHandler(async (req, res) => {
  const parsed = z.object({
    classifications: z.array(z.object({
      donationId: z.string(),
      categories: z.array(z.string()),
      warnings: z.string().optional().default(""),
    })).max(2000),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { classifications } = parsed.data;

  await db.transaction(async (tx) => {
    for (let i = 0; i < classifications.length; i += TX_BATCH_SIZE) {
      const chunk = classifications.slice(i, i + TX_BATCH_SIZE);
      await Promise.all(chunk.map(c =>
        tx.update(donationsTable)
          .set({
            aiCategories: JSON.stringify(c.categories),
            aiWarnings: c.warnings,
          })
          .where(eq(donationsTable.id, c.donationId))
      ));
    }
  });

  res.json({ success: true, count: classifications.length });
}));

router.put("/ai-notes/bulk-update", asyncHandler(async (req, res) => {
  const parsed = z.object({
    kesimAlaniId: z.string(),
    updates: z.array(z.object({
      donationId: z.string(),
      notes: z.string().optional(),
      description: z.string().optional(),
    })).max(2000),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { updates } = parsed.data;

  await db.transaction(async (tx) => {
    for (let i = 0; i < updates.length; i += TX_BATCH_SIZE) {
      const chunk = updates.slice(i, i + TX_BATCH_SIZE);
      await Promise.all(chunk.map(u => {
        const setFields: Record<string, string> = {};
        if (u.notes !== undefined) setFields.notes = u.notes;
        if (u.description !== undefined) setFields.description = u.description;
        if (Object.keys(setFields).length === 0) return Promise.resolve();
        return tx.update(donationsTable)
          .set(setFields)
          .where(eq(donationsTable.id, u.donationId));
      }));
    }
  });

  res.json({ success: true, count: updates.length });
}));

(async () => {
  try {
    const staleCondition = or(
      eq(aiJobsTable.status, AiJobStatus.PENDING),
      eq(aiJobsTable.status, AiJobStatus.PROCESSING),
    );
    await db.update(aiJobsTable)
      .set({ status: AiJobStatus.FAILED, error: ERROR_MESSAGES.SERVER_RESTARTED, updatedAt: new Date() })
      .where(staleCondition!);
    logger.info("[ai-jobs] Startup: marked stale jobs as failed");
  } catch (err) {
    logger.error({ err }, "[ai-jobs] Startup cleanup error");
  }
})();

setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - STALE_JOB_CUTOFF_MS);
    await db.delete(aiJobsTable).where(lt(aiJobsTable.createdAt, cutoff));
  } catch (err) {
    logger.error({ err }, "[ai-jobs] Cleanup error");
  }
}, STALE_JOB_CLEANUP_INTERVAL_MS);

export default router;
