import { pgTable, text, serial, integer, real, boolean, timestamp, index, unique, foreignKey, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_projects_deleted_created").on(table.deletedAt, table.createdAt),
  index("idx_projects_active_created").on(table.createdAt).where(sql`deleted_at IS NULL`),
  index("idx_projects_active_not_archived").on(table.createdAt).where(sql`deleted_at IS NULL AND archived_at IS NULL`),
  index("idx_projects_archived").on(table.archivedAt).where(sql`archived_at IS NOT NULL`),
]);

export const insertProjectSchema = createInsertSchema(projectsTable);
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectRow = typeof projectsTable.$inferSelect;

export const kesimAlanlariTable = pgTable("kesim_alanlari", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  trackingToken: text("tracking_token"),
  trackingTokenExpiresAt: timestamp("tracking_token_expires_at", { withTimezone: true }),
  kesimListeId: text("kesim_liste_id"),
  yetkili: text("yetkili"),
  displayName: text("display_name"),
  maxVekalet: integer("max_vekalet"),
  maxAnimal: integer("max_animal"),
  parentKesimAlaniId: text("parent_kesim_alani_id"),
  splitStatus: text("split_status"),
}, (table) => [
  index("idx_ka_project_deleted").on(table.projectId, table.deletedAt),
  index("idx_ka_deleted_created").on(table.deletedAt, table.createdAt),
  index("idx_ka_active_created").on(table.createdAt).where(sql`deleted_at IS NULL`),
  index("idx_ka_active_project").on(table.projectId).where(sql`deleted_at IS NULL`),
  index("idx_ka_parent").on(table.parentKesimAlaniId),
  foreignKey({ columns: [table.parentKesimAlaniId], foreignColumns: [table.id] }).onDelete("set null"),
]);

export const insertKesimAlaniSchema = createInsertSchema(kesimAlanlariTable);
export type InsertKesimAlani = z.infer<typeof insertKesimAlaniSchema>;
export type KesimAlaniRow = typeof kesimAlanlariTable.$inferSelect;

