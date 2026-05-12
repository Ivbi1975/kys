export { getApiKey, apiFetch, API_BASE, ApiFetchError } from "./core";
export { fetchPhotoToken, clearPhotoTokenCache } from "./signed-url";

export {
  fetchHomeData,
  invalidateHomeDataCache,
  fetchProjects,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  permanentDeleteProject,
  restoreProject,
  fetchDeletedProjects,
  fetchArchivedProjects,
  archiveProject,
  unarchiveProject,
  fetchPendingEditRequests,
} from "./projects";
export type { PendingEditRequest, HomeData } from "./projects";

export {
  fetchKesimAlanlari,
  fetchDeletedKesimAlanlari,
  fetchKesimAlani,
  createKesimAlani,
  bulkCreateKesimAlanlari,
  apiUpdateKesimAlani,
  apiUpdateBulkAnimalGroups,
  apiCreateDonation,
  apiUpdateSingleDonation,
  apiUpdateSingleGroup,
  apiDeleteAnimalGroup,
  apiDeleteKesimAlani,
  apiPermanentDeleteKesimAlani,
  apiRestoreKesimAlani,
  moveKesimAlani,
  fetchDeletedDonations,
  apiSoftDeleteDonation,
  apiRestoreDonation,
  apiPermanentDeleteDonation,
  moveDonationsToKesimAlani,
  moveAnimalGroupToKesimAlani,
  generateTrackingToken,
  fetchPhotoCountsAdmin,
  fetchKesimAlaniTrackingNotes,
  updateTrackingNoteStatus,
  fetchGroupPhotosAdmin,
  getGroupPhotoUrlAdmin,
  splitKesimAlani,
  fetchKesimAlaniMeta,
  fetchAllDonations,
  fetchAllGroupsCompact,
  renameKesimAlani,
} from "./kesim-alanlari";
export type { DeletedDonation, SplitTarget, SplitResult, ChunkProgress, KesimAlaniMeta } from "./kesim-alanlari";

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
  reorderGroups,
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
  classifyNotesAsync,
  classifyNotesAsyncChunked,
  PartialChunkError,
  fetchJobStatus,
  cancelJob,
  fetchActiveJob,
  saveAiClassifications,
  bulkUpdateNotes,
} from "./ai-notes";
export type {
  AiDonationInput,
  AiClassificationResult,
  AiSettings,
  AiJobStatus,
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
  fetchPoolDonations,
  fetchPoolStats,
  bulkImportDonations,
  transferDonationsToKA,
  bulkActionDonations,
  bulkTagDonations,
  bulkNoteDonations,
  checkVekaletConflicts,
  fetchPoolAssignedVekalets,
  updatePoolDonationField,
  deleteAllPoolDonations,
  fetchDonationSiblings,
  previewBulkDeleteFiltered,
  bulkDeleteFiltered,
} from "./bagis-havuzu";
export type { PoolDonationsResponse, PoolFilters, VekaletConflict, DonorSiblings, BulkDeletePreviewResult } from "./bagis-havuzu";

export {
  fetchAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  executeAutomationRules,
} from "./automation-rules";

export {
  fetchExportCount,
  downloadCsvExport,
  downloadExcelExport,
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
  flagDonation,
  unflagDonation,
  fetchFlaggedDonations,
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
  FlaggedDonation,
} from "./misc";
