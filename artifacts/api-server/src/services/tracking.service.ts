import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  animalGroupsTable,
  animalGroupDonationsTable,
  projectsTable,
  trackingNotesTable,
  notificationLogsTable,
  appSettingsTable,
  teamsTable,
} from "@workspace/db/schema";
import { desc, gt, count, asc } from "drizzle-orm";
import { eq, inArray, isNull, isNotNull, and, sql } from "drizzle-orm";
import crypto from "crypto";
import { cacheInvalidatePrefix } from "../lib/cache";
import { NoteType, TRACKING_TOKEN_TTL_DAYS } from "../lib/constants";
import { serviceError, serviceOk } from "./result";
import { logger } from "../lib/logger";
import { KA_LIST_CACHE_KEY, requireActiveKesimAlani, createNotificationLogs } from "./kesim-alani.service";

export async function generateTrackingToken(kesimAlaniId: string) {
  const check = await requireActiveKesimAlani(kesimAlaniId);
  if (check.error) return serviceError(check.error, check.status);

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + TRACKING_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.update(kesimAlanlariTable).set({ trackingToken: token, trackingTokenExpiresAt: expiresAt }).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  return serviceOk({ trackingToken: token, expiresAt });
}

export async function revokeTrackingToken(kesimAlaniId: string) {
  const check = await requireActiveKesimAlani(kesimAlaniId);
  if (check.error) return serviceError(check.error, check.status);

  await db.update(kesimAlanlariTable).set({ trackingToken: null, trackingTokenExpiresAt: null }).where(eq(kesimAlanlariTable.id, kesimAlaniId));
  return serviceOk({ success: true as const });
}

function checkTokenExpiration(ka: { trackingTokenExpiresAt: Date | null }) {
  if (ka.trackingTokenExpiresAt && new Date() > ka.trackingTokenExpiresAt) {
    return serviceError("token_expired", 410);
  }
  return null;
}

export async function getTrackingNotesByKA(kesimAlaniId: string) {
  const notes = await db.select().from(trackingNotesTable)
    .where(eq(trackingNotesTable.kesimAlaniId, kesimAlaniId))
    .orderBy(desc(trackingNotesTable.createdAt));
  return serviceOk({ notes });
}

export async function getTrackingPage(token: string) {
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) return serviceError("not_found", 404);

  const expError = checkTokenExpiration(ka);
  if (expError) return expError;

  const groups = await db.select().from(animalGroupsTable)
    .where(eq(animalGroupsTable.kesimAlaniId, ka.id))
    .orderBy(animalGroupsTable.sortOrder);

  const groupIds = groups.map(g => g.id);
  const groupDonationLinks = groupIds.length > 0
    ? await db.select({
        groupId: animalGroupDonationsTable.groupId,
        donationId: animalGroupDonationsTable.donationId,
        sortOrder: animalGroupDonationsTable.sortOrder,
      }).from(animalGroupDonationsTable).where(inArray(animalGroupDonationsTable.groupId, groupIds))
    : [];

  const donationIds = [...new Set(groupDonationLinks.map(l => l.donationId))];
  const donations = donationIds.length > 0
    ? await db.select().from(donationsTable).where(inArray(donationsTable.id, donationIds))
    : [];

  const donationsById: Record<string, { name: string; description: string; donationType: string; vekalet: string; notes: string }> = {};
  for (const d of donations) {
    donationsById[d.id] = { name: d.name, description: d.description, donationType: d.donationType, vekalet: d.vekalet || "", notes: d.notes || "" };
  }

  const groupDonationsByGroup: Record<string, typeof groupDonationLinks> = {};
  for (const link of groupDonationLinks) {
    if (!groupDonationsByGroup[link.groupId]) groupDonationsByGroup[link.groupId] = [];
    groupDonationsByGroup[link.groupId].push(link);
  }

  const [teamRows, projectNameResult] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.kesimAlaniId, ka.id)),
    ka.projectId
      ? db.select().from(projectsTable).where(eq(projectsTable.id, ka.projectId)).then(r => r[0]?.name || null)
      : Promise.resolve(null),
  ]);

  const mappedGroups = groups.map(g => {
    const links = (groupDonationsByGroup[g.id] || []).sort((a, b) => a.sortOrder - b.sortOrder);
    const filledDonations = links
      .map(l => donationsById[l.donationId])
      .filter(d => d && d.name.trim());
    return {
      id: g.id,
      animalNo: g.animalNo,
      colorTag: g.colorTag,
      kesildi: g.kesildi,
      kesildiAt: g.kesildiAt || null,
      teamId: g.teamId || null,
      filledCount: filledDonations.length,
      donors: filledDonations.map(d => ({ name: d.name, description: d.description, donationType: d.donationType, vekalet: d.vekalet || "", notes: d.notes || "" })),
    };
  });

  return serviceOk({
    data: {
      serverTime: new Date().toISOString(),
      kesimAlaniName: ka.name,
      projectName: projectNameResult,
      totalGroups: groups.length,
      kesildiCount: groups.filter(g => g.kesildi).length,
      groups: mappedGroups,
      teams: teamRows.map(t => ({ id: t.id, name: t.name, color: t.color })),
    },
  });
}

