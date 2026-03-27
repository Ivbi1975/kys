import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  animalGroupsTable,
  animalGroupPhotosTable,
} from "@workspace/db/schema";
import { count, asc } from "drizzle-orm";
import { eq, inArray, isNull, and } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import { generateThumbnail } from "../../lib/thumbnail";

const photoUploadSchema = z.object({
  data: z.string().min(1, "Fotoğraf verisi gerekli"),
  mimeType: z.string().optional().default("image/jpeg"),
});

const MAX_PHOTOS_PER_GROUP = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const router: IRouter = Router();

router.get("/tracking/:token/group/:groupId/photos", asyncHandler(async (req, res) => {
  const { token, groupId } = req.params;
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka) { res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND }); return; }

  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
  if (!group) { res.status(404).json({ error: ERROR_MESSAGES.GROUP_NOT_FOUND }); return; }

  const photos = await db.select({
    id: animalGroupPhotosTable.id,
    mimeType: animalGroupPhotosTable.mimeType,
    createdAt: animalGroupPhotosTable.createdAt,
  }).from(animalGroupPhotosTable)
    .where(eq(animalGroupPhotosTable.animalGroupId, groupId))
    .orderBy(animalGroupPhotosTable.createdAt);

  res.json(photos);
}));

router.get("/tracking/:token/group/:groupId/photos/:photoId", asyncHandler(async (req, res) => {
  const { token, groupId, photoId } = req.params;
  const size = req.query.size as string | undefined;
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka) { res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND }); return; }

  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
  if (!group) { res.status(404).json({ error: ERROR_MESSAGES.GROUP_NOT_FOUND }); return; }

  const [photo] = await db.select({
    id: animalGroupPhotosTable.id,
    thumbnail: animalGroupPhotosTable.thumbnail,
    data: animalGroupPhotosTable.data,
    mimeType: animalGroupPhotosTable.mimeType,
  }).from(animalGroupPhotosTable)
    .where(and(eq(animalGroupPhotosTable.id, photoId), eq(animalGroupPhotosTable.animalGroupId, groupId)));
  if (!photo) { res.status(404).json({ error: ERROR_MESSAGES.PHOTO_NOT_FOUND }); return; }

  const sourceData = (size === "thumb" && photo.thumbnail) ? photo.thumbnail : photo.data;
  const base64Data = sourceData.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const contentType = (size === "thumb" && photo.thumbnail) ? "image/jpeg" : photo.mimeType;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.send(buffer);
}));

router.post("/tracking/:token/group/:groupId/photos", asyncHandler(async (req, res) => {
  const parsed = photoUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { token, groupId } = req.params;
  const { data, mimeType } = parsed.data;

  const validMimes = ["image/jpeg", "image/png", "image/webp"];
  const mime = validMimes.includes(mimeType) ? mimeType : "image/jpeg";

  const base64Part = data.replace(/^data:[^;]+;base64,/, "");
  const sizeBytes = Math.ceil(base64Part.length * 3 / 4);
  if (sizeBytes > MAX_PHOTO_SIZE) {
    res.status(400).json({ error: ERROR_MESSAGES.PHOTO_TOO_LARGE }); return;
  }

  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka) { res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND }); return; }

  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
  if (!group) { res.status(404).json({ error: ERROR_MESSAGES.GROUP_NOT_FOUND }); return; }

  const existingPhotos = await db.select({ id: animalGroupPhotosTable.id })
    .from(animalGroupPhotosTable)
    .where(eq(animalGroupPhotosTable.animalGroupId, groupId));
  if (existingPhotos.length >= MAX_PHOTOS_PER_GROUP) {
    res.status(400).json({ error: `Grup başına en fazla ${MAX_PHOTOS_PER_GROUP} fotoğraf yüklenebilir` }); return;
  }

  const photoId = crypto.randomUUID();
  const photoCreatedAt = new Date();
  const fullData = data.startsWith("data:") ? data : `data:${mime};base64,${data}`;

  let thumbnail: string | null = null;
  try {
    thumbnail = await generateThumbnail(fullData);
  } catch (e) {
    console.warn("Thumbnail generation failed, storing without thumbnail:", e);
  }

  await db.insert(animalGroupPhotosTable).values({
    id: photoId,
    animalGroupId: groupId,
    data: fullData,
    thumbnail,
    mimeType: mime,
    createdAt: photoCreatedAt,
  });

  res.status(201).json({ id: photoId, mimeType: mime, createdAt: photoCreatedAt.toISOString() });
}));

