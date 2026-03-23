import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customTagsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const createTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
});

router.get("/tags", async (_req, res) => {
  try {
    const tags = await db.select().from(customTagsTable);
    res.json(tags);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("GET /tags error:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/tags", async (req, res) => {
  const parsed = createTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  try {
    const { id, name, color } = parsed.data;
    await db.insert(customTagsTable).values({ id, name, color: color || "#3b82f6" });
    const [tag] = await db.select().from(customTagsTable).where(eq(customTagsTable.id, id));
    res.status(201).json(tag);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("POST /tags error:", message);
    res.status(500).json({ error: message });
  }
});

router.put("/tags/:id", async (req, res) => {
  const parsed = updateTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  try {
    const { id } = req.params;
    const updates: { name?: string; color?: string } = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.color !== undefined) updates.color = parsed.data.color;
    await db.update(customTagsTable).set(updates).where(eq(customTagsTable.id, id));
    const [tag] = await db.select().from(customTagsTable).where(eq(customTagsTable.id, id));
    if (!tag) {
      res.status(404).json({ error: "Bulunamadı" });
      return;
    }
    res.json(tag);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`PUT /tags/${req.params.id} error:`, message);
    res.status(500).json({ error: message });
  }
});

router.delete("/tags/:id", async (req, res) => {
  try {
    await db.delete(customTagsTable).where(eq(customTagsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error(`DELETE /tags/${req.params.id} error:`, message);
    res.status(500).json({ error: message });
  }
});

export default router;
