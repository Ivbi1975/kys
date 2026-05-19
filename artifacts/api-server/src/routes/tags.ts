import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customTagsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { cacheGet, cacheSet, cacheInvalidate } from "../lib/cache";
import { asyncHandler } from "../middleware/error-handler";
import { ERROR_MESSAGES } from "../lib/constants";

const TAGS_CACHE_KEY = "tags:list";
const TAGS_TTL = 300_000;

const router: IRouter = Router();

const createTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().optional(),
  vekaletId: z.string().nullish(),
  notes: z.string().nullish(),
  aiNotes: z.string().nullish(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  vekaletId: z.string().nullish(),
  notes: z.string().nullish(),
  aiNotes: z.string().nullish(),
});

router.get("/tags", asyncHandler(async (_req, res) => {
  const cached = cacheGet<unknown[]>(TAGS_CACHE_KEY);
  if (cached) {
    res.json(cached);
    return;
  }

  const tags = await db.select().from(customTagsTable);
  const collator = new Intl.Collator("tr", { sensitivity: "base" });
  tags.sort((a, b) => collator.compare(a.name, b.name));
  cacheSet(TAGS_CACHE_KEY, tags, TAGS_TTL);
  res.json(tags);
}));

router.post("/tags", asyncHandler(async (req, res) => {
  const parsed = createTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id, name, color, vekaletId, notes, aiNotes } = parsed.data;
  await db.insert(customTagsTable).values({
    id,
    name,
    color: color || "#3b82f6",
    vekaletId: vekaletId ?? null,
    notes: notes ?? null,
    aiNotes: aiNotes ?? null,
  });
  cacheInvalidate(TAGS_CACHE_KEY);
  const [tag] = await db.select().from(customTagsTable).where(eq(customTagsTable.id, id));
  res.status(201).json(tag);
}));

router.put("/tags/:id", asyncHandler(async (req, res) => {
  const parsed = updateTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id } = req.params;
  const updates: {
    name?: string;
    color?: string;
    vekaletId?: string | null;
    notes?: string | null;
    aiNotes?: string | null;
  } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  if ("vekaletId" in parsed.data) updates.vekaletId = parsed.data.vekaletId ?? null;
  if ("notes" in parsed.data) updates.notes = parsed.data.notes ?? null;
  if ("aiNotes" in parsed.data) updates.aiNotes = parsed.data.aiNotes ?? null;

  await db.update(customTagsTable).set(updates).where(eq(customTagsTable.id, id));
  cacheInvalidate(TAGS_CACHE_KEY);
  const [tag] = await db.select().from(customTagsTable).where(eq(customTagsTable.id, id));
  if (!tag) {
    res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND });
    return;
  }
  res.json(tag);
}));

router.delete("/tags/:id", asyncHandler(async (req, res) => {
  await db.delete(customTagsTable).where(eq(customTagsTable.id, req.params.id));
  cacheInvalidate(TAGS_CACHE_KEY);
  res.json({ success: true });
}));

export default router;
