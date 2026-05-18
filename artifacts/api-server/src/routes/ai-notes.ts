import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable, donationsTable, aiJobsTable, kesimAlanlariTable, aiJobLogsTable } from "@workspace/db/schema";
import { eq, lt, or, desc, and, inArray, ne, isNull } from "drizzle-orm";
import { z } from "zod";
import { assertOpenAiConfigured, openai } from "@workspace/integrations-openai-ai-server";
import crypto from "crypto";
import { asyncHandler } from "../middleware/error-handler";
import { logger } from "../lib/logger";
import { TX_BATCH_SIZE, AiJobStatus, STALE_JOB_CUTOFF_MS, STALE_JOB_CLEANUP_INTERVAL_MS, AI_JOB_TTL_MS, AI_JOB_EXPIRY_CHECK_INTERVAL_MS, ERROR_MESSAGES } from "../lib/constants";

const router: IRouter = Router();

const DEFAULT_PROMPT = `Sen bir kurban/bağış yönetim sisteminin asistanısın. Sana verilen bağışçı notlarını detaylı şekilde analiz et ve her not için aşağıdaki kategorilerde sınıflandırma yap.

Notları analiz ederken:
1. Belirtilen kategorilere göre tespit et — birden fazla kategori atanabilir
2. Bağışçının cinsi (donationType) ile notları karşılaştır ve tutarsızlıkları bildir
3. Önemli istekler veya uyarılar varsa açıkça belirt
4. Büyük/küçük harf farkını görmezden gel. "vacip", "vacib", "VACİP", "VACİB" aynıdır; "adak", "Adak", "ADAK" aynıdır
5. Her not için anlamlı bir özet (summary) yaz — notta ne istendiğini kısaca özetle
6. Özel istekler (requests) alanına yalnızca aksiyon gerektiren spesifik talepleri yaz

Kategoriler:
{{CATEGORIES}}

Kategori kuralları:
- "3.gün": "üçüncü gün", "3.gün", "seferi olacağım üçüncü gün kesilsin" gibi ifadeler varsa ata.
- "2.gün": "2.gün", "ikinci gün", "mutlaka 2.gün kesilecek" gibi ifadeler varsa ata.
- "1.gün": "1.gün", "birinci gün", "ilk gün", "erken_kesim" ile örtüşüyorsa da ata; "sabah erken", "sabah kesimi", "sabah kesilsin", "ilk bıçak" gibi ifadeler varsa ata.
- "erken_kesim": "ilk hayvanda", "birinci hayvan", "erken kesim", "erkenden", "yola çıkacağım", "öğleden önce kesilsin", "sabah erken", "seferi" gibi zaman hassasiyeti olan ifadeler varsa ata.
- "özel_kesim": Belirli saat belirtiliyorsa (ör: "saat 10'da", "14:00'te") veya "öğleden sonra", "akşama doğru" gibi özel zaman talebi varsa ata.
- "Şafi": "şafi", "şafii", "şafi mezhebi", "safi" gibi ifadeler varsa ata VE warnings alanına "Şafi mezhebine göre kesim gerekiyor" yaz. Bu kritik bir uyarıdır.
- "sünnet": "sünnet", "sunnet" ifadesi geçerse ata. Bu bir bağış cinsidir.
- "mevta_kurbani": "merhum", "merhume", "ruhuna", "mevta", "vefat etmiş" gibi ifadeler varsa ata.
- "ulke_talebi": Belirli bir ülkede kesilmesi isteniyorsa ata (ör: "Suriye'de kesilsin", "Afrika'da dağıtılsın").
- "uganda": Notta "Uganda" geçiyorsa ata.
- "somali": Notta "Somali" geçiyorsa ata.
- "çad": Notta "Çad" geçiyorsa ata.
- "afganistan": Notta "Afganistan" geçiyorsa ata.
- "hindistan": Notta "Hindistan" geçiyorsa ata.
- "aynı_hayvan": "aynı hayvan", "aynı kurbanda", "birlikte kesilsin", "[kişi] ile aynı", "aynı hayvandan", "beraber kesilsin" gibi ifadeler varsa ata.
- "koç": Notta "koç" geçiyorsa ata (hayvan türü olarak belirtilmişse).
- "koyun": Notta "koyun" geçiyorsa ata (hayvan türü olarak belirtilmişse).
- "ödeme_notu": Ödeme bilgisi içeriyorsa ata — banka kartı, havale, taksit, garanti kartı, ödeme nerede yapıldığı gibi bilgiler.
- "iletişim_talebi": "arayın", "bildirim yapın", "SMS gönderin", "haberdar edin", "fotoğraf isteği", "video isteği", "haber verin" gibi iletişim/bildirim talepleri varsa ata.
- "et_talebi": "eti bize gelsin", "et teslim", "eti dağıtılsın", "bize getirin", "et paylaşım" gibi et teslimatı veya dağıtım talebi varsa ata.
- "hayvan_tercihi": Belirli bir hayvan özelliği talep ediliyorsa ata (ör: "dişi olsun", "iri hayvan", "büyükbaş olsun").
- "ilk_hayvan": "ilk hayvan", "birinci hayvan", "seferi ilk hayvanda" gibi ifadeler varsa ata.
- "acil": "acil", "mutlaka", "kesinlikle", "çok önemli" gibi aciliyet/öncelik belirten ifadeler veya kritik özel durum varsa ata.
- Birden fazla ülke geçiyorsa her ülke kategorisi ayrı ayrı atanmalıdır.

Her bağışçı için JSON formatında yanıt ver:
{
  "donationId": "...",
  "categories": ["kategori1", "kategori2"],
  "confidence": 8,
  "requests": "Aksiyon gerektiren spesifik talepler (yoksa boş bırak)",
  "warnings": "Dikkat gerektiren uyarılar ve tutarsızlıklar (yoksa boş bırak)",
  "summary": "Notun kısa ve anlaşılır özeti (1-2 cümle)"
}

"confidence" alanı 1-10 arası güven skoru (1=çok düşük güven/belirsiz not, 10=çok yüksek güven/net not). Notu net anlayıp kategori atayabiliyorsan yüksek (7-10), belirsizse düşük (1-4) ver.

Yanıtı şu JSON object formatında ver: {"results": [{...}, {...}]}`;

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
  "1.gün",
  "erken_kesim",
  "özel_kesim",
  "Şafi",
  "sünnet",
  "ödeme_notu",
  "iletişim_talebi",
  "et_talebi",
  "hayvan_tercihi",
  "ilk_hayvan",
  "acil",
  "aynı_hayvan",
  "uganda",
  "somali",
  "çad",
  "afganistan",
  "hindistan",
  "koç",
  "koyun",
];

