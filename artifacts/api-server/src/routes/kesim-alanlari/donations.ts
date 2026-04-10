import { Router, type IRouter } from "express";
import { z } from "zod";
import { refreshProjectStats } from "../projects";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import {
  listDonations,
  countDonations,
  createDonation,
  updateDonation,
  deleteDonation,
  restoreDonation,
  listDeletedDonations,
} from "../../services/donation.service";
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
  birim: z.string().optional().default(""),
  temsilci: z.string().optional().default(""),
  ozellik: z.string().optional().default(""),
  fiyat: z.string().optional().default(""),
  yerTalebi: z.string().optional().default(""),
  gunTalebi: z.string().optional().default(""),
  ilkHayvan: z.string().optional().default(""),
  safi: z.string().optional().default(""),
  excluded: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
});

const router: IRouter = Router();

router.get("/kesim-alanlari/:id/donations", asyncHandler(async (req, res) => {
  const rawLimit = Number(req.query.limit) || 100;
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

  let result;
  try {
    result = await listDonations({
      kesimAlaniId: req.params.id,
      query: req.query as Record<string, unknown>,
      limit: rawLimit,
      cursor,
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

router.get("/kesim-alanlari/:id/donations/count", asyncHandler(async (req, res) => {
  const result = await countDonations(req.params.id, req.query as Record<string, unknown>);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }
  res.json({ count: result.count });
}));

router.post("/kesim-alanlari/:id/donations", asyncHandler(async (req, res) => {
  const parsed = donationPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await createDonation(req.params.id, parsed.data);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json(result.data);
  refreshProjectStats();
  auditLog({ action: "create", entityType: "donation", entityId: parsed.data.id, entityName: parsed.data.name, newValue: parsed.data, req });
}));

router.put("/kesim-alanlari/:id/donations/:donationId", asyncHandler(async (req, res) => {
  const parsed = donationPayloadSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await updateDonation(req.params.id, req.params.donationId, parsed.data);
  if (!result.ok) {
    const errorMap: Record<string, string> = { donor_not_found: ERROR_MESSAGES.DONOR_NOT_FOUND };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json(result.data);
  refreshProjectStats();
  auditLog({ action: "update", entityType: "donation", entityId: req.params.donationId, entityName: parsed.data.name, newValue: parsed.data, req });
}));

router.delete("/kesim-alanlari/:id/donations/:donationId", asyncHandler(async (req, res) => {
  const permanent = req.query.permanent === "true";
  const result = await deleteDonation(req.params.id, req.params.donationId, permanent);
  if (!result.ok) {
    const errorMap: Record<string, string> = { donor_not_found: ERROR_MESSAGES.DONOR_NOT_FOUND };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json({ success: true });
  refreshProjectStats();
  auditLog({ action: "delete", entityType: "donation", entityId: req.params.donationId, newValue: { permanent }, req });
}));

router.post("/kesim-alanlari/:id/donations/:donationId/restore", asyncHandler(async (req, res) => {
  const result = await restoreDonation(req.params.id, req.params.donationId);
  if (!result.ok) {
    const errorMap: Record<string, string> = {
      donor_not_found: ERROR_MESSAGES.DONOR_NOT_FOUND,
      already_active: ERROR_MESSAGES.DONOR_ALREADY_ACTIVE,
    };
    res.status(result.status).json({ error: errorMap[result.error] || result.error });
    return;
  }
  res.json(result.data);
  refreshProjectStats();
  auditLog({ action: "restore", entityType: "donation", entityId: req.params.donationId, req });
}));

router.get("/kesim-alanlari/:id/donations/deleted", asyncHandler(async (req, res) => {
  const result = await listDeletedDonations(req.params.id);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.KESIM_ALANI_NOT_FOUND });
    return;
  }
  res.json(result.items);
}));

export default router;
