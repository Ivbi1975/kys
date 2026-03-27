import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import {
  listPhotosByToken,
  getPhotoByToken,
  listPhotosByKA,
  getPhotoByKA,
  uploadPhoto,
  deletePhoto,
  getPhotoCounts,
  backfillThumbnails,
} from "../../services/photo.service";

const photoUploadSchema = z.object({
  data: z.string().min(1, "Fotoğraf verisi gerekli"),
  mimeType: z.string().optional().default("image/jpeg"),
});

const router: IRouter = Router();

router.get("/tracking/:token/group/:groupId/photos", asyncHandler(async (req, res) => {
  const result = await listPhotosByToken(req.params.token, req.params.groupId);
  if (!result.ok) {
    const msg = result.error === "ka_not_found" ? ERROR_MESSAGES.NOT_FOUND : ERROR_MESSAGES.GROUP_NOT_FOUND;
    res.status(result.status).json({ error: msg });
    return;
  }
  res.json(result.photos);
}));

router.get("/tracking/:token/group/:groupId/photos/:photoId", asyncHandler(async (req, res) => {
  const size = req.query.size as string | undefined;
  const result = await getPhotoByToken(req.params.token, req.params.groupId, req.params.photoId, size);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      ka_not_found: ERROR_MESSAGES.NOT_FOUND,
      group_not_found: ERROR_MESSAGES.GROUP_NOT_FOUND,
      photo_not_found: ERROR_MESSAGES.PHOTO_NOT_FOUND,
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Content-Length", result.buffer.length);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.send(result.buffer);
}));

router.post("/tracking/:token/group/:groupId/photos", asyncHandler(async (req, res) => {
  const parsed = photoUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await uploadPhoto({
    token: req.params.token,
    groupId: req.params.groupId,
    data: parsed.data.data,
    mimeType: parsed.data.mimeType,
  });
  if (!result.ok) {
    const errorMap: Record<string, { status: number; msg: string }> = {
      too_large: { status: 400, msg: ERROR_MESSAGES.PHOTO_TOO_LARGE },
      ka_not_found: { status: 404, msg: ERROR_MESSAGES.NOT_FOUND },
      group_not_found: { status: 404, msg: ERROR_MESSAGES.GROUP_NOT_FOUND },
      max_photos: { status: 400, msg: "Grup başına en fazla 5 fotoğraf yüklenebilir" },
    };
    const mapped = errorMap[result.error] || { status: 400, msg: result.error };
    res.status(mapped.status).json({ error: mapped.msg });
    return;
  }
  res.status(201).json(result.photo);
}));

router.delete("/tracking/:token/group/:groupId/photos/:photoId", asyncHandler(async (req, res) => {
  const result = await deletePhoto(req.params.token, req.params.groupId, req.params.photoId);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      ka_not_found: ERROR_MESSAGES.NOT_FOUND,
      group_not_found: ERROR_MESSAGES.GROUP_NOT_FOUND,
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json({ success: true });
}));

router.get("/kesim-alanlari/:id/group/:groupId/photos", asyncHandler(async (req, res) => {
  const result = await listPhotosByKA(req.params.id, req.params.groupId);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.GROUP_NOT_FOUND });
    return;
  }
  res.json(result.photos);
}));

router.get("/kesim-alanlari/:id/group/:groupId/photos/:photoId", asyncHandler(async (req, res) => {
  const size = req.query.size as string | undefined;
  const result = await getPhotoByKA(req.params.id, req.params.groupId, req.params.photoId, size);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      group_not_found: ERROR_MESSAGES.GROUP_NOT_FOUND,
      photo_not_found: ERROR_MESSAGES.PHOTO_NOT_FOUND,
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Content-Length", result.buffer.length);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.send(result.buffer);
}));

router.get("/kesim-alanlari/:id/photos/counts", asyncHandler(async (req, res) => {
  const result = await getPhotoCounts(req.params.id);
  if (!result.ok) return;
  res.json(result.counts);
}));

router.post("/photos/backfill-thumbnails", asyncHandler(async (req, res) => {
  const adminKey = (req.headers["x-admin-key"] || req.query.key) as string;
  const result = await backfillThumbnails(adminKey);
  if (!result.ok) {
    const msg = result.error === "admin_key_not_set" ? ERROR_MESSAGES.ADMIN_KEY_NOT_SET : ERROR_MESSAGES.UNAUTHORIZED;
    res.status(result.status).json({ error: msg });
    return;
  }
  res.json({ total: result.total, generated: result.generated, failed: result.failed });
}));

export default router;