async function syncAiSettingsToDb(): Promise<void> {
  const [promptRow, categoriesRow] = await Promise.all([
    db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ai_prompt")).then(r => r[0]),
    db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ai_categories")).then(r => r[0]),
  ]);

  if (!promptRow) {
    await db.insert(appSettingsTable)
      .values({ key: "ai_prompt", value: DEFAULT_PROMPT })
      .onConflictDoNothing();
  } else if (!promptRow.value.includes("Kategori kuralları") || !promptRow.value.includes("ödeme_notu") || !promptRow.value.includes("JSON object formatında") || !promptRow.value.includes("aynı_hayvan") || !promptRow.value.includes("1.gün")) {
    const categoryRulesSection = DEFAULT_PROMPT.substring(
      DEFAULT_PROMPT.indexOf("Kategori kuralları:")
    );
    const insertPoint = promptRow.value.indexOf("Her bağışçı için JSON formatında");
    const updatedPrompt = insertPoint !== -1
      ? promptRow.value.substring(0, insertPoint) + categoryRulesSection
      : DEFAULT_PROMPT;
    await db.update(appSettingsTable)
      .set({ value: updatedPrompt })
      .where(eq(appSettingsTable.key, "ai_prompt"));
  }

  if (!categoriesRow) {
    await db.insert(appSettingsTable)
      .values({ key: "ai_categories", value: JSON.stringify(DEFAULT_CATEGORIES) })
      .onConflictDoNothing();
  } else {
    const existing = JSON.parse(categoriesRow.value) as string[];
    const missing = DEFAULT_CATEGORIES.filter(c => !existing.includes(c));
    if (missing.length > 0) {
      const merged = [...existing, ...missing];
      await db.update(appSettingsTable)
        .set({ value: JSON.stringify(merged) })
        .where(eq(appSettingsTable.key, "ai_categories"));
    }
  }
}

