import { Router, type IRouter } from "express";
import { z } from "zod";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import { detectConflicts, transferConflictDonation } from "../../services/conflict.service";

const transferSchema = z.object({
  donationId: z.string().min(1),
  sourceKesimAlaniId: z.string().min(1),
  targetKesimAlaniId: z.string().min(1),
  transferAnimal: z.boolean().optional().default(false),
  animalGroupId: z.string().optional(),
});

const router: IRouter = Router();

router.get("/catisma-tespiti", asyncHandler(async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const result = await detectConflicts(projectId);
  res.json({ conflicts: result.conflicts, totalConflicts: result.totalConflicts });
}));

router.post("/catisma-tespiti/transfer", asyncHandler(async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { sourceKesimAlaniId, targetKesimAlaniId } = parsed.data;
  if (sourceKesimAlaniId === targetKesimAlaniId) {
    res.status(400).json({ error: ERROR_MESSAGES.SAME_SOURCE_TARGET });
    return;
  }

  const result = await transferConflictDonation(parsed.data);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({ success: true, source: result.source, target: result.target });
  refreshProjectStats();
}));

export default router;
