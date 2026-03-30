import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { cacheGet, cacheSet, cacheInvalidate } from "../lib/cache";
import { asyncHandler } from "../middleware/error-handler";

const LOGO_CACHE_KEY = "settings:logo";
const LOGO_TTL = 600_000;

const router: IRouter = Router();

const logoSchema = z.object({
  logo: z.string().min(1),
});

router.get("/settings/logo", asyncHandler(async (_req, res) => {
  const cached = cacheGet<{ logo: string | null }>(LOGO_CACHE_KEY);
  if (cached) {
    res.json(cached);
    return;
  }

  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "logo"));
  const result = { logo: row?.value || null };
  cacheSet(LOGO_CACHE_KEY, result, LOGO_TTL);
  res.json(result);
}));

router.put("/settings/logo", asyncHandler(async (req, res) => {
  const parsed = logoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "logo zorunlu", details: parsed.error.issues });
    return;
  }

  const { logo } = parsed.data;
  await db.insert(appSettingsTable).values({ key: "logo", value: logo })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: logo } });
  cacheInvalidate(LOGO_CACHE_KEY);
  res.json({ success: true });
}));

router.delete("/settings/logo", asyncHandler(async (_req, res) => {
  await db.delete(appSettingsTable).where(eq(appSettingsTable.key, "logo"));
  cacheInvalidate(LOGO_CACHE_KEY);
  res.json({ success: true });
}));

export default router;
