import { Router, type IRouter } from "express";
import { z } from "zod";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import {
  moveDonations,
  moveAnimalGroup,
  saveDonationTransfers,
  getTransferLog,
  getPendingEditRequests,
} from "../../services/transfer.service";

const router: IRouter = Router();

router.post("/kesim-alanlari/move-donations", asyncHandler(async (req, res) => {
  const parsed = z.object({
    donationIds: z.array(z.string()).min(1),
    sourceKesimAlaniId: z.string(),
    targetKesimAlaniId: z.string(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { sourceKesimAlaniId, targetKesimAlaniId } = parsed.data;
  if (sourceKesimAlaniId === targetKesimAlaniId) {
    res.status(400).json({ error: ERROR_MESSAGES.SAME_SOURCE_TARGET });
    return;
  }

  const result = await moveDonations(parsed.data);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      source_not_found: ERROR_MESSAGES.SOURCE_KESIM_NOT_FOUND,
      target_not_found: ERROR_MESSAGES.TARGET_KESIM_NOT_FOUND,
      different_project: ERROR_MESSAGES.MUST_BE_SAME_PROJECT,
      no_valid_donors: ERROR_MESSAGES.NO_VALID_DONORS,
      all_donors_in_locked_groups: "Tüm bağışçılar kilitli veya kesilmiş gruplara ait. Transfer yapılamaz.",
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }

  res.json({ success: true, count: result.count, skipped: result.skipped, movedIds: result.movedIds });
  refreshProjectStats();
}));

router.post("/kesim-alanlari/move-animal-group", asyncHandler(async (req, res) => {
  const parsed = z.object({
    animalGroupId: z.string().min(1),
    sourceKesimAlaniId: z.string().min(1),
    targetKesimAlaniId: z.string().min(1),
    lastUpdatedAt: z.string().optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { sourceKesimAlaniId, targetKesimAlaniId } = parsed.data;
  if (sourceKesimAlaniId === targetKesimAlaniId) {
    res.status(400).json({ error: ERROR_MESSAGES.SAME_SOURCE_TARGET });
    return;
  }

  try {
    const result = await moveAnimalGroup(parsed.data);
    if (!result.ok) {
      const errorMap: Record<string, string> = {
        source_not_found: ERROR_MESSAGES.SOURCE_KESIM_NOT_FOUND,
        target_not_found: ERROR_MESSAGES.TARGET_KESIM_NOT_FOUND,
        different_project: ERROR_MESSAGES.MUST_BE_SAME_PROJECT,
        group_not_in_source: ERROR_MESSAGES.GROUP_NOT_IN_SOURCE,
        group_locked: ERROR_MESSAGES.GROUP_LOCKED,
        group_kesildi: ERROR_MESSAGES.GROUP_KESILDI,
      };
      res.status(result.status).json({ error: errorMap[result.error] || result.error });
      return;
    }

    res.json({ success: true, animalGroupId: result.animalGroupId, newAnimalNo: result.newAnimalNo });
  } catch (err: any) {
    if (err?.message === "concurrent_modification") {
      res.status(409).json({ error: "Bu hayvan grubu başka biri tarafından değiştirilmiş. Lütfen sayfayı yenileyip tekrar deneyin." });
      return;
    }
    throw err;
  }
  refreshProjectStats();
}));

router.post("/donation-transfers", asyncHandler(async (req, res) => {
  const bodySchema = z.object({
    entries: z.array(z.object({
      id: z.string().min(1),
      projectId: z.string().min(1),
      donationId: z.string(),
      donorName: z.string(),
      donorDescription: z.string(),
      fromKesimAlaniId: z.string(),
      fromKesimAlaniName: z.string(),
      toKesimAlaniId: z.string(),
      toKesimAlaniName: z.string(),
      removedFromSource: z.boolean(),
      shareCount: z.number().int().min(1),
      transferType: z.enum(["donation", "animalGroup"]).default("donation"),
      animalGroupId: z.string().optional(),
      animalNo: z.number().int().optional(),
      createdAt: z.string(),
    })).min(1),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid entries", details: parsed.error.issues });
    return;
  }

  const result = await saveDonationTransfers(parsed.data.entries);
  res.json({ success: true, count: result.count });
}));

router.get("/projects/:projectId/transfer-log", asyncHandler(async (req, res) => {
  const result = await getTransferLog(req.params.projectId);
  res.json(result.data);
}));

router.get("/projects/:projectId/pending-edit-requests", asyncHandler(async (req, res) => {
  const result = await getPendingEditRequests(req.params.projectId);
  res.json({ count: result.count, requests: result.requests });
}));

export default router;
