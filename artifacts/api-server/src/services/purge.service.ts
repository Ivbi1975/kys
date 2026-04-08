import { db } from "@workspace/db";
import {
  donationsTable,
  animalGroupsTable,
  trackingNotesTable,
  kesimAlanlariTable,
  projectsTable,
  animalGroupDonationsTable,
  donationTagsTable,
  animalGroupPhotosTable,
  notificationLogsTable,
  teamsTable,
} from "@workspace/db/schema";
import { lt, isNotNull, and, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { SOFT_DELETE_PURGE_DAYS, SOFT_DELETE_PURGE_INTERVAL_MS } from "../lib/constants";

async function purgeSoftDeletedRecords() {
  const cutoff = new Date(Date.now() - SOFT_DELETE_PURGE_DAYS * 24 * 60 * 60 * 1000);

  try {
    await db.transaction(async (tx) => {
      await tx.delete(trackingNotesTable)
        .where(and(isNotNull(trackingNotesTable.deletedAt), lt(trackingNotesTable.deletedAt, cutoff)));

      const oldGroups = await tx.select({ id: animalGroupsTable.id })
        .from(animalGroupsTable)
        .where(and(isNotNull(animalGroupsTable.deletedAt), lt(animalGroupsTable.deletedAt, cutoff)));

      if (oldGroups.length > 0) {
        const groupIds = oldGroups.map(g => g.id);
        await tx.delete(animalGroupPhotosTable).where(inArray(animalGroupPhotosTable.animalGroupId, groupIds));
        await tx.delete(animalGroupDonationsTable).where(inArray(animalGroupDonationsTable.groupId, groupIds));
        await tx.delete(animalGroupsTable).where(inArray(animalGroupsTable.id, groupIds));
      }

      const oldDonations = await tx.select({ id: donationsTable.id })
        .from(donationsTable)
        .where(and(isNotNull(donationsTable.deletedAt), lt(donationsTable.deletedAt, cutoff)));

      if (oldDonations.length > 0) {
        const donationIds = oldDonations.map(d => d.id);
        await tx.delete(donationTagsTable).where(inArray(donationTagsTable.donationId, donationIds));
        await tx.delete(animalGroupDonationsTable).where(inArray(animalGroupDonationsTable.donationId, donationIds));
        await tx.delete(donationsTable).where(inArray(donationsTable.id, donationIds));
      }

      const oldKAs = await tx.select({ id: kesimAlanlariTable.id })
        .from(kesimAlanlariTable)
        .where(and(isNotNull(kesimAlanlariTable.deletedAt), lt(kesimAlanlariTable.deletedAt, cutoff)));

      if (oldKAs.length > 0) {
        const kaIds = oldKAs.map(k => k.id);
        await tx.delete(notificationLogsTable).where(inArray(notificationLogsTable.kesimAlaniId, kaIds));
        await tx.delete(teamsTable).where(inArray(teamsTable.kesimAlaniId, kaIds));
        await tx.delete(kesimAlanlariTable).where(inArray(kesimAlanlariTable.id, kaIds));
      }

      await tx.delete(projectsTable)
        .where(and(isNotNull(projectsTable.deletedAt), lt(projectsTable.deletedAt, cutoff)));
    });

    logger.info("[purge] Soft-delete purge cycle completed (90+ day cutoff)");
  } catch (err) {
    logger.error({ err }, "[purge] Error purging soft-deleted records");
  }
}

export function startPurgeScheduler() {
  purgeSoftDeletedRecords();
  setInterval(purgeSoftDeletedRecords, SOFT_DELETE_PURGE_INTERVAL_MS).unref();
  logger.info("[purge] Soft-delete purge scheduler started (every 24h, 90-day cutoff)");
}
