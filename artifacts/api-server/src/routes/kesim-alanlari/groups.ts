import { Router, type IRouter } from "express";
import { z } from "zod";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import {
  listGroups,
  countGroups,
  getGroupDetail,
  bulkLockGroups,
  createGroup,
  bulkUpdateGroups,
  bulkUpdateGroupsChunked,
  updateGroup,
  deleteGroup,
} from "../../services/group.service";
import type { AnimalGroupPayload } from "../../services/kesim-alani.service";
import { auditLog } from "../../services/audit-log.service";

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
  sortOrder: z.number().int().optional(),
  colorTag: z.string().optional().default(""),
  locked: z.boolean().optional().default(false),
  notes: z.string().optional().default(""),
  fiyat: z.string().optional().default(""),
  kesildi: z.boolean().optional(),
  donations: z.array(donationPayloadSchema).optional().default([]),
});

const bulkLockSchema = z.object({
  groupIds: z.array(z.string()).max(500).optional(),
  filter: z.object({
    locked: z.enum(["true", "false"]).optional(),
    kesildi: z.enum(["true", "false"]).optional(),
    teamId: z.string().optional(),
  }).optional(),
  locked: z.boolean(),
});

const bulkAnimalGroupsSchema = z.object({
  animalGroups: z.array(animalGroupPayloadSchema),
});

const bulkAnimalGroupsChunkedSchema = z.object({
  animalGroups: z.array(animalGroupPayloadSchema),
  chunkIndex: z.number().int().min(0),
  totalChunks: z.number().int().min(1),
  saveSessionId: z.string().min(1),
});

const router: IRouter = Router();

router.get("/kesim-alanlari/:id/groups", asyncHandler(async (req, res) => {
  const rawLimit = Number(req.query.limit) || 50;
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;
  const rawOffset = Number(req.query.offset);
  const offset = !cursor && Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const compact = req.query.compact === "1";

  let result;
  try {
    result = await listGroups({
      kesimAlaniId: req.params.id,
      query: req.query as Record<string, unknown>,
      limit: rawLimit,
      cursor,
      offset,
      compact,
    });
  } catch {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_CURSOR });
    return;
  }

  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }
  res.json({ items: result.items, nextCursor: result.nextCursor, hasMore: result.hasMore });
}));

router.get("/kesim-alanlari/:id/groups/count", asyncHandler(async (req, res) => {
  const result = await countGroups(req.params.id, req.query as Record<string, unknown>);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }
  res.json({ count: result.count });
}));

router.get("/kesim-alanlari/:id/groups/:groupId", asyncHandler(async (req, res) => {
  const result = await getGroupDetail(req.params.id, req.params.groupId);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.ANIMAL_GROUP_NOT_FOUND });
    return;
  }
  res.json(result.detail);
}));

router.post("/kesim-alanlari/:id/groups/bulk-lock", asyncHandler(async (req, res) => {
  const parsed = bulkLockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await bulkLockGroups({
    kesimAlaniId: req.params.id,
    groupIds: parsed.data.groupIds,
    filter: parsed.data.filter as Record<string, unknown> | undefined,
    locked: parsed.data.locked,
  });
  if (!result.ok) {
    const errorMap: Record<string, string> = { filter_required: ERROR_MESSAGES.GROUP_IDS_OR_FILTER_REQUIRED };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json({ updated: result.updated, locked: result.locked });
  auditLog({ action: parsed.data.locked ? "lock" : "unlock", entityType: "animal_group", entityName: `${result.updated} grup`, newValue: { locked: parsed.data.locked, groupIds: parsed.data.groupIds, updated: result.updated }, req });
}));

router.post("/kesim-alanlari/:id/animal-groups", asyncHandler(async (req, res) => {
  const parsed = animalGroupPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await createGroup(req.params.id, parsed.data);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json(result.data);
  refreshProjectStats();
  auditLog({ action: "create", entityType: "animal_group", entityId: parsed.data.id, entityName: `Hayvan #${parsed.data.animalNo}`, newValue: parsed.data, req });
}));

router.put("/kesim-alanlari/:id/animal-groups/bulk", asyncHandler(async (req, res) => {
  const parsed = bulkAnimalGroupsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await bulkUpdateGroups(req.params.id, parsed.data.animalGroups as AnimalGroupPayload[]);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.data);
  refreshProjectStats();
}));

router.put("/kesim-alanlari/:id/animal-groups/bulk-chunked", asyncHandler(async (req, res) => {
  const parsed = bulkAnimalGroupsChunkedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const { chunkIndex, totalChunks, saveSessionId } = parsed.data;
  const result = await bulkUpdateGroupsChunked(
    req.params.id,
    parsed.data.animalGroups as AnimalGroupPayload[],
    chunkIndex,
    totalChunks,
    saveSessionId,
  );
  if (!result.ok) {
    res.status(result.status).json({ error: result.error, chunkIndex });
    return;
  }
  const { ok: _ok, ...responseData } = result;
  res.json(responseData);
  if (chunkIndex === totalChunks - 1) {
    refreshProjectStats();
  }
}));

router.put("/kesim-alanlari/:id/animal-groups/:groupId", asyncHandler(async (req, res) => {
  const parsed = animalGroupPayloadSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await updateGroup(req.params.id, req.params.groupId, parsed.data);
  if (!result.ok) {
    const errorMap: Record<string, string> = { group_not_found: ERROR_MESSAGES.ANIMAL_GROUP_NOT_FOUND };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json(result.data);
  refreshProjectStats();
  if (parsed.data.kesildi !== undefined) {
    auditLog({ action: "toggle_kesildi", entityType: "animal_group", entityId: req.params.groupId, newValue: { kesildi: parsed.data.kesildi }, req });
  } else {
    auditLog({ action: "update", entityType: "animal_group", entityId: req.params.groupId, newValue: parsed.data, req });
  }
}));

router.delete("/kesim-alanlari/:id/animal-groups/:groupId", asyncHandler(async (req, res) => {
  const result = await deleteGroup(req.params.id, req.params.groupId);
  if (!result.ok) {
    const errorMap: Record<string, string> = { group_not_found: ERROR_MESSAGES.ANIMAL_GROUP_NOT_FOUND };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json({ success: true });
  refreshProjectStats();
  auditLog({ action: "delete", entityType: "animal_group", entityId: req.params.groupId, req });
}));

export default router;