async function getAiSettings(): Promise<{ prompt: string; categories: string[] }> {
  const [promptRow, categoriesRow] = await Promise.all([
    db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ai_prompt")).then(r => r[0]),
    db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ai_categories")).then(r => r[0]),
  ]);

  let prompt = promptRow?.value || DEFAULT_PROMPT;

  if (prompt && !prompt.includes("Kategori kuralları")) {
    const categoryRulesSection = DEFAULT_PROMPT.substring(
      DEFAULT_PROMPT.indexOf("Kategori kuralları:")
    );
    const insertPoint = prompt.indexOf("Her bağışçı için JSON formatında");
    if (insertPoint !== -1) {
      prompt = prompt.substring(0, insertPoint) + categoryRulesSection;
    } else {
      prompt = DEFAULT_PROMPT;
    }
  }

  const categories = categoriesRow ? JSON.parse(categoriesRow.value) as string[] : DEFAULT_CATEGORIES;

  return { prompt, categories };
}

const classifySchema = z.object({
  donations: z.array(z.object({
    id: z.string(),
    name: z.string().nullable().optional().transform(v => v ?? ""),
    donationType: z.string().nullable().optional().transform(v => v ?? ""),
    vekalet: z.string().nullable().optional().transform(v => v ?? ""),
    notes: z.string().nullable().optional().transform(v => v ?? ""),
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
    return tryRecoverTruncatedJson(content);
  }
}

function tryRecoverTruncatedJson(content: string): unknown[] {
  const objects: unknown[] = [];
  const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let m: RegExpExecArray | null;
  while ((m = objRegex.exec(content)) !== null) {
    try {
      objects.push(JSON.parse(m[0]));
    } catch { /* skip malformed object */ }
  }
  if (objects.length > 0) return objects;

  const arrayMatch = content.match(/\[[\s\S]*/);
  if (!arrayMatch) return [];
  const raw = arrayMatch[0];

  const lastBracket = raw.lastIndexOf("},");
  if (lastBracket !== -1) {
    try {
      const attempt = raw.slice(0, lastBracket + 1) + "]";
      const parsed = JSON.parse(attempt);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* continue */ }
  }

  return [];
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
  try {
    assertOpenAiConfigured();
  } catch {
    res.status(503).json({ error: "AI entegrasyonu yapılandırılmamış." });
    return;
  }

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

  const dynamicTokens = Math.min(donations.length * 700 + 2000, 32768);
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: dynamicTokens,
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
    name: z.string().nullable().optional().transform(v => v ?? ""),
    donationType: z.string().nullable().optional().transform(v => v ?? ""),
    vekalet: z.string().nullable().optional().transform(v => v ?? ""),
    notes: z.string().nullable().optional().transform(v => v ?? ""),
  })).min(1).max(50000),
  kesimAlaniId: z.string().optional(),
  batchSize: z.number().int().min(5).max(100).optional().default(25),
});

router.post("/ai-notes/classify-async", asyncHandler(async (req, res) => {
  try {
    assertOpenAiConfigured();
  } catch {
    res.status(503).json({ error: "AI entegrasyonu yapılandırılmamış." });
    return;
  }

  const parsed = classifyAsyncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { donations, kesimAlaniId, batchSize } = parsed.data;
  const jobId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + AI_JOB_TTL_MS);

  await db.insert(aiJobsTable).values({
    id: jobId,
    status: AiJobStatus.PENDING,
    totalDonations: donations.length,
    processedDonations: 0,
    expiresAt,
    ...(kesimAlaniId ? { kesimAlaniId } : {}),
  });

  res.status(202).json({ jobId, status: AiJobStatus.PENDING, totalDonations: donations.length });

  processClassifyJob(jobId, donations, batchSize).catch(err => {
    logger.error({ err, jobId }, "AI job unhandled error");
  });
}));

