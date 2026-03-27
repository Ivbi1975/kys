import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  animalGroupsTable,
  teamsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";

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
  const { id } = req.params;
  const teams = await db.select().from(teamsTable)
    .where(eq(teamsTable.kesimAlaniId, id));
  res.json(teams.map(t => ({ id: t.id, name: t.name, color: t.color })));
}));

router.post("/kesim-alanlari/:id/teams", asyncHandler(async (req, res) => {
  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id } = req.params;
  const { name, color } = parsed.data;
  const teamId = crypto.randomUUID();
  await db.insert(teamsTable).values({
    id: teamId,
    kesimAlaniId: id,
    name,
    color,
  });
  res.status(201).json({ id: teamId, name, color });
}));

router.put("/kesim-alanlari/:id/teams/:teamId", asyncHandler(async (req, res) => {
  const parsed = updateTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id, teamId } = req.params;
  const [team] = await db.select().from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.kesimAlaniId, id)));
  if (!team) { res.status(404).json({ error: ERROR_MESSAGES.TEAM_NOT_FOUND }); return; }
  const updates: Record<string, string> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  await db.update(teamsTable).set(updates).where(eq(teamsTable.id, teamId));
  res.json({ id: teamId, name: parsed.data.name ?? team.name, color: parsed.data.color ?? team.color });
}));

router.delete("/kesim-alanlari/:id/teams/:teamId", asyncHandler(async (req, res) => {
  const { id, teamId } = req.params;
  const [team] = await db.select().from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.kesimAlaniId, id)));
  if (!team) { res.status(404).json({ error: ERROR_MESSAGES.TEAM_NOT_FOUND }); return; }
  await db.update(animalGroupsTable)
    .set({ teamId: null })
    .where(and(eq(animalGroupsTable.kesimAlaniId, id), eq(animalGroupsTable.teamId, teamId)));
  await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
  res.json({ success: true });
}));

router.put("/kesim-alanlari/:id/groups/:groupId/team", asyncHandler(async (req, res) => {
  const parsed = assignTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { id, groupId } = req.params;
  const { teamId } = parsed.data;
  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, id)));
  if (!group) { res.status(404).json({ error: ERROR_MESSAGES.GROUP_NOT_FOUND }); return; }
  if (teamId) {
    const [team] = await db.select().from(teamsTable)
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.kesimAlaniId, id)));
    if (!team) { res.status(404).json({ error: ERROR_MESSAGES.TEAM_NOT_FOUND }); return; }
  }
  await db.update(animalGroupsTable)
    .set({ teamId: teamId || null })
    .where(eq(animalGroupsTable.id, groupId));
  res.json({ success: true });
}));

router.put("/tracking/:token/group/:groupId/team", asyncHandler(async (req, res) => {
  const parsed = assignTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { token, groupId } = req.params;
  const { teamId } = parsed.data;
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka) { res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND }); return; }
  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
  if (!group) { res.status(404).json({ error: ERROR_MESSAGES.GROUP_NOT_FOUND }); return; }
  if (teamId) {
    const [team] = await db.select().from(teamsTable)
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.kesimAlaniId, ka.id)));
    if (!team) { res.status(404).json({ error: ERROR_MESSAGES.TEAM_NOT_FOUND }); return; }
  }
  await db.update(animalGroupsTable)
    .set({ teamId: teamId || null })
    .where(eq(animalGroupsTable.id, groupId));
  res.json({ success: true });
}));

export default router;
