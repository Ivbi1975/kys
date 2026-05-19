import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customTagsTable, tagCategoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { cacheGet, cacheSet, cacheInvalidate } from "../lib/cache";
import { asyncHandler } from "../middleware/error-handler";
import { ERROR_MESSAGES } from "../lib/constants";

const TAGS_CACHE_KEY = "tags:list";
const CATEGORIES_CACHE_KEY = "tag-categories:list";
const TAGS_TTL = 300_000;

const router: IRouter = Router();

const createTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().optional(),
  vekaletId: z.string().nullish(),
  notes: z.string().nullish(),
  aiNotes: z.string().nullish(),
  categoryId: z.string().nullish(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  vekaletId: z.string().nullish(),
  notes: z.string().nullish(),
  aiNotes: z.string().nullish(),
  categoryId: z.string().nullish(),
});

const createCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

router.get("/tags", asyncHandler(async (_req, res) => {
  const cached = cacheGet<unknown[]>(TAGS_CACHE_KEY);
  if (cached) {
    res.json(cached);
    return;
  }

  const tags = await db.select({
    id: customTagsTable.id,
    name: customTagsTable.name,
    color: customTagsTable.color,
    vekaletId: customTagsTable.vekaletId,
    notes: customTagsTable.notes,
    aiNotes: customTagsTable.aiNotes,
    categoryId: customTagsTable.categoryId,
  }).from(customTagsTable);
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

  const { id, name, color, vekaletId, notes, aiNotes, categoryId } = parsed.data;
  await db.insert(customTagsTable).values({
    id,
    name,
    color: color || "#3b82f6",
    vekaletId: vekaletId ?? null,
    notes: notes ?? null,
    aiNotes: aiNotes ?? null,
    categoryId: categoryId ?? null,
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
    categoryId?: string | null;
  } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  if ("vekaletId" in parsed.data) updates.vekaletId = parsed.data.vekaletId ?? null;
  if ("notes" in parsed.data) updates.notes = parsed.data.notes ?? null;
  if ("aiNotes" in parsed.data) updates.aiNotes = parsed.data.aiNotes ?? null;
  if ("categoryId" in parsed.data) updates.categoryId = parsed.data.categoryId ?? null;

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

router.get("/tag-categories", asyncHandler(async (_req, res) => {
  const cached = cacheGet<unknown[]>(CATEGORIES_CACHE_KEY);
  if (cached) {
    res.json(cached);
    return;
  }

  const categories = await db.select().from(tagCategoriesTable).orderBy(tagCategoriesTable.sortOrder);
  cacheSet(CATEGORIES_CACHE_KEY, categories, TAGS_TTL);
  res.json(categories);
}));

router.post("/tag-categories", asyncHandler(async (req, res) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id, name, sortOrder } = parsed.data;
  await db.insert(tagCategoriesTable).values({
    id,
    name,
    sortOrder: sortOrder ?? 0,
  });
  cacheInvalidate(CATEGORIES_CACHE_KEY);
  const [category] = await db.select().from(tagCategoriesTable).where(eq(tagCategoriesTable.id, id));
  res.status(201).json(category);
}));

router.put("/tag-categories/:id", asyncHandler(async (req, res) => {
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id } = req.params;
  const updates: { name?: string; sortOrder?: number } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;

  await db.update(tagCategoriesTable).set(updates).where(eq(tagCategoriesTable.id, id));
  cacheInvalidate(CATEGORIES_CACHE_KEY);
  const [category] = await db.select().from(tagCategoriesTable).where(eq(tagCategoriesTable.id, id));
  if (!category) {
    res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND });
    return;
  }
  res.json(category);
}));

router.delete("/tag-categories/:id", asyncHandler(async (req, res) => {
  await db.delete(tagCategoriesTable).where(eq(tagCategoriesTable.id, req.params.id));
  cacheInvalidate(CATEGORIES_CACHE_KEY);
  cacheInvalidate(TAGS_CACHE_KEY);
  res.json({ success: true });
}));

export default router;
