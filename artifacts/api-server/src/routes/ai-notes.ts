import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable, donationsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";

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
  })).min(1).max(100),
});

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
    let results;
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        results = parsed;
      } else {
        results = parsed.results || parsed.data || parsed.classifications || parsed.donations || parsed.items || null;
        if (!results) {
          const firstArrayValue = Object.values(parsed).find(v => Array.isArray(v));
          results = firstArrayValue || [];
        }
      }
    } catch {
      results = [];
    }

    res.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("POST /ai-notes/classify error:", message);
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
      })),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
      return;
    }

    const { classifications } = parsed.data;

    await Promise.all(classifications.map(c =>
      db.update(donationsTable)
        .set({
          aiCategories: JSON.stringify(c.categories),
          aiWarnings: c.warnings,
        })
        .where(eq(donationsTable.id, c.donationId))
    ));

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
      })),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
      return;
    }

    const { updates } = parsed.data;

    await Promise.all(updates.map(u =>
      db.update(donationsTable)
        .set({ notes: u.notes })
        .where(eq(donationsTable.id, u.donationId))
    ));

    res.json({ success: true, count: updates.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("PUT /ai-notes/bulk-update error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
