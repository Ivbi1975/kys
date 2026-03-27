import { Router, type IRouter } from "express";
import { z } from "zod";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { NoteType, NoteStatus, ERROR_MESSAGES } from "../../lib/constants";
import { requireActiveKesimAlani } from "../../services/kesim-alani.service";
import {
  generateTrackingToken,
  getTrackingNotesByKA,
  getTrackingPage,
  getTrackingDelta,
  updateKesildiStatus,
  getDashboard,
  getTrackingNotes,
  createTrackingNote,
  approveEditRequest,
} from "../../services/tracking.service";

const kesildiSchema = z.object({
  kesildi: z.boolean(),
});

const router: IRouter = Router();

router.post("/kesim-alanlari/:id/generate-tracking-token", asyncHandler(async (req, res) => {
  const result = await generateTrackingToken(req.params.id);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ trackingToken: result.trackingToken });
}));

router.get("/tracking/:token", asyncHandler(async (req, res) => {
  const result = await getTrackingPage(req.params.token);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND });
    return;
  }
  res.json(result.data);
}));

router.get("/tracking/:token/delta", asyncHandler(async (req, res) => {
  const sinceParam = req.query.since as string | undefined;
  if (!sinceParam) {
    res.status(400).json({ error: ERROR_MESSAGES.SINCE_PARAM_REQUIRED });
    return;
  }
  const sinceDate = new Date(sinceParam);
  if (isNaN(sinceDate.getTime())) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_SINCE_DATE });
    return;
  }

  const result = await getTrackingDelta(req.params.token, sinceDate);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND });
    return;
  }
  res.json(result.data);
}));

router.put("/tracking/:token/group/:groupId/kesildi", asyncHandler(async (req, res) => {
  const parsed = kesildiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const result = await updateKesildiStatus(req.params.token, req.params.groupId, parsed.data.kesildi);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      not_found: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND,
      group_not_found: ERROR_MESSAGES.ANIMAL_GROUP_NOT_FOUND,
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json({ success: true, groupId: result.groupId, kesildi: result.kesildi, kesildiAt: result.kesildiAt });
  refreshProjectStats();
}));

router.get("/kesim-alanlari/:id/dashboard", asyncHandler(async (req, res) => {
  const kaCheck = await requireActiveKesimAlani(req.params.id);
  if (kaCheck.error) {
    res.status(kaCheck.status).json({ error: kaCheck.error });
    return;
  }
  const result = await getDashboard(req.params.id);
  res.json(result.data);
}));

router.get("/tracking/:token/notes", asyncHandler(async (req, res) => {
  const result = await getTrackingNotes(req.params.token);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND });
    return;
  }
  res.json(result.notes);
}));

router.post("/tracking/:token/notes", asyncHandler(async (req, res) => {
  const schema = z.object({
    animalGroupId: z.string().optional(),
    type: z.enum([NoteType.NOTE, NoteType.EDIT_REQUEST]),
    content: z.string().default(""),
    fieldName: z.string().optional(),
    oldValue: z.string().optional(),
    newValue: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const result = await createTrackingNote(req.params.token, parsed.data);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      not_found: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND,
      invalid_group: ERROR_MESSAGES.INVALID_ANIMAL_GROUP,
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.status(201).json(result.note);
}));

router.get("/kesim-alanlari/:id/tracking-notes", asyncHandler(async (req, res) => {
  const check = await requireActiveKesimAlani(req.params.id);
  if (check.error) { res.status(check.status).json({ error: check.error }); return; }

  const result = await getTrackingNotesByKA(req.params.id);
  res.json(result.notes);
}));

router.put("/kesim-alanlari/:id/tracking-notes/:noteId/status", asyncHandler(async (req, res) => {
  const { id, noteId } = req.params;
  const check = await requireActiveKesimAlani(id);
  if (check.error) { res.status(check.status).json({ error: check.error }); return; }

  const statusSchema = z.object({ status: z.enum([NoteStatus.PENDING, NoteStatus.APPROVED, NoteStatus.REJECTED]) });
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_STATUS });
    return;
  }

  await approveEditRequest(id, noteId, parsed.data.status);
  res.json({ success: true });
}));

export default router;