export const donationsTable = pgTable("donations", {
  id: text("id").primaryKey(),
  kesimAlaniId: text("kesim_alani_id").notNull().references(() => kesimAlanlariTable.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  description: text("description").notNull().default(""),
  donationType: text("donation_type").notNull().default(""),
  shareCount: integer("share_count").notNull().default(1),
  vekalet: text("vekalet").notNull().default(""),
  notes: text("notes").notNull().default(""),
  phone: text("phone").notNull().default(""),
  birim: text("birim").notNull().default(""),
  temsilci: text("temsilci").notNull().default(""),
  ozellik: text("ozellik").notNull().default(""),
  fiyat: text("fiyat").notNull().default(""),
  yerTalebi: text("yer_talebi").notNull().default(""),
  gunTalebi: text("gun_talebi").notNull().default(""),
  ilkHayvan: text("ilk_hayvan").notNull().default(""),
  safi: text("safi").notNull().default(""),
  excluded: boolean("excluded").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  aiCategories: text("ai_categories"),
  aiWarnings: text("ai_warnings"),
  aiRequests: text("ai_requests"),
  aiSummary: text("ai_summary"),
  aiConfidenceScore: integer("ai_confidence_score"),
  isFlagged: boolean("is_flagged").notNull().default(false),
  flagReason: text("flag_reason").notNull().default(""),
  flagResolvedAt: timestamp("flag_resolved_at", { withTimezone: true }),
}, (table) => [
  index("idx_donations_kesim_alani_id").on(table.kesimAlaniId),
  index("idx_donations_ka_deleted_sort").on(table.kesimAlaniId, table.deletedAt, table.sortOrder),
  index("idx_donations_active_ka_sort").on(table.kesimAlaniId, table.sortOrder).where(sql`deleted_at IS NULL`),
]);

export const insertDonationSchema = createInsertSchema(donationsTable);
export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type DonationRow = typeof donationsTable.$inferSelect;

export const teamsTable = pgTable("teams", {
  id: text("id").primaryKey(),
  kesimAlaniId: text("kesim_alani_id").notNull().references(() => kesimAlanlariTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_teams_kesim_alani_id").on(table.kesimAlaniId),
]);

export const insertTeamSchema = createInsertSchema(teamsTable);
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type TeamRow = typeof teamsTable.$inferSelect;

export const animalGroupsTable = pgTable("animal_groups", {
  id: text("id").primaryKey(),
  kesimAlaniId: text("kesim_alani_id").notNull().references(() => kesimAlanlariTable.id, { onDelete: "cascade" }),
  animalNo: integer("animal_no").notNull().default(0),
  colorTag: text("color_tag").notNull().default(""),
  locked: boolean("locked").notNull().default(false),
  notes: text("notes").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  kesildi: boolean("kesildi").notNull().default(false),
  kesildiAt: timestamp("kesildi_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  teamId: text("team_id").references(() => teamsTable.id, { onDelete: "set null" }),
  fiyat: text("fiyat").notNull().default(""),
}, (table) => [
  index("idx_animal_groups_kesim_alani_id").on(table.kesimAlaniId),
  index("idx_ag_ka_sort").on(table.kesimAlaniId, table.sortOrder),
  index("idx_ag_ka_animal_no").on(table.kesimAlaniId, table.animalNo),
  index("idx_ag_team_id").on(table.teamId),
]);

export const insertAnimalGroupSchema = createInsertSchema(animalGroupsTable);
export type InsertAnimalGroup = z.infer<typeof insertAnimalGroupSchema>;
export type AnimalGroupRow = typeof animalGroupsTable.$inferSelect;

export const animalGroupDonationsTable = pgTable("animal_group_donations", {
  id: serial("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => animalGroupsTable.id, { onDelete: "cascade" }),
  donationId: text("donation_id").notNull().references(() => donationsTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_agd_group_id").on(table.groupId),
  index("idx_agd_donation_id").on(table.donationId),
  index("idx_agd_group_sort").on(table.groupId, table.sortOrder),
  unique("uq_agd_group_donation").on(table.groupId, table.donationId),
]);

export const tagCategoriesTable = pgTable("tag_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_tag_categories_sort").on(table.sortOrder),
]);

export const insertTagCategorySchema = createInsertSchema(tagCategoriesTable);
export type InsertTagCategory = z.infer<typeof insertTagCategorySchema>;
export type TagCategoryRow = typeof tagCategoriesTable.$inferSelect;

export const customTagsTable = pgTable("custom_tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  vekaletId: text("vekalet_id"),
  notes: text("notes"),
  aiNotes: text("ai_notes"),
  categoryId: text("category_id").references(() => tagCategoriesTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_custom_tags_name").on(table.name),
  index("idx_custom_tags_category_id").on(table.categoryId),
]);

export const insertCustomTagSchema = createInsertSchema(customTagsTable);
export type InsertCustomTag = z.infer<typeof insertCustomTagSchema>;
export type CustomTagRow = typeof customTagsTable.$inferSelect;

export const donationTagsTable = pgTable("donation_tags", {
  id: serial("id").primaryKey(),
  donationId: text("donation_id").notNull().references(() => donationsTable.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => customTagsTable.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_dt_donation_id").on(table.donationId),
  index("idx_dt_tag_id").on(table.tagId),
  unique("uq_dt_donation_tag").on(table.donationId, table.tagId),
]);

export const trackingNotesTable = pgTable("tracking_notes", {
  id: text("id").primaryKey(),
  kesimAlaniId: text("kesim_alani_id").notNull().references(() => kesimAlanlariTable.id, { onDelete: "cascade" }),
  animalGroupId: text("animal_group_id").references(() => animalGroupsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("note"),
  content: text("content").notNull().default(""),
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_tracking_notes_kesim_alani_id").on(table.kesimAlaniId),
  index("idx_tracking_notes_animal_group_id").on(table.animalGroupId),
  index("idx_tracking_notes_ag_active").on(table.animalGroupId, table.deletedAt).where(sql`deleted_at IS NULL`),
]);

export const insertTrackingNoteSchema = createInsertSchema(trackingNotesTable);
export type InsertTrackingNote = z.infer<typeof insertTrackingNoteSchema>;
export type TrackingNoteRow = typeof trackingNotesTable.$inferSelect;

export const animalGroupPhotosTable = pgTable("animal_group_photos", {
  id: text("id").primaryKey(),
  animalGroupId: text("animal_group_id").notNull().references(() => animalGroupsTable.id, { onDelete: "cascade" }),
  data: text("data").notNull(),
  thumbnail: text("thumbnail"),
  mimeType: text("mime_type").notNull().default("image/jpeg"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_photos_animal_group_id").on(table.animalGroupId),
]);

export const insertAnimalGroupPhotoSchema = createInsertSchema(animalGroupPhotosTable);
export type InsertAnimalGroupPhoto = z.infer<typeof insertAnimalGroupPhotoSchema>;
export type AnimalGroupPhotoRow = typeof animalGroupPhotosTable.$inferSelect;

export const notificationLogsTable = pgTable("notification_logs", {
  id: text("id").primaryKey(),
  kesimAlaniId: text("kesim_alani_id").notNull().references(() => kesimAlanlariTable.id, { onDelete: "cascade" }),
  animalGroupId: text("animal_group_id").references(() => animalGroupsTable.id, { onDelete: "set null" }),
  animalNo: integer("animal_no"),
  donorName: text("donor_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  message: text("message").notNull().default(""),
  channel: text("channel").notNull().default("browser"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_notification_logs_kesim_alani_id").on(table.kesimAlaniId),
  index("idx_notification_logs_animal_group_id").on(table.animalGroupId),
]);

export const insertNotificationLogSchema = createInsertSchema(notificationLogsTable);
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLogRow = typeof notificationLogsTable.$inferSelect;

export const donationTransfersTable = pgTable("donation_transfers", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
  donationId: text("donation_id"),
  donorName: text("donor_name").notNull().default(""),
  donorDescription: text("donor_description").notNull().default(""),
  fromKesimAlaniId: text("from_kesim_alani_id"),
  fromKesimAlaniName: text("from_kesim_alani_name").notNull().default(""),
  toKesimAlaniId: text("to_kesim_alani_id"),
  toKesimAlaniName: text("to_kesim_alani_name").notNull().default(""),
  removedFromSource: boolean("removed_from_source").notNull().default(true),
  shareCount: integer("share_count").notNull().default(1),
  transferType: text("transfer_type").notNull().default("donation"),
  animalGroupId: text("animal_group_id"),
  animalNo: integer("animal_no"),
  batchId: text("batch_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_donation_transfers_project_id").on(table.projectId),
  index("idx_donation_transfers_donation_id").on(table.donationId),
  index("idx_donation_transfers_from_ka").on(table.fromKesimAlaniId),
  index("idx_donation_transfers_to_ka").on(table.toKesimAlaniId),
  index("idx_donation_transfers_batch_id").on(table.batchId),
]);

export const insertDonationTransferSchema = createInsertSchema(donationTransfersTable);
export type InsertDonationTransfer = z.infer<typeof insertDonationTransferSchema>;
export type DonationTransferRow = typeof donationTransfersTable.$inferSelect;

export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppSettingSchema = createInsertSchema(appSettingsTable);
export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
export type AppSettingRow = typeof appSettingsTable.$inferSelect;

export const aiJobsTable = pgTable("ai_jobs", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  totalDonations: integer("total_donations").notNull().default(0),
  processedDonations: integer("processed_donations").notNull().default(0),
  result: text("result"),
  error: text("error"),
  kesimAlaniId: text("kesim_alani_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AiJobRow = typeof aiJobsTable.$inferSelect;

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  entityName: text("entity_name"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  sourceType: text("source_type").notNull().default("system"),
  sourceIdentifier: text("source_identifier"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  projectId: text("project_id"),
  filters: jsonb("filters"),
  targetKesimAlaniId: text("target_kesim_alani_id"),
  affectedCount: integer("affected_count"),
  metadata: jsonb("metadata"),
}, (table) => [
  index("idx_audit_entity").on(table.entityType, table.entityId),
  index("idx_audit_action").on(table.action),
  index("idx_audit_created_at").on(table.createdAt),
  index("idx_audit_project_id").on(table.projectId),
]);

export type AuditLogRow = typeof auditLogsTable.$inferSelect;

export const automationRulesTable = pgTable("automation_rules", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  conditions: jsonb("conditions").notNull().default("[]"),
  action: jsonb("action").notNull().default("{}"),
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_automation_rules_project_id").on(table.projectId),
  index("idx_automation_rules_project_active").on(table.projectId, table.priority).where(sql`is_active = true`),
]);

export type AutomationRuleRow = typeof automationRulesTable.$inferSelect;

export const aiJobLogsTable = pgTable("ai_job_logs", {
  id: text("id").primaryKey(),
  jobId: text("job_id"),
  kesimAlaniId: text("kesim_alani_id"),
  projectId: text("project_id"),
  donationCount: integer("donation_count").notNull().default(0),
  processedCount: integer("processed_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  errorBatchCount: integer("error_batch_count").notNull().default(0),
  totalBatches: integer("total_batches").notNull().default(0),
  durationMs: integer("duration_ms"),
  avgConfidenceScore: real("avg_confidence_score"),
  categoryDistribution: text("category_distribution"),
  status: text("status").notNull().default("completed"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_ai_job_logs_project_id").on(table.projectId),
  index("idx_ai_job_logs_kesim_alani_id").on(table.kesimAlaniId),
  index("idx_ai_job_logs_completed_at").on(table.completedAt),
]);

export type AiJobLogRow = typeof aiJobLogsTable.$inferSelect;

export const conflictsLogTable = pgTable("conflicts_log", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
  donationId: text("donation_id"),
  donationName: text("donation_name").notNull().default(""),
  vekalet: text("vekalet").notNull().default(""),
  sourceKesimAlaniId: text("source_kesim_alani_id"),
  sourceKesimAlaniName: text("source_kesim_alani_name").notNull().default(""),
  targetKesimAlaniId: text("target_kesim_alani_id"),
  targetKesimAlaniName: text("target_kesim_alani_name").notNull().default(""),
  conflictType: text("conflict_type").notNull().default("vekalet_duplicate"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("idx_conflicts_log_project_id").on(table.projectId),
  index("idx_conflicts_log_detected_at").on(table.detectedAt),
  index("idx_conflicts_log_donation_id").on(table.donationId),
]);

export type ConflictsLogRow = typeof conflictsLogTable.$inferSelect;