export async function getTrackingDelta(token: string, sinceDate: Date) {
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) return serviceError("not_found", 404);

  const expError = checkTokenExpiration(ka);
  if (expError) return expError;

  const serverTime = new Date().toISOString();

  const changedGroups = await db.select().from(animalGroupsTable)
    .where(and(
      eq(animalGroupsTable.kesimAlaniId, ka.id),
      isNull(animalGroupsTable.deletedAt),
      gt(animalGroupsTable.updatedAt, sinceDate)
    ))
    .orderBy(animalGroupsTable.sortOrder);

  const changedGroupIds = changedGroups.map(g => g.id);
  let groupDonationLinks: { groupId: string; donationId: string; sortOrder: number }[] = [];
  const donationsById: Record<string, { name: string; description: string; donationType: string; vekalet: string; notes: string }> = {};

  if (changedGroupIds.length > 0) {
    groupDonationLinks = await db.select({
      groupId: animalGroupDonationsTable.groupId,
      donationId: animalGroupDonationsTable.donationId,
      sortOrder: animalGroupDonationsTable.sortOrder,
    }).from(animalGroupDonationsTable)
      .where(inArray(animalGroupDonationsTable.groupId, changedGroupIds));

    const donationIds = [...new Set(groupDonationLinks.map(l => l.donationId))];
    if (donationIds.length > 0) {
      const donationRows = await db.select().from(donationsTable)
        .where(inArray(donationsTable.id, donationIds));
      for (const d of donationRows) {
        donationsById[d.id] = { name: d.name, description: d.description, donationType: d.donationType, vekalet: d.vekalet || "", notes: d.notes || "" };
      }
    }
  }

  const groupDonationsByGroup: Record<string, typeof groupDonationLinks> = {};
  for (const link of groupDonationLinks) {
    if (!groupDonationsByGroup[link.groupId]) groupDonationsByGroup[link.groupId] = [];
    groupDonationsByGroup[link.groupId].push(link);
  }

  const updatedGroups = changedGroups.map(g => {
    const links = (groupDonationsByGroup[g.id] || []).sort((a, b) => a.sortOrder - b.sortOrder);
    const filledDonations = links
      .map(l => donationsById[l.donationId])
      .filter(d => d && d.name.trim());
    return {
      id: g.id,
      animalNo: g.animalNo,
      colorTag: g.colorTag,
      kesildi: g.kesildi,
      kesildiAt: g.kesildiAt || null,
      teamId: g.teamId || null,
      filledCount: filledDonations.length,
      donors: filledDonations.map(d => ({ name: d.name, description: d.description, donationType: d.donationType, vekalet: d.vekalet || "", notes: d.notes || "" })),
    };
  });

  const changedNotes = await db.select().from(trackingNotesTable)
    .where(and(
      eq(trackingNotesTable.kesimAlaniId, ka.id),
      isNull(trackingNotesTable.deletedAt),
      gt(trackingNotesTable.updatedAt, sinceDate)
    ))
    .orderBy(desc(trackingNotesTable.createdAt));

  const deletedGroups = await db.select({ id: animalGroupsTable.id })
    .from(animalGroupsTable)
    .where(and(
      eq(animalGroupsTable.kesimAlaniId, ka.id),
      isNotNull(animalGroupsTable.deletedAt),
      gt(animalGroupsTable.deletedAt, sinceDate)
    ));
  const deletedGroupIds = deletedGroups.map(g => g.id);

  const deletedNotes = await db.select({ id: trackingNotesTable.id })
    .from(trackingNotesTable)
    .where(and(
      eq(trackingNotesTable.kesimAlaniId, ka.id),
      isNotNull(trackingNotesTable.deletedAt),
      gt(trackingNotesTable.deletedAt, sinceDate)
    ));
  const deletedNoteIds = deletedNotes.map(n => n.id);

  const [countResult] = await db.select({
    total: count(),
    kesildi: sql<number>`count(*) filter (where kesildi = true)`,
  }).from(animalGroupsTable)
    .where(and(
      eq(animalGroupsTable.kesimAlaniId, ka.id),
      isNull(animalGroupsTable.deletedAt)
    ));

  return serviceOk({
    data: {
      serverTime,
      updatedGroups,
      updatedNotes: changedNotes,
      deletedGroupIds,
      deletedNoteIds,
      totalGroups: Number(countResult.total),
      kesildiCount: Number(countResult.kesildi),
      hasChanges: updatedGroups.length > 0 || changedNotes.length > 0 || deletedGroupIds.length > 0 || deletedNoteIds.length > 0,
    },
  });
}

