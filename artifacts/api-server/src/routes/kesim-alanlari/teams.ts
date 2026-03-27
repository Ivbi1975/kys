import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import {
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  assignTeamToGroup,
  assignTeamByToken,
} from "../../services/team.service";

const createTeamSchema = z.object({
  name: z.string().trim().min(1, "Ekip adı gerekli"),
  color: z.string().optional().default("#3b82f6"),
});

const updateTeamSchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: z.string().optional(),
});

const assignTeamSchema = z.object({
  teamId: z.string().nullable().optional(),
});

const router: IRouter = Router();

router.get("/kesim-alanlari/:id/teams", asyncHandler(async (req, res) => {
  const result = await listTeams(req.params.id);
  res.json(result.data);
}));

router.post("/kesim-alanlari/:id/teams", asyncHandler(async (req, res) => {
  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await createTeam(req.params.id, parsed.data.name, parsed.data.color);
  res.status(201).json(result.data);
}));

router.put("/kesim-alanlari/:id/teams/:teamId", asyncHandler(async (req, res) => {
  const parsed = updateTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await updateTeam(req.params.id, req.params.teamId, parsed.data);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.TEAM_NOT_FOUND });
    return;
  }
  res.json(result.data);
}));

router.delete("/kesim-alanlari/:id/teams/:teamId", asyncHandler(async (req, res) => {
  const result = await deleteTeam(req.params.id, req.params.teamId);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.TEAM_NOT_FOUND });
    return;
  }
  res.json({ success: true });
}));

router.put("/kesim-alanlari/:id/groups/:groupId/team", asyncHandler(async (req, res) => {
  const parsed = assignTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await assignTeamToGroup({
    kesimAlaniId: req.params.id,
    groupId: req.params.groupId,
    teamId: parsed.data.teamId,
  });
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      group_not_found: ERROR_MESSAGES.GROUP_NOT_FOUND,
      team_not_found: ERROR_MESSAGES.TEAM_NOT_FOUND,
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json({ success: true });
}));

router.put("/tracking/:token/group/:groupId/team", asyncHandler(async (req, res) => {
  const parsed = assignTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await assignTeamByToken(req.params.token, req.params.groupId, parsed.data.teamId);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      ka_not_found: ERROR_MESSAGES.NOT_FOUND,
      group_not_found: ERROR_MESSAGES.GROUP_NOT_FOUND,
      team_not_found: ERROR_MESSAGES.TEAM_NOT_FOUND,
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json({ success: true });
}));

export default router;
