export { getApiKey, apiFetch, API_BASE } from "./core";
export { fetchPhotoToken, clearPhotoTokenCache } from "./signed-url";

export {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  restoreProject,
  fetchDeletedProjects,
  fetchArchivedProjects,
  archiveProject,
  unarchiveProject,
  fetchPendingEditRequests,
} from "./projects";
export type { PendingEditRequest } from "./projects";

export {
  fetchKesimAlanlari,
  fetchDeletedKesimAlanlari,
  fetchKesimAlani,
  createKesimAlani,
  apiUpdateKesimAlani,
  apiUpdateBulkAnimalGroups,
  apiUpdateSingleDonation,
  apiUpdateSingleGroup,
  apiDeleteKesimAlani,
  apiPermanentDeleteKesimAlani,
  apiRestoreKesimAlani,
  moveKesimAlani,
  fetchDeletedDonations,
  apiSoftDeleteDonation,
  apiRestoreDonation,
  apiPermanentDeleteDonation,
  moveDonationsToKesimAlani,
  generateTrackingToken,
  fetchPhotoCountsAdmin,
  fetchKesimAlaniTrackingNotes,
  updateTrackingNoteStatus,
  fetchGroupPhotosAdmin,
  getGroupPhotoUrlAdmin,
} from "./kesim-alanlari";
export type { DeletedDonation } from "./kesim-alanlari";

export {
  fetchTrackingData,
  fetchTrackingDelta,
  toggleKesildi,
  fetchTrackingNotes,
  createTrackingNote,
  fetchGroupPhotos,
  getGroupPhotoUrl,
  uploadGroupPhoto,
  deleteGroupPhoto,
  assignTeamTracking,
  fetchTrackingNotificationLogs,
} from "./tracking";
export type {
  TrackingTeam,
  TrackingGroup,
  TrackingData,
  TrackingDelta,
  TrackingNote,
  GroupPhoto,
  NotificationLog,
} from "./tracking";

export {
  fetchAiSettings,
  saveAiSettings,
  classifyNotes,
  saveAiClassifications,
  bulkUpdateNotes,
} from "./ai-notes";
export type {
  AiDonationInput,
  AiClassificationResult,
  AiSettings,
} from "./ai-notes";

export {
  fetchTags,
  createTag,
  updateTag,
  deleteTagApi,
  fetchLogo,
  saveLogoApi,
  deleteLogoApi,
  exportBackupApi,
  importBackupApi,
  fetchNotificationLogs,
  fetchNotificationTemplate,
  updateNotificationTemplate,
  migrateLocalStorageToApi,
} from "./settings";

export {
  fetchExportCount,
  downloadCsvExport,
  fetchCatismaTespiti,
  transferDonation,
  createTeam,
  updateTeam,
  deleteTeam,
  assignTeamAdmin,
  createDonationTransfers,
  fetchTransferLog,
  runIntegrityCheck,
  repairIntegrity,
  globalSearch,
} from "./misc";
export type {
  ConflictEntry,
  Conflict,
  ConflictCheckResult,
  TransferPayload,
  TransferResult,
  DonationTransferEntry,
  IntegrityIssue,
  IntegrityReport,
  IntegrityRepairResult,
  GlobalSearchResult,
} from "./misc";
