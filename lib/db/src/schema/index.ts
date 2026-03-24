import { pgTable, text, serial, integer, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const insertProjectSchema = createInsertSchema(projectsTable);
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectRow = typeof projectsTable.$inferSelect;

export const kesimAlanlariTable = pgTable("kesim_alanlari", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  trackingToken: text("tracking_token"),
});

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
  excluded: boolean("excluded").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedAt: text("deleted_at"),
  aiCategories: text("ai_categories"),
  aiWarnings: text("ai_warnings"),
}, (table) => [
  index("idx_donations_kesim_alani_id").on(table.kesimAlaniId),
]);

export const insertDonationSchema = createInsertSchema(donationsTable);
export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type DonationRow = typeof donationsTable.$inferSelect;

export const animalGroupsTable = pgTable("animal_groups", {
  id: text("id").primaryKey(),
  kesimAlaniId: text("kesim_alani_id").notNull().references(() => kesimAlanlariTable.id, { onDelete: "cascade" }),
  animalNo: integer("animal_no").notNull().default(0),
  colorTag: text("color_tag").notNull().default(""),
  locked: boolean("locked").notNull().default(false),
  notes: text("notes").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  kesildi: boolean("kesildi").notNull().default(false),
  kesildiAt: text("kesildi_at"),
}, (table) => [
  index("idx_animal_groups_kesim_alani_id").on(table.kesimAlaniId),
]);

export const insertAnimalGroupSchema = createInsertSchema(animalGroupsTable);
export type InsertAnimalGroup = z.infer<typeof insertAnimalGroupSchema>;
export type AnimalGroupRow = typeof animalGroupsTable.$inferSelect;

export const animalGroupDonationsTable = pgTable("animal_group_donations", {
  id: serial("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => animalGroupsTable.id, { onDelete: "cascade" }),
  donationId: text("donation_id").notNull().references(() => donationsTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("idx_agd_group_id").on(table.groupId),
  index("idx_agd_donation_id").on(table.donationId),
  unique("uq_agd_group_donation").on(table.groupId, table.donationId),
]);

export const customTagsTable = pgTable("custom_tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
});

export const insertCustomTagSchema = createInsertSchema(customTagsTable);
export type InsertCustomTag = z.infer<typeof insertCustomTagSchema>;
export type CustomTagRow = typeof customTagsTable.$inferSelect;

export const donationTagsTable = pgTable("donation_tags", {
  id: serial("id").primaryKey(),
  donationId: text("donation_id").notNull().references(() => donationsTable.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => customTagsTable.id, { onDelete: "cascade" }),
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
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_tracking_notes_kesim_alani_id").on(table.kesimAlaniId),
  index("idx_tracking_notes_animal_group_id").on(table.animalGroupId),
]);

export const insertTrackingNoteSchema = createInsertSchema(trackingNotesTable);
export type InsertTrackingNote = z.infer<typeof insertTrackingNoteSchema>;
export type TrackingNoteRow = typeof trackingNotesTable.$inferSelect;

export const animalGroupPhotosTable = pgTable("animal_group_photos", {
  id: text("id").primaryKey(),
  animalGroupId: text("animal_group_id").notNull().references(() => animalGroupsTable.id, { onDelete: "cascade" }),
  data: text("data").notNull(),
  mimeType: text("mime_type").notNull().default("image/jpeg"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_photos_animal_group_id").on(table.animalGroupId),
]);

export const insertAnimalGroupPhotoSchema = createInsertSchema(animalGroupPhotosTable);
export type InsertAnimalGroupPhoto = z.infer<typeof insertAnimalGroupPhotoSchema>;
export type AnimalGroupPhotoRow = typeof animalGroupPhotosTable.$inferSelect;

export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const insertAppSettingSchema = createInsertSchema(appSettingsTable);
export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
export type AppSettingRow = typeof appSettingsTable.$inferSelect;