const CHUNK_SIZE = 25;
const PARALLEL_CHUNKS = 5;

async function isJobCancelledOrExpired(jobId: string): Promise<boolean> {
  const [job] = await db.select({
    status: aiJobsTable.status,
    expiresAt: aiJobsTable.expiresAt,
    processedDonations: aiJobsTable.processedDonations,
    totalDonations: aiJobsTable.totalDonations,
  }).from(aiJobsTable).where(eq(aiJobsTable.id, jobId));
  if (!job || job.status === AiJobStatus.CANCELLED) return true;
  if (job.expiresAt && new Date() > job.expiresAt) {
    const errMsg = `Zaman aşımı — ${job.processedDonations ?? 0}/${job.totalDonations ?? 0} not işlendi. Kaldığı yerden devam edebilirsiniz.`;
    await db.update(aiJobsTable)
      .set({ status: AiJobStatus.FAILED, error: errMsg, updatedAt: new Date() })
      .where(eq(aiJobsTable.id, jobId));
    logger.warn({ jobId, processed: job.processedDonations, total: job.totalDonations }, "AI job expired during processing");
    return true;
  }
  return false;
}

async function callAiForDonations(
  systemPrompt: string,
  items: Array<{ id: string; name: string; donationType: string; vekalet: string; notes: string }>,
  jobId: string,
  chunkIndex: number,
): Promise<unknown[]> {
  const userContent = items.map(d => ({
    donationId: d.id,
    isim: d.name,
    cinsi: d.donationType,
    vekalet: d.vekalet,
    not: d.notes,
  }));

  let retries = 3;
  while (retries > 0) {
    try {
      const dynamicTokens = Math.min(items.length * 700 + 2000, 32768);
      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: dynamicTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userContent) },
        ],
        response_format: { type: "json_object" },
      });

      const finishReason = response.choices[0]?.finish_reason;
      const content = response.choices[0]?.message?.content || "{}";

      if (finishReason === "length") {
        logger.warn({ jobId, chunk: chunkIndex + 1, finishReason }, "AI response truncated (token limit)");
      }

      return parseAiResults(content);
    } catch (err) {
      retries--;
      if (retries === 0) {
        logger.error({ err, jobId, chunk: chunkIndex + 1 }, "AI call failed after 3 retries");
        return [];
      }
      const delay = (4 - retries) * 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return [];
}

function findMissingDonations(
  chunk: Array<{ id: string; name: string; donationType: string; vekalet: string; notes: string }>,
  results: unknown[],
): Array<{ id: string; name: string; donationType: string; vekalet: string; notes: string }> {
  const returnedIds = new Set<string>();
  for (const r of results) {
    if (r && typeof r === "object" && "donationId" in r) {
      returnedIds.add(String((r as { donationId: string }).donationId));
    }
  }
  return chunk.filter(d => !returnedIds.has(d.id));
}

async function processOneChunk(
  systemPrompt: string,
  chunk: Array<{ id: string; name: string; donationType: string; vekalet: string; notes: string }>,
  jobId: string,
  chunkIndex: number,
): Promise<{ results: unknown[]; hadIssues: boolean }> {
  const rawResults = await callAiForDonations(systemPrompt, chunk, jobId, chunkIndex);
  let results = filterValidResults(rawResults);
  let hadIssues = false;

  let missing = findMissingDonations(chunk, results);

  if (missing.length > 0 && missing.length < chunk.length) {
    logger.warn(
      { jobId, chunk: chunkIndex + 1, sent: chunk.length, received: results.length, missing: missing.length },
      "AI returned incomplete results, retrying missing donations"
    );

    const retryRaw = await callAiForDonations(systemPrompt, missing, jobId, chunkIndex);
    results = deduplicateResults([...results, ...filterValidResults(retryRaw)]);

    hadIssues = true;
    missing = findMissingDonations(chunk, results);
    if (missing.length > 0) {
      logger.warn(
        { jobId, chunk: chunkIndex + 1, stillMissing: missing.length },
        "Some donations still missing after retry, filling with empty results"
      );
      for (const d of missing) {
        results.push({
          donationId: d.id,
          categories: [],
          requests: "",
          warnings: "AI bu bağışı sınıflandıramadı",
          summary: "",
        });
      }
    }
  } else if (missing.length === chunk.length) {
    hadIssues = true;
    logger.error({ jobId, chunk: chunkIndex + 1 }, "AI returned no valid results for chunk, splitting into smaller pieces");

    if (chunk.length > 5) {
      const mid = Math.ceil(chunk.length / 2);
      const [firstHalf, secondHalf] = [chunk.slice(0, mid), chunk.slice(mid)];
      const [r1, r2] = await Promise.all([
        callAiForDonations(systemPrompt, firstHalf, jobId, chunkIndex),
        callAiForDonations(systemPrompt, secondHalf, jobId, chunkIndex),
      ]);
      results = deduplicateResults([...filterValidResults(r1), ...filterValidResults(r2)]);
    }

    missing = findMissingDonations(chunk, results);
    for (const d of missing) {
      results.push({
        donationId: d.id,
        categories: [],
        requests: "",
        warnings: "AI işlemi başarısız oldu",
        summary: "",
      });
    }
  }

  return { results, hadIssues };
}

