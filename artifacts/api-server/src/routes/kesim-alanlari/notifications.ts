import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/error-handler";
import { ERROR_MESSAGES } from "../../lib/constants";
import { cacheGet, cacheSet, cacheInvalidate } from "../../lib/cache";
import {
  getNotificationLogs,
  getNotificationTemplate,
  updateNotificationTemplate,
  getTrackingNotificationLogs,
} from "../../services/notification.service";

const NOTIF_TEMPLATE_KEY = "settings:notif-template";
const NOTIF_TEMPLATE_TTL = 300_000;

const notificationTemplateSchema = z.object({
  template: z.string().trim().min(1, "Şablon metni gerekli"),
});

const router: IRouter = Router();

router.get("/kesim-alanlari/:id/notification-logs", asyncHandler(async (req, res) => {
  const result = await getNotificationLogs(req.params.id);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.logs);
}));

router.get("/settings/notification-template", asyncHandler(async (_req, res) => {
  const cached = cacheGet<{ template: string }>(NOTIF_TEMPLATE_KEY);
  if (cached) {
    res.json(cached);
    return;
  }
  const result = await getNotificationTemplate();
  const data = { template: result.template };
  cacheSet(NOTIF_TEMPLATE_KEY, data, NOTIF_TEMPLATE_TTL);
  res.json(data);
}));

router.put("/settings/notification-template", asyncHandler(async (req, res) => {
  const parsed = notificationTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }
  const result = await updateNotificationTemplate(parsed.data.template);
  cacheInvalidate(NOTIF_TEMPLATE_KEY);
  res.json({ success: result.success, template: result.template });
}));

router.get("/tracking/:token/notification-logs", asyncHandler(async (req, res) => {
  const since = req.query.since as string | undefined;
  const result = await getTrackingNotificationLogs(req.params.token, since);
  if (!result.ok) {
    res.status(result.status).json({ error: ERROR_MESSAGES.TRACKING_LINK_NOT_FOUND });
    return;
  }
  res.json(result.logs);
}));

export default router;