export async function updateKesildiStatus(token: string, groupId: string, kesildi: boolean) {
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) return serviceError("not_found", 404);

  const expError = checkTokenExpiration(ka);
  if (expError) return expError;

  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
  if (!group) return serviceError("group_not_found", 404);

  const kesildiAt = kesildi ? new Date() : null;
  await db.update(animalGroupsTable).set({ kesildi, kesildiAt }).where(eq(animalGroupsTable.id, groupId));
  await createNotificationLogs(ka.id, groupId, group.animalNo, kesildi);
  return serviceOk({ groupId, kesildi, kesildiAt });
}

export async function getDashboard(kesimAlaniId: string) {
  const groups = await db.select({
    id: animalGroupsTable.id,
    kesildi: animalGroupsTable.kesildi,
    kesildiAt: animalGroupsTable.kesildiAt,
  }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId));

  const totalAnimals = groups.length;
  const kesildiCount = groups.filter(g => g.kesildi).length;
  const kesildiTimes = groups.filter(g => g.kesildiAt).map(g => g.kesildiAt!).sort();
  const lastKesildiAt = kesildiTimes.length > 0 ? kesildiTimes[kesildiTimes.length - 1] : null;

  return serviceOk({
    data: {
      totalAnimals,
      kesildiCount,
      remainingCount: totalAnimals - kesildiCount,
      kesildiPercent: totalAnimals > 0 ? Math.round((kesildiCount / totalAnimals) * 100) : 0,
      lastKesildiAt,
    },
  });
}

export async function getTrackingNotes(token: string) {
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) return serviceError("not_found", 404);

  const expError = checkTokenExpiration(ka);
  if (expError) return expError;

  const notes = await db.select().from(trackingNotesTable)
    .where(eq(trackingNotesTable.kesimAlaniId, ka.id))
    .orderBy(desc(trackingNotesTable.createdAt));

  return serviceOk({ notes, kesimAlaniId: ka.id });
}

interface CreateNoteParams {
  animalGroupId?: string;
  type: string;
  content: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}

export async function createTrackingNote(token: string, params: CreateNoteParams) {
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) return serviceError("not_found", 404);

  const expError = checkTokenExpiration(ka);
  if (expError) return expError;

  const { animalGroupId, type, content, fieldName, oldValue, newValue } = params;

  if (animalGroupId) {
    const [group] = await db.select({ id: animalGroupsTable.id })
      .from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, animalGroupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
    if (!group) return serviceError("invalid_group", 400);
  }

  const noteId = crypto.randomUUID();
  const now = new Date();

  await db.insert(trackingNotesTable).values({
    id: noteId,
    kesimAlaniId: ka.id,
    animalGroupId: animalGroupId || null,
    type,
    content,
    fieldName: fieldName || null,
    oldValue: oldValue || null,
    newValue: newValue || null,
    status: "pending",
    createdAt: now,
  });

  const [created] = await db.select().from(trackingNotesTable).where(eq(trackingNotesTable.id, noteId));
  return serviceOk({ note: created });
}

export async function approveEditRequest(kesimAlaniId: string, noteId: string, statusVal: string) {
  await db.update(trackingNotesTable)
    .set({ status: statusVal })
    .where(and(eq(trackingNotesTable.id, noteId), eq(trackingNotesTable.kesimAlaniId, kesimAlaniId)));

  if (statusVal === "approved") {
    const [note] = await db.select().from(trackingNotesTable)
      .where(and(eq(trackingNotesTable.id, noteId), eq(trackingNotesTable.kesimAlaniId, kesimAlaniId)));

    if (note && note.type === NoteType.EDIT_REQUEST && note.animalGroupId && note.fieldName && note.newValue) {
      const siraMatch = note.content.match(/[Ss][ıi]ra\s+(\d+)/);
      const siraIndex = siraMatch ? parseInt(siraMatch[1], 10) - 1 : -1;

      if (siraIndex < 0 || siraIndex >= 7) {
        logger.warn({ noteId, content: note.content }, "Edit request approval: could not parse slot index");
      }

      if (siraIndex >= 0 && siraIndex < 7) {
        const groupDonationLinks = await db.select()
          .from(animalGroupDonationsTable)
          .where(eq(animalGroupDonationsTable.groupId, note.animalGroupId))
          .orderBy(animalGroupDonationsTable.sortOrder);

        if (siraIndex < groupDonationLinks.length) {
          const donationId = groupDonationLinks[siraIndex].donationId;
          const fieldMap: Record<string, keyof typeof donationsTable.$inferSelect> = {
            name: "name",
            description: "description",
            donationType: "donationType",
            vekalet: "vekalet",
            notes: "notes",
          };

          const dbField = fieldMap[note.fieldName];
          if (dbField) {
            await db.update(donationsTable)
              .set({ [dbField]: note.newValue })
              .where(eq(donationsTable.id, donationId));
            cacheInvalidatePrefix(KA_LIST_CACHE_KEY);
          }
        }
      }
    }
  }
  return serviceOk({ success: true as const });
}
