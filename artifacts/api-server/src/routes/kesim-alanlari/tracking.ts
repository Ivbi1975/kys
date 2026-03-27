import { Router, type IRouter } from "express";
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
import { z } from "zod";
import crypto from "crypto";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { NoteType, NoteStatus, ERROR_MESSAGES } from "../../lib/constants";
import { cacheInvalidatePrefix } from "../../lib/cache";
import {
  requireActiveKesimAlani,
  KA_LIST_CACHE_KEY,
  createNotificationLogs,
} from "../../services/kesim-alani.service";

const kesildiSchema = z.object({
  kesildi: z.boolean(),
});

const router: IRouter = Router();

router.post("/kesim-alanlari/:id/generate-tracking-token", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const check = await requireActiveKesimAlani(id);
  if (check.error) { res.status(check.status).json({ error: check.error }); return; }

  const token = crypto.randomBytes(16).toString("hex");
  await db.update(kesimAlanlariTable).set({ trackingToken: token }).where(eq(kesimAlanlariTable.id, id));
  res.json({ trackingToken: token });
}));

router.get("/tracking/:token", asyncHandler(async (req, res) => {
  const { token } = req.params;
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) {
    res.status(404).json({ error: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND });
    return;
  }

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

  res.json({
    serverTime: new Date().toISOString(),
    kesimAlaniName: ka.name,
    projectName: projectNameResult,
    totalGroups: groups.length,
    kesildiCount: groups.filter(g => g.kesildi).length,
    groups: mappedGroups,
    teams: teamRows.map(t => ({ id: t.id, name: t.name, color: t.color })),
  });
}));

router.get("/tracking/:token/delta", asyncHandler(async (req, res) => {
  const { token } = req.params;
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

  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) {
    res.status(404).json({ error: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND });
    return;
  }

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
      const donations = await db.select().from(donationsTable)
        .where(inArray(donationsTable.id, donationIds));
      for (const d of donations) {
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

  res.json({
    serverTime,
    updatedGroups,
    updatedNotes: changedNotes,
    deletedGroupIds,
    deletedNoteIds,
    totalGroups: Number(countResult.total),
    kesildiCount: Number(countResult.kesildi),
    hasChanges: updatedGroups.length > 0 || changedNotes.length > 0 || deletedGroupIds.length > 0 || deletedNoteIds.length > 0,
  });
}));


router.put("/tracking/:token/group/:groupId/kesildi", asyncHandler(async (req, res) => {
  const parsed = kesildiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { token, groupId } = req.params;
  const { kesildi } = parsed.data;

  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) {
    res.status(404).json({ error: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND });
    return;
  }

  const [group] = await db.select().from(animalGroupsTable)
    .where(and(eq(animalGroupsTable.id, groupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
  if (!group) {
    res.status(404).json({ error: ERROR_MESSAGES.ANIMAL_GROUP_NOT_FOUND });
    return;
  }

  const kesildiAt = kesildi ? new Date() : null;
  await db.update(animalGroupsTable).set({ kesildi, kesildiAt }).where(eq(animalGroupsTable.id, groupId));
  await createNotificationLogs(ka.id, groupId, group.animalNo, kesildi);
  res.json({ success: true, groupId, kesildi, kesildiAt });
  refreshProjectStats();
}));

router.get("/kesim-alanlari/:id/dashboard", asyncHandler(async (req, res) => {
  const { id: kesimAlaniId } = req.params;

  const kaCheck = await requireActiveKesimAlani(kesimAlaniId);
  if (kaCheck.error) {
    res.status(kaCheck.status).json({ error: kaCheck.error });
    return;
  }

  const groups = await db.select({
    id: animalGroupsTable.id,
    kesildi: animalGroupsTable.kesildi,
    kesildiAt: animalGroupsTable.kesildiAt,
  }).from(animalGroupsTable).where(eq(animalGroupsTable.kesimAlaniId, kesimAlaniId));

  const totalAnimals = groups.length;
  const kesildiCount = groups.filter(g => g.kesildi).length;
  const kesildiTimes = groups.filter(g => g.kesildiAt).map(g => g.kesildiAt!).sort();
  const lastKesildiAt = kesildiTimes.length > 0 ? kesildiTimes[kesildiTimes.length - 1] : null;

  res.json({
    totalAnimals,
    kesildiCount,
    remainingCount: totalAnimals - kesildiCount,
    kesildiPercent: totalAnimals > 0 ? Math.round((kesildiCount / totalAnimals) * 100) : 0,
    lastKesildiAt,
  });
}));

router.get("/tracking/:token/notes", asyncHandler(async (req, res) => {
  const { token } = req.params;
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) {
    res.status(404).json({ error: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND });
    return;
  }

  const notes = await db.select().from(trackingNotesTable)
    .where(eq(trackingNotesTable.kesimAlaniId, ka.id))
    .orderBy(desc(trackingNotesTable.createdAt));

  res.json(notes);
}));

router.post("/tracking/:token/notes", asyncHandler(async (req, res) => {
  const { token } = req.params;
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) {
    res.status(404).json({ error: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND });
    return;
  }

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

  const { animalGroupId, type, content, fieldName, oldValue, newValue } = parsed.data;

  if (animalGroupId) {
    const [group] = await db.select({ id: animalGroupsTable.id })
      .from(animalGroupsTable)
      .where(and(eq(animalGroupsTable.id, animalGroupId), eq(animalGroupsTable.kesimAlaniId, ka.id)));
    if (!group) {
      res.status(400).json({ error: ERROR_MESSAGES.INVALID_ANIMAL_GROUP });
      return;
    }
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
    status: NoteStatus.PENDING,
    createdAt: now,
  });

  const [created] = await db.select().from(trackingNotesTable).where(eq(trackingNotesTable.id, noteId));
  res.status(201).json(created);
}));

router.get("/kesim-alanlari/:id/tracking-notes", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const check = await requireActiveKesimAlani(id);
  if (check.error) { res.status(check.status).json({ error: check.error }); return; }

  const notes = await db.select().from(trackingNotesTable)
    .where(eq(trackingNotesTable.kesimAlaniId, id))
    .orderBy(desc(trackingNotesTable.createdAt));

  res.json(notes);
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

  await db.update(trackingNotesTable)
    .set({ status: parsed.data.status })
    .where(and(eq(trackingNotesTable.id, noteId), eq(trackingNotesTable.kesimAlaniId, id)));

  if (parsed.data.status === NoteStatus.APPROVED) {
    const [note] = await db.select().from(trackingNotesTable)
      .where(and(eq(trackingNotesTable.id, noteId), eq(trackingNotesTable.kesimAlaniId, id)));

    if (note && note.type === NoteType.EDIT_REQUEST && note.animalGroupId && note.fieldName && note.newValue) {
      const siraMatch = note.content.match(/[Ss][ıi]ra\s+(\d+)/);
      const siraIndex = siraMatch ? parseInt(siraMatch[1], 10) - 1 : -1;

      if (siraIndex < 0 || siraIndex >= 7) {
        console.warn(`Edit request approval: could not parse slot index from content "${note.content}" (noteId=${noteId})`);
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

  res.json({ success: true });
}));

export default router;