function filterValidResults(results: unknown[]): unknown[] {
  return results
    .filter(r =>
      r && typeof r === "object" && "donationId" in r && typeof (r as { donationId: unknown }).donationId === "string"
    )
    .map(r => {
      const obj = r as Record<string, unknown>;
      if (!Array.isArray(obj.categories)) {
        obj.categories = typeof obj.categories === "string" && obj.categories.trim()
          ? [obj.categories]
          : [];
      }
      const rawConf = obj.confidence;
      const parsed = typeof rawConf === "number" ? rawConf : typeof rawConf === "string" ? parseInt(rawConf, 10) : NaN;
      obj.confidence = (!isNaN(parsed) && parsed >= 1 && parsed <= 10) ? parsed : null;
      return obj;
    });
}

function deduplicateResults(results: unknown[]): unknown[] {
  const seen = new Set<string>();
  const deduped: unknown[] = [];
  for (const r of results) {
    if (r && typeof r === "object" && "donationId" in r) {
      const id = String((r as { donationId: string }).donationId);
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push(r);
      }
    }
  }
  return deduped;
}

async function processClassifyJob(
  jobId: string,
  donations: Array<{ id: string; name: string; donationType: string; vekalet: string; notes: string }>,
  chunkSize: number = CHUNK_SIZE,
) {
  const jobStartedAt = new Date();
  try {
    await db.update(aiJobsTable)
      .set({ status: AiJobStatus.PROCESSING, updatedAt: new Date() })
      .where(eq(aiJobsTable.id, jobId));

    const { prompt, categories } = await getAiSettings();
    const systemPrompt = prompt.replace("{{CATEGORIES}}", categories.join(", "));

    const allResults: unknown[] = [];
    const chunks: Array<{ id: string; name: string; donationType: string; vekalet: string; notes: string }>[] = [];
    for (let i = 0; i < donations.length; i += chunkSize) {
      chunks.push(donations.slice(i, i + chunkSize));
    }

    let processedCount = 0;
    let failedBatchCount = 0;

    for (let i = 0; i < chunks.length; i += PARALLEL_CHUNKS) {
      if (await isJobCancelledOrExpired(jobId)) {
        logger.info({ jobId }, "AI job cancelled or expired");
        return;
      }

      const parallelChunks = chunks.slice(i, i + PARALLEL_CHUNKS);
      const parallelResults = await Promise.all(
        parallelChunks.map((chunk, idx) => processOneChunk(systemPrompt, chunk, jobId, i + idx))
      );

      for (const chunkResult of parallelResults) {
        allResults.push(...chunkResult.results);
        if (chunkResult.hadIssues) failedBatchCount++;
      }

      processedCount += parallelChunks.reduce((sum, c) => sum + c.length, 0);
      processedCount = Math.min(processedCount, donations.length);

      logger.info(
        { jobId, iteration: Math.floor(i / PARALLEL_CHUNKS) + 1, processedCount, totalDonations: donations.length, allResultsCount: allResults.length, failedBatchCount },
        "AI batch iteration completed"
      );

      const resultPayload = { classifications: allResults, failedBatchCount, totalBatches: chunks.length };
      await db.update(aiJobsTable)
        .set({
          processedDonations: processedCount,
          result: JSON.stringify(resultPayload),
          updatedAt: new Date(),
        })
        .where(eq(aiJobsTable.id, jobId));
    }

    const inputIdSet = new Set(donations.map(d => d.id));
    const validatedResults: unknown[] = [];
    const seenIds = new Set<string>();
    for (const r of allResults) {
      if (r && typeof r === "object" && "donationId" in r) {
        const rid = String((r as { donationId: string }).donationId);
        if (inputIdSet.has(rid) && !seenIds.has(rid)) {
          seenIds.add(rid);
          validatedResults.push(r);
        }
      }
    }
    for (const d of donations) {
      if (!seenIds.has(d.id)) {
        validatedResults.push({
          donationId: d.id,
          categories: [],
          requests: "",
          warnings: "AI sonuç eşleşmesi bulunamadı",
          summary: "",
        });
      }
    }
    if (validatedResults.length !== allResults.length) {
      logger.warn(
        { jobId, inputCount: donations.length, rawResultCount: allResults.length, validatedCount: validatedResults.length },
        "AI result reconciliation adjusted counts"
      );
    }

    const resultPayload = { classifications: validatedResults, failedBatchCount, totalBatches: chunks.length };
    const updateResult = await db.update(aiJobsTable)
      .set({
        status: AiJobStatus.COMPLETED,
        processedDonations: donations.length,
        result: JSON.stringify(resultPayload),
        updatedAt: new Date(),
      })
      .where(and(eq(aiJobsTable.id, jobId), or(eq(aiJobsTable.status, AiJobStatus.PENDING), eq(aiJobsTable.status, AiJobStatus.PROCESSING))));

    if (updateResult.rowCount === 0) {
      logger.info({ jobId }, "AI job was cancelled before completion could be written");
      return;
    }

    logger.info({ jobId, count: donations.length, failedBatchCount }, "AI job completed");

    const warningCount = validatedResults.filter(r => {
      const obj = r as Record<string, unknown>;
      return typeof obj.warnings === "string" && obj.warnings.trim() !== "";
    }).length;
    const durationMs = Date.now() - jobStartedAt.getTime();

    try {
      const [jobRow] = await db.select({ kesimAlaniId: aiJobsTable.kesimAlaniId })
        .from(aiJobsTable).where(eq(aiJobsTable.id, jobId));
      let projectId: string | null = null;
      if (jobRow?.kesimAlaniId) {
        const [kaRow] = await db.select({ projectId: kesimAlanlariTable.projectId })
          .from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, jobRow.kesimAlaniId));
        projectId = kaRow?.projectId ?? null;
      }

      const confidenceScores = validatedResults
        .map(r => (r as Record<string, unknown>).confidence)
        .filter((c): c is number => typeof c === "number" && c >= 1 && c <= 10);
      const avgConfidenceScore = confidenceScores.length > 0
        ? Math.round((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) * 10) / 10
        : null;

      const catCounts = new Map<string, number>();
      for (const r of validatedResults) {
        const cats = (r as Record<string, unknown>).categories;
        if (Array.isArray(cats)) {
          for (const cat of cats) {
            if (typeof cat === "string") catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
          }
        }
      }
      const categoryDistribution = catCounts.size > 0
        ? JSON.stringify(Object.fromEntries([...catCounts.entries()].sort((a, b) => b[1] - a[1])))
        : null;

      await db.insert(aiJobLogsTable).values({
        id: crypto.randomUUID(),
        jobId,
        kesimAlaniId: jobRow?.kesimAlaniId ?? null,
        projectId,
        donationCount: donations.length,
        processedCount: validatedResults.length,
        warningCount,
        errorBatchCount: failedBatchCount,
        totalBatches: chunks.length,
        durationMs,
        avgConfidenceScore,
        categoryDistribution,
        status: "completed",
        startedAt: jobStartedAt,
        completedAt: new Date(),
      });
    } catch (logErr) {
      logger.warn({ err: logErr, jobId }, "Failed to write AI job log (non-fatal)");
    }
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
      const parsed = JSON.parse(job.result);
      if (parsed && typeof parsed === "object" && "classifications" in parsed) {
        response.results = parsed.classifications;
        response.failedBatchCount = parsed.failedBatchCount ?? 0;
        response.totalBatches = parsed.totalBatches ?? 0;
      } else if (Array.isArray(parsed)) {
        response.results = parsed;
        response.failedBatchCount = 0;
        response.totalBatches = 0;
      } else {
        response.results = [];
        response.failedBatchCount = 0;
        response.totalBatches = 0;
      }
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

