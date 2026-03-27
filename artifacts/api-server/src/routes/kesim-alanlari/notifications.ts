import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  notificationLogsTable,
  appSettingsTable,
} from "@workspace/db/schema";
import { desc, gt } from "drizzle-orm";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import { requireActiveKesimAlani } from "../../services/kesim-alani.service";

const notificationTemplateSchema = z.object({
  template: z.string().trim().min(1, "Şablon metni gerekli"),
});

const router: IRouter = Router();

router.get("/kesim-alanlari/:id/notification-logs", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const check = await requireActiveKesimAlani(id);
  if (check.error) { res.status(check.status).json({ error: check.error }); return; }

  const logs = await db.select().from(notificationLogsTable)
    .where(eq(notificationLogsTable.kesimAlaniId, id))
    .orderBy(desc(notificationLogsTable.createdAt));

  res.json(logs);
}));

router.get("/settings/notification-template", asyncHandler(async (_req, res) => {
  const [setting] = await db.select().from(appSettingsTable)
    .where(eq(appSettingsTable.key, "notification_template"));
  res.json({ template: setting?.value || "Hayvan {animalNo} kesildi. Hayırlı olsun!" });
}));

router.put("/settings/notification-template", asyncHandler(async (req, res) => {
  const parsed = notificationTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const { template } = parsed.data;
  await db.insert(appSettingsTable)
    .values({ key: "notification_template", value: template })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: template } });
  res.json({ success: true, template });
}));

router.get("/tracking/:token/notification-logs", asyncHandler(async (req, res) => {
  const { token } = req.params;
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) {
    res.status(404).json({ error: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND });
    return;
  }

  const since = req.query.since as string | undefined;
  const conditions = [eq(notificationLogsTable.kesimAlaniId, ka.id)];
  if (since) {
    conditions.push(gt(notificationLogsTable.createdAt, new Date(since)));
  }

  const logs = await db.select().from(notificationLogsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationLogsTable.createdAt));

  res.json(logs);
}));

export default router;
