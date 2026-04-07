import { Router, type IRouter } from "express";
import { z } from "zod";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import {
  listKesimAlanlari,
  listDeletedKesimAlanlari,
  getSingleKesimAlani,
  createKesimAlani,
  moveKesimAlani,
  updateKesimAlani,
  updateKesimAlaniDonationsChunked,
  deleteKesimAlani,
  restoreKesimAlani,
} from "../../services/core.service";
import { splitKesimAlani } from "../../services/split.service";

const donationPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional().default(""),
  description: z.string().optional().default(""),
  donationType: z.string().optional().default(""),
  shareCount: z.number().int().min(1).optional().default(1),
  vekalet: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  excluded: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
});

const animalGroupPayloadSchema = z.object({
  id: z.string().min(1),
  animalNo: z.number().int().optional().default(0),
  colorTag: z.string().optional().default(""),
  locked: z.boolean().optional().default(false),
  notes: z.string().optional().default(""),
  kesildi: z.boolean().optional(),
  donations: z.array(donationPayloadSchema).optional().default([]),
});

const createKesimAlaniSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().optional(),
  kesimListeId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  donations: z.array(donationPayloadSchema).optional().default([]),
  animalGroups: z.array(animalGroupPayloadSchema).optional().default([]),
});

const updateKesimAlaniSchema = z.object({
  name: z.string().min(1).optional(),
  kesimListeId: z.string().optional().nullable(),
  donations: z.array(donationPayloadSchema).optional(),
  animalGroups: z.array(animalGroupPayloadSchema).optional(),
});

const updateKesimAlaniChunkedSchema = z.object({
  donations: z.array(donationPayloadSchema),
  chunkIndex: z.number().int().min(0),
  totalChunks: z.number().int().min(1),
  sortOrderOffset: z.number().int().min(0).default(0),
  allDonationIds: z.array(z.string()).optional(),
  name: z.string().min(1).optional(),
  kesimListeId: z.string().optional().nullable(),
}).refine(data => data.chunkIndex < data.totalChunks, {
  message: "chunkIndex must be less than totalChunks",
});

const moveKesimAlaniSchema = z.object({
  projectId: z.string().nullable().optional(),
});

const router: IRouter = Router();

router.get("/kesim-alanlari", asyncHandler(async (req, res) => {
  const includeDeleted = req.query.includeDeleted === "true";
  const result = await listKesimAlanlari(includeDeleted);
  res.json(result.data);
}));

router.get("/kesim-alanlari/deleted", asyncHandler(async (_req, res) => {
  const result = await listDeletedKesimAlanlari();
  res.json(result.data);
}));

router.get("/kesim-alanlari/:id", asyncHandler(async (req, res) => {
  const result = await getSingleKesimAlani(req.params.id);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.NOT_FOUND });
    return;
  }
  res.json(result.data);
}));

router.post("/kesim-alanlari", asyncHandler(async (req, res) => {
  const parsed = createKesimAlaniSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await createKesimAlani(parsed.data);
  res.status(201).json(result.data);
  refreshProjectStats();
}));

router.put("/kesim-alanlari/:id/move", asyncHandler(async (req, res) => {
  const parsed = moveKesimAlaniSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await moveKesimAlani(req.params.id, parsed.data.projectId);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      not_found: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND,
      project_not_found: ERROR_MESSAGES.TARGET_PROJECT_NOT_FOUND,
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json(result.data);
  refreshProjectStats();
}));

router.put("/kesim-alanlari/:id", asyncHandler(async (req, res) => {
  const parsed = updateKesimAlaniSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await updateKesimAlani(req.params.id, parsed.data);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.data);
  refreshProjectStats();
}));

router.put("/kesim-alanlari/:id/update-chunked", asyncHandler(async (req, res) => {
  const parsed = updateKesimAlaniChunkedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const { donations, chunkIndex, totalChunks, sortOrderOffset, allDonationIds, name, kesimListeId } = parsed.data;
  const metaUpdates = (name !== undefined || kesimListeId !== undefined) ? { name, kesimListeId } : undefined;
  const result = await updateKesimAlaniDonationsChunked(
    req.params.id,
    donations,
    chunkIndex,
    totalChunks,
    sortOrderOffset,
    allDonationIds,
    metaUpdates,
  );
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  const { ok: _ok, ...responseData } = result;
  res.json(responseData);
  if (chunkIndex === totalChunks - 1) {
    refreshProjectStats();
  }
}));

router.delete("/kesim-alanlari/:id", asyncHandler(async (req, res) => {
  const permanent = req.query.permanent === "true";
  const result = await deleteKesimAlani(req.params.id, permanent);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }
  res.json({ success: true });
  refreshProjectStats();
}));

router.post("/kesim-alanlari/:id/restore", asyncHandler(async (req, res) => {
  const result = await restoreKesimAlani(req.params.id);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      not_found: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND,
      already_active: ERROR_MESSAGES.ALREADY_ACTIVE,
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json(result.data);
  refreshProjectStats();
}));

const splitSchema = z.object({
  targets: z.array(z.object({
    name: z.string().min(1),
    kesimListeId: z.string().optional().default(""),
    hayvanSayisi: z.number().int().min(1),
  })).min(2),
});

router.post("/kesim-alanlari/:id/split", asyncHandler(async (req, res) => {
  const parsed = splitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await splitKesimAlani(req.params.id, parsed.data.targets);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      not_found: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND,
      already_split: "Bu kesim alanı zaten parçalanmış",
      is_child: "Alt listeler tekrar parçalanamaz",
      count_mismatch: "Toplam hayvan sayısı kapasite ile uyuşmuyor",
      min_two_targets: "En az 2 alt listeye parçalanmalı",
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json({ parent: result.parent, children: result.children });
  refreshProjectStats();
}));

export default router;
