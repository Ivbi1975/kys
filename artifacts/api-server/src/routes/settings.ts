import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { cacheGet, cacheSet, cacheInvalidate } from "../lib/cache";

const LOGO_CACHE_KEY = "settings:logo";
const LOGO_TTL = 120_000;

const router: IRouter = Router();

const logoSchema = z.object({
  logo: z.string().min(1),
});

router.get("/settings/logo", async (_req, res) => {
  try {
    const cached = cacheGet<{ logo: string | null }>(LOGO_CACHE_KEY);
    if (cached) {
      res.json(cached);
      return;
    }

    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "logo"));
    const result = { logo: row?.value || null };
    cacheSet(LOGO_CACHE_KEY, result, LOGO_TTL);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("GET /settings/logo error:", message);
    res.status(500).json({ error: message });
  }
});

router.put("/settings/logo", async (req, res) => {
  const parsed = logoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "logo zorunlu", details: parsed.error.issues });
    return;
  }

  try {
    const { logo } = parsed.data;
    await db.insert(appSettingsTable).values({ key: "logo", value: logo })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: logo } });
    cacheInvalidate(LOGO_CACHE_KEY);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("PUT /settings/logo error:", message);
    res.status(500).json({ error: message });
  }
});

router.delete("/settings/logo", async (_req, res) => {
  try {
    await db.delete(appSettingsTable).where(eq(appSettingsTable.key, "logo"));
    cacheInvalidate(LOGO_CACHE_KEY);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("DELETE /settings/logo error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
