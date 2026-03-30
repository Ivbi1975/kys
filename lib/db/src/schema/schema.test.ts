import { describe, it, expect } from "vitest";
import {
  insertProjectSchema,
  insertKesimAlaniSchema,
  insertDonationSchema,
  insertAnimalGroupSchema,
  insertTeamSchema,
  insertCustomTagSchema,
  insertTrackingNoteSchema,
  insertAnimalGroupPhotoSchema,
  insertNotificationLogSchema,
  insertDonationTransferSchema,
  insertAppSettingSchema,
  projectsTable,
  kesimAlanlariTable,
  donationsTable,
  animalGroupsTable,
  teamsTable,
  customTagsTable,
  trackingNotesTable,
  animalGroupPhotosTable,
  notificationLogsTable,
  donationTransfersTable,
  appSettingsTable,
  animalGroupDonationsTable,
  donationTagsTable,
  aiJobsTable,
} from "./index";

describe("Schema table exports", () => {
  const tables = [
    { name: "projectsTable", table: projectsTable },
    { name: "kesimAlanlariTable", table: kesimAlanlariTable },
    { name: "donationsTable", table: donationsTable },
    { name: "animalGroupsTable", table: animalGroupsTable },
    { name: "teamsTable", table: teamsTable },
    { name: "customTagsTable", table: customTagsTable },
    { name: "trackingNotesTable", table: trackingNotesTable },
    { name: "animalGroupPhotosTable", table: animalGroupPhotosTable },
    { name: "notificationLogsTable", table: notificationLogsTable },
    { name: "donationTransfersTable", table: donationTransfersTable },
    { name: "appSettingsTable", table: appSettingsTable },
    { name: "animalGroupDonationsTable", table: animalGroupDonationsTable },
    { name: "donationTagsTable", table: donationTagsTable },
    { name: "aiJobsTable", table: aiJobsTable },
  ];

  it.each(tables)("$name is a defined export with properties", ({ table }) => {
    expect(table).toBeDefined();
    expect(typeof table).toBe("object");
    expect(Object.keys(table as object).length).toBeGreaterThan(0);
  });
});

describe("Insert schemas (Zod validation)", () => {
  it("insertProjectSchema accepts valid data", () => {
    const result = insertProjectSchema.safeParse({
      id: "proj-1",
      name: "Test Project",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("insertProjectSchema rejects missing name", () => {
    const result = insertProjectSchema.safeParse({ id: "proj-1" });
    expect(result.success).toBe(false);
  });

  it("insertKesimAlaniSchema accepts valid data", () => {
    const result = insertKesimAlaniSchema.safeParse({
      id: "ka-1",
      name: "Test KA",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("insertKesimAlaniSchema rejects missing name", () => {
    const result = insertKesimAlaniSchema.safeParse({ id: "ka-1" });
    expect(result.success).toBe(false);
  });

  it("insertDonationSchema accepts valid data", () => {
    const result = insertDonationSchema.safeParse({
      id: "don-1",
      kesimAlaniId: "ka-1",
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("insertDonationSchema rejects missing kesimAlaniId", () => {
    const result = insertDonationSchema.safeParse({ id: "don-1" });
    expect(result.success).toBe(false);
  });

  it("insertAnimalGroupSchema accepts valid data", () => {
    const result = insertAnimalGroupSchema.safeParse({
      id: "ag-1",
      kesimAlaniId: "ka-1",
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("insertTeamSchema accepts valid data", () => {
    const result = insertTeamSchema.safeParse({
      id: "team-1",
      kesimAlaniId: "ka-1",
      name: "Ekip A",
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("insertTeamSchema rejects missing name", () => {
    const result = insertTeamSchema.safeParse({ id: "t-1", kesimAlaniId: "ka-1" });
    expect(result.success).toBe(false);
  });

  it("insertCustomTagSchema accepts valid data", () => {
    const result = insertCustomTagSchema.safeParse({
      id: "tag-1",
      name: "VIP",
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("insertTrackingNoteSchema accepts valid data", () => {
    const result = insertTrackingNoteSchema.safeParse({
      id: "tn-1",
      kesimAlaniId: "ka-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("insertAnimalGroupPhotoSchema accepts valid data", () => {
    const result = insertAnimalGroupPhotoSchema.safeParse({
      id: "ph-1",
      animalGroupId: "ag-1",
      data: "base64data",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("insertNotificationLogSchema accepts valid data", () => {
    const result = insertNotificationLogSchema.safeParse({
      id: "nl-1",
      kesimAlaniId: "ka-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("insertDonationTransferSchema accepts valid data", () => {
    const result = insertDonationTransferSchema.safeParse({
      id: "dt-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("insertAppSettingSchema accepts valid data", () => {
    const result = insertAppSettingSchema.safeParse({
      key: "theme",
      value: "dark",
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("insertAppSettingSchema rejects missing value", () => {
    const result = insertAppSettingSchema.safeParse({ key: "theme" });
    expect(result.success).toBe(false);
  });
});
