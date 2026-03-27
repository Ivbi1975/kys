import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  animalGroupsTable,
  animalGroupPhotosTable,
} from "@workspace/db/schema";
import { eq, inArray, isNull, and } from "drizzle-orm";
import crypto from "crypto";
import { serviceError, serviceOk, type ServiceResult } from "./result";
import { generateThumbnail } from "../lib/thumbnail";

const MAX_PHOTOS_PER_GROUP = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

async function resolveGroupByToken(token: string, groupId: string) {
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka) return serviceError("ka_not_found", 404);

  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
  if (!group) return serviceError("group_not_found", 404);

  return serviceOk({ ka, group });
}

async function resolveGroupByKA(kesimAlaniId: string, groupId: string) {
  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, kesimAlaniId)));
  if (!group) return serviceError("group_not_found", 404);
  return serviceOk({ group });
}

type PhotoMeta = { id: string; mimeType: string; createdAt: Date };

export async function listPhotosByToken(token: string, groupId: string): Promise<ServiceResult<{ photos: PhotoMeta[] }>> {
  const resolved = await resolveGroupByToken(token, groupId);
  if (!resolved.ok) return resolved;

  const photos = await db.select({
    id: animalGroupPhotosTable.id,
    mimeType: animalGroupPhotosTable.mimeType,
    createdAt: animalGroupPhotosTable.createdAt,
  }).from(animalGroupPhotosTable)
    .where(eq(animalGroupPhotosTable.animalGroupId, groupId))
    .orderBy(animalGroupPhotosTable.createdAt);

  return serviceOk({ photos });
}

export async function getPhotoByToken(token: string, groupId: string, photoId: string, size?: string): Promise<ServiceResult<{ buffer: Buffer; contentType: string }>> {
  const resolved = await resolveGroupByToken(token, groupId);
  if (!resolved.ok) return resolved;

  return getPhotoData(groupId, photoId, size);
}

export async function listPhotosByKA(kesimAlaniId: string, groupId: string): Promise<ServiceResult<{ photos: PhotoMeta[] }>> {
  const resolved = await resolveGroupByKA(kesimAlaniId, groupId);
  if (!resolved.ok) return resolved;

  const photos = await db.select({
    id: animalGroupPhotosTable.id,
    mimeType: animalGroupPhotosTable.mimeType,
    createdAt: animalGroupPhotosTable.createdAt,
  }).from(animalGroupPhotosTable)
    .where(eq(animalGroupPhotosTable.animalGroupId, groupId))
    .orderBy(animalGroupPhotosTable.createdAt);

  return serviceOk({ photos });
}

export async function getPhotoByKA(kesimAlaniId: string, groupId: string, photoId: string, size?: string): Promise<ServiceResult<{ buffer: Buffer; contentType: string }>> {
  const resolved = await resolveGroupByKA(kesimAlaniId, groupId);
  if (!resolved.ok) return resolved;

  return getPhotoData(groupId, photoId, size);
}

async function getPhotoData(groupId: string, photoId: string, size?: string): Promise<ServiceResult<{ buffer: Buffer; contentType: string }>> {
  const [photo] = await db.select({
    id: animalGroupPhotosTable.id,
    thumbnail: animalGroupPhotosTable.thumbnail,
    data: animalGroupPhotosTable.data,
    mimeType: animalGroupPhotosTable.mimeType,
  }).from(animalGroupPhotosTable)
    .where(and(eq(animalGroupPhotosTable.id, photoId), eq(animalGroupPhotosTable.animalGroupId, groupId)));
  if (!photo) return serviceError("photo_not_found", 404);

  const sourceData = (size === "thumb" && photo.thumbnail) ? photo.thumbnail : photo.data;
  const base64Data = sourceData.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const contentType = (size === "thumb" && photo.thumbnail) ? "image/jpeg" : photo.mimeType;

  return serviceOk({ buffer, contentType });
}

export async function uploadPhoto(params: {
  token: string;
  groupId: string;
  data: string;
  mimeType: string;
}): Promise<ServiceResult<{ photo: { id: string; mimeType: string; createdAt: string } }>> {
  const { token, groupId, data, mimeType } = params;

  const validMimes = ["image/jpeg", "image/png", "image/webp"];
  const mime = validMimes.includes(mimeType) ? mimeType : "image/jpeg";

  const base64Part = data.replace(/^data:[^;]+;base64,/, "");
  const sizeBytes = Math.ceil(base64Part.length * 3 / 4);
  if (sizeBytes > MAX_PHOTO_SIZE) return serviceError("too_large", 400);

  const resolved = await resolveGroupByToken(token, groupId);
  if (!resolved.ok) return resolved;

  const existingPhotos = await db.select({ id: animalGroupPhotosTable.id })
    .from(animalGroupPhotosTable)
    .where(eq(animalGroupPhotosTable.animalGroupId, groupId));
  if (existingPhotos.length >= MAX_PHOTOS_PER_GROUP) {
    return serviceError("max_photos", 400);
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

  return serviceOk({ photo: { id: photoId, mimeType: mime, createdAt: photoCreatedAt.toISOString() } });
}

export async function deletePhoto(token: string, groupId: string, photoId: string): Promise<ServiceResult<{ success: true }>> {
  const resolved = await resolveGroupByToken(token, groupId);
  if (!resolved.ok) return resolved;

  await db.delete(animalGroupPhotosTable)
    .where(and(eq(animalGroupPhotosTable.id, photoId), eq(animalGroupPhotosTable.animalGroupId, groupId)));

  return serviceOk({ success: true as const });
}

export async function getPhotoCounts(kesimAlaniId: string) {
  const groups = await db.select({ id: animalGroupsTable.id })
    .from(animalGroupsTable)
    .where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId));
  const groupIds = groups.map(g => g.id);
  if (groupIds.length === 0) return serviceOk({ counts: {} as Record<string, number> });

  const photos = await db.select({
    animalGroupId: animalGroupPhotosTable.animalGroupId,
    id: animalGroupPhotosTable.id,
  }).from(animalGroupPhotosTable)
    .where(inArray(animalGroupPhotosTable.animalGroupId, groupIds));

  const counts: Record<string, number> = {};
  for (const p of photos) {
    counts[p.animalGroupId] = (counts[p.animalGroupId] || 0) + 1;
  }

  return serviceOk({ counts });
}

export async function backfillThumbnails(adminKey: string) {
  const expectedKey = process.env["ADMIN_KEY"];
  if (!expectedKey) return serviceError("admin_key_not_set", 403);
  if (adminKey !== expectedKey) return serviceError("unauthorized", 403);

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

  return serviceOk({ total: photos.length, generated, failed });
}
