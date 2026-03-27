import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  animalGroupsTable,
  teamsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { serviceError, serviceOk, type ServiceResult } from "./result";

export async function listTeams(kesimAlaniId: string) {
  const teams = await db.select().from(teamsTable)
    .where(eq(teamsTable.kesimAlaniId, kesimAlaniId));
  return serviceOk({ data: teams.map(t => ({ id: t.id, name: t.name, color: t.color })) });
}

export async function createTeam(kesimAlaniId: string, name: string, color: string) {
  const teamId = crypto.randomUUID();
  await db.insert(teamsTable).values({
    id: teamId,
    kesimAlaniId,
    name,
    color,
  });
  return serviceOk({ data: { id: teamId, name, color } });
}

export async function updateTeam(kesimAlaniId: string, teamId: string, updates: { name?: string; color?: string }): Promise<ServiceResult<{ data: { id: string; name: string; color: string } }>> {
  const [team] = await db.select().from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.kesimAlaniId, kesimAlaniId)));
  if (!team) return serviceError("not_found", 404);

  const dbUpdates: Record<string, string> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  await db.update(teamsTable).set(dbUpdates).where(eq(teamsTable.id, teamId));
  return serviceOk({ data: { id: teamId, name: updates.name ?? team.name, color: updates.color ?? team.color } });
}

export async function deleteTeam(kesimAlaniId: string, teamId: string): Promise<ServiceResult<{ success: true }>> {
  const [team] = await db.select().from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.kesimAlaniId, kesimAlaniId)));
  if (!team) return serviceError("not_found", 404);

  await db.update(animalGroupsTable)
    .set({ teamId: null })
    .where(and(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId), eq(animalGroupsTable.teamId, teamId)));
  await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
  return serviceOk({ success: true as const });
}

export async function assignTeamToGroup(params: {
  kesimAlaniId: string;
  groupId: string;
  teamId: string | null | undefined;
}): Promise<ServiceResult<{ success: true }>> {
  const { kesimAlaniId, groupId, teamId } = params;

  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, kesimAlaniId)));
  if (!group) return serviceError("group_not_found", 404);

  if (teamId) {
    const [team] = await db.select().from(teamsTable)
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.kesimAlaniId, kesimAlaniId)));
    if (!team) return serviceError("team_not_found", 404);
  }

  await db.update(animalGroupsTable)
    .set({ teamId: teamId || null })
    .where(eq(animalGroupsTable.id, groupId));
  return serviceOk({ success: true as const });
}

export async function assignTeamByToken(token: string, groupId: string, teamId: string | null | undefined): Promise<ServiceResult<{ success: true }>> {
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka) return serviceError("ka_not_found", 404);

  return assignTeamToGroup({ kesimAlaniId: ka.id, groupId, teamId });
}
