import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  notificationLogsTable,
  appSettingsTable,
} from "@workspace/db/schema";
import { desc, gt } from "drizzle-orm";
import { eq, and } from "drizzle-orm";
import { serviceError, serviceOk } from "./result";
import { requireActiveKesimAlani } from "./kesim-alani.service";

export async function getNotificationLogs(kesimAlaniId: string) {
  const check = await requireActiveKesimAlani(kesimAlaniId);
  if (check.error) return serviceError(check.error, check.status);

  const logs = await db.select().from(notificationLogsTable)
    .where(eq(notificationLogsTable.kesimAlaniId, kesimAlaniId))
    .orderBy(desc(notificationLogsTable.createdAt));

  return serviceOk({ logs });
}

export async function getNotificationTemplate() {
  const [setting] = await db.select().from(appSettingsTable)
    .where(eq(appSettingsTable.key, "notification_template"));
  return serviceOk({ template: setting?.value || "Hayvan {animalNo} kesildi. Hayırlı olsun!" });
}

export async function updateNotificationTemplate(template: string) {
  await db.insert(appSettingsTable)
    .values({ key: "notification_template", value: template })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: template } });
  return serviceOk({ success: true as const, template });
}

export async function getTrackingNotificationLogs(token: string, since?: string) {
  const [ka] = await db.select().from(kesimAlanlariTable)
    .where(eq(kesimAlanlariTable.trackingToken, token));
  if (!ka || ka.deletedAt) return serviceError("not_found", 404);

  const conditions = [eq(notificationLogsTable.kesimAlaniId, ka.id)];
  if (since) {
    conditions.push(gt(notificationLogsTable.createdAt, new Date(since)));
  }

  const logs = await db.select().from(notificationLogsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationLogsTable.createdAt));

  return serviceOk({ logs });
}