router.delete("/tracking/:token/group/:groupId/photos/:photoId", asyncHandler(async (req, res) => {
  const { token, groupId, photoId } = req.params;
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka) { res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND }); return; }

  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
  if (!group) { res.status(404).json({ error: ERROR_MESSAGES.GROUP_NOT_FOUND }); return; }

  await db.delete(animalGroupPhotosTable)
    .where(and(eq(animalGroupPhotosTable.id, photoId), eq(animalGroupPhotosTable.animalGroupId, groupId)));

  res.json({ success: true });
}));

router.get("/kesim-alanlari/:id/group/:groupId/photos", asyncHandler(async (req, res) => {
  const { id, groupId } = req.params;
  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, id)));
  if (!group) { res.status(404).json({ error: ERROR_MESSAGES.GROUP_NOT_FOUND }); return; }

  const photos = await db.select({
    id: animalGroupPhotosTable.id,
    mimeType: animalGroupPhotosTable.mimeType,
    createdAt: animalGroupPhotosTable.createdAt,
  }).from(animalGroupPhotosTable)
    .where(eq(animalGroupPhotosTable.animalGroupId, groupId))
    .orderBy(animalGroupPhotosTable.createdAt);

  res.json(photos);
}));

router.get("/kesim-alanlari/:id/group/:groupId/photos/:photoId", asyncHandler(async (req, res) => {
  const { id, groupId, photoId } = req.params;
  const size = req.query.size as string | undefined;
  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, id)));
  if (!group) { res.status(404).json({ error: ERROR_MESSAGES.GROUP_NOT_FOUND }); return; }

  const [photo] = await db.select({
    id: animalGroupPhotosTable.id,
    thumbnail: animalGroupPhotosTable.thumbnail,
    data: animalGroupPhotosTable.data,
    mimeType: animalGroupPhotosTable.mimeType,
  }).from(animalGroupPhotosTable)
    .where(and(eq(animalGroupPhotosTable.id, photoId), eq(animalGroupPhotosTable.animalGroupId, groupId)));
  if (!photo) { res.status(404).json({ error: ERROR_MESSAGES.PHOTO_NOT_FOUND }); return; }

  const sourceData = (size === "thumb" && photo.thumbnail) ? photo.thumbnail : photo.data;
  const base64Data = sourceData.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const contentType = (size === "thumb" && photo.thumbnail) ? "image/jpeg" : photo.mimeType;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.send(buffer);
}));

router.get("/kesim-alanlari/:id/photos/counts", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const groups = await db.select({ id: animalGroupsTable.id })
    .from(animalGroupsTable)
    .where(eq(animalGroupsTable.kesimAlaniId, id));
  const groupIds = groups.map(g => g.id);
  if (groupIds.length === 0) { res.json({}); return; }

  const photos = await db.select({
    animalGroupId: animalGroupPhotosTable.animalGroupId,
    id: animalGroupPhotosTable.id,
  }).from(animalGroupPhotosTable)
    .where(inArray(animalGroupPhotosTable.animalGroupId, groupIds));

  const counts: Record<string, number> = {};
  for (const p of photos) {
    counts[p.animalGroupId] = (counts[p.animalGroupId] || 0) + 1;
  }
  res.json(counts);
}));

router.post("/photos/backfill-thumbnails", asyncHandler(async (req, res) => {
  const expectedKey = process.env["ADMIN_KEY"];
  if (!expectedKey) {
    res.status(403).json({ error: ERROR_MESSAGES.ADMIN_KEY_NOT_SET });
    return;
  }
  const adminKey = req.headers["x-admin-key"] || req.query.key;
  if (!adminKey || adminKey !== expectedKey) {
    res.status(403).json({ error: ERROR_MESSAGES.UNAUTHORIZED });
    return;
  }

  const photos = await db.select({
    id: animalGroupPhotosTable.id,
    data: animalGroupPhotosTable.data,
  }).from(animalGroupPhotosTable)
    .where(isNull(animalGroupPhotosTable.thumbnail));

  let generated = 0;
  let failed = 0;
  for (const photo of photos) {
    try {
      const thumb = await generateThumbnail(photo.data);
      await db.update(animalGroupPhotosTable)
        .set({ thumbnail: thumb })
        .where(eq(animalGroupPhotosTable.id, photo.id));
      generated++;
    } catch {
      failed++;
    }
  }

  res.json({ total: photos.length, generated, failed });
}));

export default router;