router.get("/ai-notes/job-logs", asyncHandler(async (req, res) => {
  const { projectId, limit: limitStr } = req.query;
  const limit = Math.min(parseInt(String(limitStr || "50"), 10) || 50, 200);

  if (!projectId || typeof projectId !== "string") {
    res.status(400).json({ error: "projectId is required" });
    return;
  }

  const logs = await db.select().from(aiJobLogsTable)
    .where(eq(aiJobLogsTable.projectId, projectId))
    .orderBy(desc(aiJobLogsTable.completedAt))
    .limit(limit);

  res.json({ logs });
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
      categories: z.preprocess(
        (val) => {
          if (Array.isArray(val)) return val;
          if (typeof val === "string" && val.trim()) return [val];
          return [];
        },
        z.array(z.string()),
      ),
      confidence: z.number().int().min(1).max(10).optional().nullable(),
      warnings: z.string().optional().default(""),
      requests: z.string().optional().default(""),
      summary: z.string().optional().default(""),
    })).max(50000),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { classifications } = parsed.data;

  const LARGE_ANIMAL_KEYWORDS = ["büyükbaş", "sığır", "inek", "dana", "öküz", "boğa", "manda"];

  const donationIdList = classifications.map(c => c.donationId);
  const donationRows: { id: string; donationType: string }[] = [];
  for (let i = 0; i < donationIdList.length; i += TX_BATCH_SIZE) {
    const chunk = donationIdList.slice(i, i + TX_BATCH_SIZE);
    const rows = await db.select({ id: donationsTable.id, donationType: donationsTable.donationType })
      .from(donationsTable)
      .where(inArray(donationsTable.id, chunk));
    donationRows.push(...rows);
  }
  const donationTypeMap = new Map(donationRows.map(r => [r.id, r.donationType]));

  const enrichedClassifications = classifications.map(c => {
    const donationType = (donationTypeMap.get(c.donationId) || "").toLowerCase();
    const isLargeAnimal = LARGE_ANIMAL_KEYWORDS.some(kw => donationType.includes(kw));
    const hasSmallAnimalCat = c.categories.some(cat =>
      cat === "koç" || cat === "koyun"
    );

    let warnings = c.warnings;
    if (isLargeAnimal && hasSmallAnimalCat) {
      const detectedType = c.categories.includes("koç") ? "koç" : "koyun";
      const conflictMsg = `Not'ta belirtilen hayvan türü (${detectedType}) bağış türüyle çelişiyor.`;
      warnings = warnings ? `${warnings}\n${conflictMsg}` : conflictMsg;
    }

    return { ...c, warnings };
  });

  await db.transaction(async (tx) => {
    for (let i = 0; i < enrichedClassifications.length; i += TX_BATCH_SIZE) {
      const chunk = enrichedClassifications.slice(i, i + TX_BATCH_SIZE);
      for (const c of chunk) {
        await tx.update(donationsTable)
          .set({
            aiCategories: JSON.stringify(c.categories),
            aiWarnings: c.warnings || null,
            aiRequests: c.requests || null,
            aiSummary: c.summary || null,
            aiConfidenceScore: c.confidence ?? null,
          })
          .where(eq(donationsTable.id, c.donationId));
      }
    }
  }, { isolationLevel: "repeatable read" });

  // Retroactive sync: propagate ai_categories to transferred copies.
  // When a pool donation is classified, find non-pool donations in the same
  // project with the same vekalet and sync their ai_categories too.
  try {
    const classifiedIds = enrichedClassifications.map(c => c.donationId);
    const SYNC_CHUNK = 200;
    for (let i = 0; i < classifiedIds.length; i += SYNC_CHUNK) {
      const chunk = classifiedIds.slice(i, i + SYNC_CHUNK);
      const sourceDonations = await db.select({
        id: donationsTable.id,
        vekalet: donationsTable.vekalet,
        aiCategories: donationsTable.aiCategories,
        aiWarnings: donationsTable.aiWarnings,
        kesimAlaniId: donationsTable.kesimAlaniId,
      })
        .from(donationsTable)
        .innerJoin(kesimAlanlariTable, eq(donationsTable.kesimAlaniId, kesimAlanlariTable.id))
        .where(and(
          inArray(donationsTable.id, chunk),
          eq(kesimAlanlariTable.name, "__havuz__"),
          isNull(donationsTable.deletedAt),
          isNull(kesimAlanlariTable.deletedAt),
        ));

      if (sourceDonations.length === 0) continue;

      const poolKaIds = [...new Set(sourceDonations.map(d => d.kesimAlaniId))];
      const projectRows = await db.select({ id: kesimAlanlariTable.id, projectId: kesimAlanlariTable.projectId })
        .from(kesimAlanlariTable)
        .where(inArray(kesimAlanlariTable.id, poolKaIds));
      const projectIdByKaId = new Map(projectRows.map(r => [r.id, r.projectId]));

      for (const src of sourceDonations) {
        if (!src.vekalet || !src.aiCategories) continue;
        const projectId = projectIdByKaId.get(src.kesimAlaniId);
        if (!projectId) continue;

        const nonPoolKas = await db.select({ id: kesimAlanlariTable.id })
          .from(kesimAlanlariTable)
          .where(and(
            eq(kesimAlanlariTable.projectId, projectId),
            ne(kesimAlanlariTable.name, "__havuz__"),
            isNull(kesimAlanlariTable.deletedAt),
          ));

        if (nonPoolKas.length === 0) continue;
        const nonPoolKaIds = nonPoolKas.map(k => k.id);

        for (let j = 0; j < nonPoolKaIds.length; j += SYNC_CHUNK) {
          const kaChunk = nonPoolKaIds.slice(j, j + SYNC_CHUNK);
          await db.update(donationsTable)
            .set({
              aiCategories: src.aiCategories,
              aiWarnings: src.aiWarnings,
              updatedAt: new Date(),
            })
            .where(and(
              eq(donationsTable.vekalet, src.vekalet),
              inArray(donationsTable.kesimAlaniId, kaChunk),
              isNull(donationsTable.deletedAt),
            ));
        }
      }
    }
  } catch (syncErr) {
    logger.warn({ err: syncErr }, "ai-categories sync to transferred copies failed (non-fatal)");
  }

  res.json({ success: true, count: enrichedClassifications.length });
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
      for (const u of chunk) {
        const setFields: Record<string, string> = {};
        if (u.notes !== undefined) setFields.notes = u.notes;
        if (u.description !== undefined) setFields.description = u.description;
        if (Object.keys(setFields).length === 0) continue;
        await tx.update(donationsTable)
          .set(setFields)
          .where(eq(donationsTable.id, u.donationId));
      }
    }
  }, { isolationLevel: "repeatable read" });

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

setInterval(async () => {
  try {
    const now = new Date();
    const activeCondition = or(
      eq(aiJobsTable.status, AiJobStatus.PENDING),
      eq(aiJobsTable.status, AiJobStatus.PROCESSING),
    );
    const result = await db.update(aiJobsTable)
      .set({ status: AiJobStatus.FAILED, error: ERROR_MESSAGES.AI_JOB_EXPIRED, updatedAt: now })
      .where(and(activeCondition!, lt(aiJobsTable.expiresAt, now)));
    if (result.rowCount && result.rowCount > 0) {
      logger.info({ count: result.rowCount }, "[ai-jobs] Expired jobs marked as failed");
    }
  } catch (err) {
    logger.error({ err }, "[ai-jobs] Expiry check error");
  }
}, AI_JOB_EXPIRY_CHECK_INTERVAL_MS);

export { syncAiSettingsToDb };
export default router;
