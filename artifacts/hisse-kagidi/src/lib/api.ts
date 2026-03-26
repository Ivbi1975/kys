import type { KesimAlani, CustomTag, Project } from "./types";

const API_BASE = import.meta.env.BASE_URL
  ? `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/").replace(/\/$/, "")
  : "/api";

interface ApiError {
  error: string;
  details?: unknown;
}

function getApiKey(): string {
  return sessionStorage.getItem("app_api_key") || "";
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      sessionStorage.removeItem("app_unlocked");
      sessionStorage.removeItem("app_api_key");
      window.location.reload();
      throw new Error("Oturum süresi doldu. Yeniden giriş yapılıyor...");
    }
    const err: ApiError = await res.json().catch(() => ({ error: "Sunucu hatası" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/projects");
}

export async function createProject(name: string): Promise<Project> {
  return apiFetch<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateProject(id: string, name: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function deleteProject(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/projects/${id}`, { method: "DELETE" });
}

export async function restoreProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}/restore`, { method: "POST" });
}

export async function fetchDeletedProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/projects/deleted");
}

export async function fetchArchivedProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/projects/archived");
}

export async function archiveProject(id: string): Promise<{ success: boolean; archivedAt: string }> {
  return apiFetch<{ success: boolean; archivedAt: string }>(`/projects/${id}/archive`, { method: "POST" });
}

export async function unarchiveProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}/unarchive`, { method: "POST" });
}

export async function moveKesimAlani(kesimAlaniId: string, projectId: string | null): Promise<KesimAlani> {
  return apiFetch<KesimAlani>(`/kesim-alanlari/${kesimAlaniId}/move`, {
    method: "PUT",
    body: JSON.stringify({ projectId }),
  });
}

export async function fetchKesimAlanlari(): Promise<KesimAlani[]> {
  return apiFetch<KesimAlani[]>("/kesim-alanlari");
}

export async function fetchDeletedKesimAlanlari(): Promise<KesimAlani[]> {
  return apiFetch<KesimAlani[]>("/kesim-alanlari/deleted");
}

export async function fetchKesimAlani(id: string): Promise<KesimAlani | null> {
  try {
    return await apiFetch<KesimAlani>(`/kesim-alanlari/${id}`);
  } catch (err) {
    console.warn(`fetchKesimAlani(${id}) failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function createKesimAlani(data: KesimAlani & { projectId?: string | null }): Promise<KesimAlani> {
  return apiFetch<KesimAlani>("/kesim-alanlari", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiUpdateKesimAlani(data: KesimAlani): Promise<KesimAlani> {
  return apiFetch<KesimAlani>(`/kesim-alanlari/${data.id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function apiUpdateBulkAnimalGroups(kesimAlaniId: string, animalGroups: KesimAlani["animalGroups"]): Promise<KesimAlani> {
  return apiFetch<KesimAlani>(`/kesim-alanlari/${kesimAlaniId}/animal-groups/bulk`, {
    method: "PUT",
    body: JSON.stringify({ animalGroups }),
  });
}

export async function apiUpdateSingleDonation(
  kesimAlaniId: string,
  donationId: string,
  updates: Record<string, string | number | boolean | string[]>
): Promise<void> {
  await apiFetch(`/kesim-alanlari/${kesimAlaniId}/donations/${donationId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function apiUpdateSingleGroup(
  kesimAlaniId: string,
  groupId: string,
  updates: Record<string, unknown>
): Promise<void> {
  await apiFetch(`/kesim-alanlari/${kesimAlaniId}/animal-groups/${groupId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}


export async function apiDeleteKesimAlani(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/kesim-alanlari/${id}`, { method: "DELETE" });
}

export async function apiPermanentDeleteKesimAlani(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/kesim-alanlari/${id}?permanent=true`, { method: "DELETE" });
}

export async function apiRestoreKesimAlani(id: string): Promise<KesimAlani> {
  return apiFetch<KesimAlani>(`/kesim-alanlari/${id}/restore`, { method: "POST" });
}

export interface DeletedDonation {
  id: string;
  kesimAlaniId: string;
  name: string;
  description: string;
  donationType: string;
  shareCount: number;
  vekalet: string;
  notes: string;
  excluded: boolean;
  deletedAt: string;
  tags: string[];
}

export async function fetchDeletedDonations(kesimAlaniId: string): Promise<DeletedDonation[]> {
  return apiFetch<DeletedDonation[]>(`/kesim-alanlari/${kesimAlaniId}/donations/deleted`);
}

export async function apiSoftDeleteDonation(kesimAlaniId: string, donationId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/kesim-alanlari/${kesimAlaniId}/donations/${donationId}`, { method: "DELETE" });
}

export async function apiRestoreDonation(kesimAlaniId: string, donationId: string): Promise<KesimAlani> {
  return apiFetch<KesimAlani>(`/kesim-alanlari/${kesimAlaniId}/donations/${donationId}/restore`, { method: "POST" });
}

export async function apiPermanentDeleteDonation(kesimAlaniId: string, donationId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/kesim-alanlari/${kesimAlaniId}/donations/${donationId}?permanent=true`, { method: "DELETE" });
}

export async function fetchTags(): Promise<CustomTag[]> {
  return apiFetch<CustomTag[]>("/tags");
}

export async function createTag(tag: CustomTag): Promise<CustomTag> {
  return apiFetch<CustomTag>("/tags", {
    method: "POST",
    body: JSON.stringify(tag),
  });
}

export async function updateTag(tag: CustomTag): Promise<CustomTag> {
  return apiFetch<CustomTag>(`/tags/${tag.id}`, {
    method: "PUT",
    body: JSON.stringify(tag),
  });
}

export async function deleteTagApi(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/tags/${id}`, { method: "DELETE" });
}

export async function fetchLogo(): Promise<string | null> {
  const data = await apiFetch<{ logo: string | null }>("/settings/logo");
  return data.logo;
}

export async function saveLogoApi(base64: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/settings/logo", {
    method: "PUT",
    body: JSON.stringify({ logo: base64 }),
  });
}

export async function deleteLogoApi(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/settings/logo", { method: "DELETE" });
}

interface BackupData {
  version: number;
  timestamp: string;
  kesimAlanlari: KesimAlani[];
  logo: string | null;
  globalTags: CustomTag[];
}

export async function exportBackupApi(): Promise<string> {
  const data = await apiFetch<BackupData>("/backup/export", { method: "POST" });
  return JSON.stringify(data, null, 2);
}

export async function importBackupApi(json: string, mode: "replace" | "merge" = "replace"): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const parsed: unknown = JSON.parse(json);
    const data = await apiFetch<{ success: boolean; count: number }>("/backup/import", {
      method: "POST",
      body: JSON.stringify({ mode, data: parsed }),
    });
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dosya okunamadı";
    return { success: false, count: 0, error: message };
  }
}

export interface AiDonationInput {
  id: string;
  name: string;
  donationType: string;
  vekalet: string;
  notes: string;
}

export interface AiClassificationResult {
  donationId: string;
  categories: string[];
  requests: string;
  warnings: string;
  summary: string;
}

export interface AiSettings {
  prompt: string;
  categories: string[];
}

export async function fetchAiSettings(): Promise<AiSettings> {
  return apiFetch<AiSettings>("/ai-notes/settings");
}

export async function saveAiSettings(settings: Partial<AiSettings>): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/ai-notes/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export async function classifyNotes(donations: AiDonationInput[]): Promise<{ results: AiClassificationResult[] }> {
  return apiFetch<{ results: AiClassificationResult[] }>("/ai-notes/classify", {
    method: "POST",
    body: JSON.stringify({ donations }),
  });
}

export async function saveAiClassifications(classifications: { donationId: string; categories: string[]; warnings: string }[]): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/ai-notes/save-classifications", {
    method: "PUT",
    body: JSON.stringify({ classifications }),
  });
}

export async function moveDonationsToKesimAlani(donationIds: string[], sourceKesimAlaniId: string, targetKesimAlaniId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/kesim-alanlari/move-donations", {
    method: "POST",
    body: JSON.stringify({ donationIds, sourceKesimAlaniId, targetKesimAlaniId }),
  });
}

export interface ConflictEntry {
  donationId: string;
  donationName: string;
  donationDescription: string;
  donationNotes: string;
  kesimAlaniId: string;
  kesimAlaniName: string;
  animalGroupId: string | null;
  animalGroupNo: number | null;
  hasNoteWarning: boolean;
  siblingsInGroup: Array<{
    donationId: string;
    donationName: string;
    donationDescription: string;
    donationNotes: string;
    donationType: string;
    shareCount: number;
    vekalet: string;
  }>;
}

export interface Conflict {
  key: string;
  matchField: "name" | "description";
  displayName: string;
  entries: ConflictEntry[];
  kesimAlanCount: number;
  totalEntries: number;
  hasNoteWarnings: boolean;
}

export interface ConflictCheckResult {
  conflicts: Conflict[];
  totalConflicts: number;
}

export async function fetchCatismaTespiti(projectId?: string): Promise<ConflictCheckResult> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return apiFetch<ConflictCheckResult>(`/catisma-tespiti${query}`);
}

export interface TransferPayload {
  donationId: string;
  sourceKesimAlaniId: string;
  targetKesimAlaniId: string;
  transferAnimal?: boolean;
  animalGroupId?: string;
}

export interface TransferResult {
  success: boolean;
  source: KesimAlani;
  target: KesimAlani;
}

export async function transferDonation(payload: TransferPayload): Promise<TransferResult> {
  return apiFetch<TransferResult>("/catisma-tespiti/transfer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function bulkUpdateNotes(kesimAlaniId: string, updates: { donationId: string; notes: string }[]): Promise<{ success: boolean; count: number }> {
  return apiFetch<{ success: boolean; count: number }>("/ai-notes/bulk-update", {
    method: "PUT",
    body: JSON.stringify({ kesimAlaniId, updates }),
  });
}

export async function migrateLocalStorageToApi(): Promise<boolean> {
  const MIGRATION_FLAG = "hisse-kagidi-migrated-to-db";
  if (localStorage.getItem(MIGRATION_FLAG)) return false;

  const STORAGE_KEY = "hisse-kagidi-data";
  const LOGO_KEY = "hisse-kagidi-logo";
  const TAGS_KEY = "hisse-kagidi-global-tags";

  const rawData = localStorage.getItem(STORAGE_KEY);
  const rawLogo = localStorage.getItem(LOGO_KEY);
  const rawTags = localStorage.getItem(TAGS_KEY);

  const hasData = rawData && rawData !== "[]";
  const hasLogo = !!rawLogo;
  const hasTags = rawTags && rawTags !== "[]";

  if (!hasData && !hasLogo && !hasTags) {
    localStorage.setItem(MIGRATION_FLAG, "true");
    return false;
  }

  const failures: string[] = [];

  try {
    const existingData = await fetchKesimAlanlari();
    const existingTags = await fetchTags();
    const existingIds = new Set(existingData.map(k => k.id));
    const existingTagIds = new Set(existingTags.map(t => t.id));

    if (hasTags) {
      const tags: CustomTag[] = JSON.parse(rawTags!);
      for (const tag of tags) {
        if (existingTagIds.has(tag.id)) continue;
        try {
          await createTag(tag);
        } catch (err) {
          const msg = `Tag ${tag.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.warn("Migration failed -", msg);
          failures.push(msg);
        }
      }
    }

    if (hasData) {
      const kesimAlanlari: KesimAlani[] = JSON.parse(rawData!);
      for (const ka of kesimAlanlari) {
        if (existingIds.has(ka.id)) continue;
        try {
          await createKesimAlani(ka);
        } catch (err) {
          const msg = `KesimAlani ${ka.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.warn("Migration failed -", msg);
          failures.push(msg);
        }
      }
    }

    if (hasLogo) {
      try {
        await saveLogoApi(rawLogo!);
      } catch (err) {
        const msg = `Logo: ${err instanceof Error ? err.message : String(err)}`;
        console.error("Migration failed -", msg);
        failures.push(msg);
      }
    }

    if (failures.length === 0) {
      localStorage.setItem(MIGRATION_FLAG, "true");
      return true;
    }

    console.warn(`Migration incomplete: ${failures.length} item(s) failed. Will retry on next load.`);
    return false;
  } catch (err) {
    console.error("Migration aborted:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function generateTrackingToken(kesimAlaniId: string): Promise<string> {
  const data = await apiFetch<{ trackingToken: string }>(`/kesim-alanlari/${kesimAlaniId}/generate-tracking-token`, {
    method: "POST",
  });
  return data.trackingToken;
}

export interface TrackingTeam {
  id: string;
  name: string;
  color: string;
}

export interface TrackingGroup {
  id: string;
  animalNo: number;
  colorTag: string;
  kesildi: boolean;
  kesildiAt: string | null;
  teamId: string | null;
  filledCount: number;
  donors: { name: string; description: string; donationType: string; vekalet: string; notes: string }[];
}

export interface TrackingData {
  serverTime?: string;
  kesimAlaniName: string;
  projectName: string | null;
  totalGroups: number;
  kesildiCount: number;
  groups: TrackingGroup[];
  teams: TrackingTeam[];
}

export async function fetchTrackingData(token: string): Promise<TrackingData> {
  return apiFetch<TrackingData>(`/tracking/${token}`);
}

export interface TrackingDelta {
  serverTime: string;
  updatedGroups: TrackingGroup[];
  updatedNotes: TrackingNote[];
  deletedGroupIds: string[];
  deletedNoteIds: string[];
  totalGroups: number;
  kesildiCount: number;
  hasChanges: boolean;
}

export async function fetchTrackingDelta(token: string, since: string): Promise<TrackingDelta> {
  return apiFetch<TrackingDelta>(`/tracking/${token}/delta?since=${encodeURIComponent(since)}`);
}

export async function fetchExportCount(kaId?: string): Promise<{ total: number }> {
  const qs = kaId ? `?kaId=${encodeURIComponent(kaId)}` : "";
  return apiFetch<{ total: number }>(`/export/count${qs}`);
}

export async function downloadCsvExport(
  kaId?: string,
  onProgress?: (received: number, total: number) => void,
): Promise<Blob> {
  const qs = kaId ? `?kaId=${encodeURIComponent(kaId)}` : "";
  const apiKey = getApiKey();
  const fetchHeaders: Record<string, string> = {};
  if (apiKey) {
    fetchHeaders["X-API-Key"] = apiKey;
  }
  const res = await fetch(`${API_BASE}/export/csv${qs}`, { headers: fetchHeaders });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Export hatası" }));
    throw new Error(err.error || "Export hatası");
  }

  const totalRows = parseInt(res.headers.get("X-Total-Rows") || "0", 10);
  const contentLength = parseInt(res.headers.get("Content-Length") || "0", 10);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Stream desteklenmiyor");

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedBytes += value.byteLength;
    if (contentLength > 0) {
      const estimatedRows = Math.round((receivedBytes / contentLength) * totalRows);
      onProgress?.(Math.min(estimatedRows, totalRows), totalRows);
    } else {
      onProgress?.(Math.min(receivedBytes, totalRows), totalRows);
    }
  }

  onProgress?.(totalRows, totalRows);
  return new Blob(chunks as BlobPart[], { type: "text/csv; charset=utf-8" });
}

export async function toggleKesildi(token: string, groupId: string, kesildi: boolean): Promise<void> {
  await apiFetch(`/tracking/${token}/group/${groupId}/kesildi`, {
    method: "PUT",
    body: JSON.stringify({ kesildi }),
  });
}

export interface TrackingNote {
  id: string;
  kesimAlaniId: string;
  animalGroupId: string | null;
  type: "note" | "edit_request";
  content: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export async function fetchTrackingNotes(token: string): Promise<TrackingNote[]> {
  return apiFetch<TrackingNote[]>(`/tracking/${token}/notes`);
}

export async function createTrackingNote(token: string, data: {
  animalGroupId?: string;
  type: "note" | "edit_request";
  content?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}): Promise<TrackingNote> {
  return apiFetch<TrackingNote>(`/tracking/${token}/notes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchKesimAlaniTrackingNotes(kesimAlaniId: string): Promise<TrackingNote[]> {
  return apiFetch<TrackingNote[]>(`/kesim-alanlari/${kesimAlaniId}/tracking-notes`);
}

export async function updateTrackingNoteStatus(kesimAlaniId: string, noteId: string, status: "pending" | "approved" | "rejected"): Promise<void> {
  await apiFetch(`/kesim-alanlari/${kesimAlaniId}/tracking-notes/${noteId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export interface PendingEditRequest {
  id: string;
  kesimAlaniId: string;
  kesimAlaniName: string;
  animalGroupId: string | null;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  content: string;
  createdAt: string;
}

export async function fetchPendingEditRequests(projectId: string): Promise<{ count: number; requests: PendingEditRequest[] }> {
  return apiFetch<{ count: number; requests: PendingEditRequest[] }>(`/projects/${projectId}/pending-edit-requests`);
}

export interface GroupPhoto {
  id: string;
  mimeType: string;
  createdAt: string;
}

export async function fetchGroupPhotos(token: string, groupId: string): Promise<GroupPhoto[]> {
  return apiFetch<GroupPhoto[]>(`/tracking/${token}/group/${groupId}/photos`);
}

export function getGroupPhotoUrl(token: string, groupId: string, photoId: string, size?: "thumb"): string {
  const base = `${API_BASE}/tracking/${token}/group/${groupId}/photos/${photoId}`;
  return size ? `${base}?size=${size}` : base;
}

export async function uploadGroupPhoto(token: string, groupId: string, data: string, mimeType: string): Promise<GroupPhoto> {
  return apiFetch<GroupPhoto>(`/tracking/${token}/group/${groupId}/photos`, {
    method: "POST",
    body: JSON.stringify({ data, mimeType }),
  });
}

export async function deleteGroupPhoto(token: string, groupId: string, photoId: string): Promise<void> {
  await apiFetch(`/tracking/${token}/group/${groupId}/photos/${photoId}`, {
    method: "DELETE",
  });
}

export async function fetchGroupPhotosAdmin(kesimAlaniId: string, groupId: string): Promise<GroupPhoto[]> {
  return apiFetch<GroupPhoto[]>(`/kesim-alanlari/${kesimAlaniId}/group/${groupId}/photos`);
}

export function getGroupPhotoUrlAdmin(kesimAlaniId: string, groupId: string, photoId: string, size?: "thumb"): string {
  const base = `${API_BASE}/kesim-alanlari/${kesimAlaniId}/group/${groupId}/photos/${photoId}`;
  const apiKey = getApiKey();
  const params = new URLSearchParams();
  if (size) params.set("size", size);
  if (apiKey) params.set("apiKey", apiKey);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function fetchPhotoCountsAdmin(kesimAlaniId: string): Promise<Record<string, number>> {
  return apiFetch<Record<string, number>>(`/kesim-alanlari/${kesimAlaniId}/photos/counts`);
}

export async function createTeam(kesimAlaniId: string, name: string, color: string): Promise<TrackingTeam> {
  return apiFetch<TrackingTeam>(`/kesim-alanlari/${kesimAlaniId}/teams`, {
    method: "POST",
    body: JSON.stringify({ name, color }),
  });
}

export async function updateTeam(kesimAlaniId: string, teamId: string, data: { name?: string; color?: string }): Promise<TrackingTeam> {
  return apiFetch<TrackingTeam>(`/kesim-alanlari/${kesimAlaniId}/teams/${teamId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTeam(kesimAlaniId: string, teamId: string): Promise<void> {
  await apiFetch(`/kesim-alanlari/${kesimAlaniId}/teams/${teamId}`, { method: "DELETE" });
}

export async function assignTeamAdmin(kesimAlaniId: string, groupId: string, teamId: string | null): Promise<void> {
  await apiFetch(`/kesim-alanlari/${kesimAlaniId}/groups/${groupId}/team`, {
    method: "PUT",
    body: JSON.stringify({ teamId }),
  });
}

export async function assignTeamTracking(token: string, groupId: string, teamId: string | null): Promise<void> {
  await apiFetch(`/tracking/${token}/group/${groupId}/team`, {
    method: "PUT",
    body: JSON.stringify({ teamId }),
  });
}

export interface NotificationLog {
  id: string;
  kesimAlaniId: string;
  animalGroupId: string | null;
  animalNo: number | null;
  donorName: string;
  phone: string;
  message: string;
  channel: string;
  createdAt: string;
}

export async function fetchNotificationLogs(kesimAlaniId: string): Promise<NotificationLog[]> {
  return apiFetch<NotificationLog[]>(`/kesim-alanlari/${kesimAlaniId}/notification-logs`);
}

export async function fetchNotificationTemplate(): Promise<string> {
  const data = await apiFetch<{ template: string }>("/settings/notification-template");
  return data.template;
}

export async function updateNotificationTemplate(template: string): Promise<void> {
  await apiFetch("/settings/notification-template", {
    method: "PUT",
    body: JSON.stringify({ template }),
  });
}

export async function fetchTrackingNotificationLogs(token: string, since?: string): Promise<NotificationLog[]> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiFetch<NotificationLog[]>(`/tracking/${token}/notification-logs${query}`);
}

export interface DonationTransferEntry {
  id: string;
  projectId: string;
  donationId: string;
  donorName: string;
  donorDescription: string;
  fromKesimAlaniId: string;
  fromKesimAlaniName: string;
  toKesimAlaniId: string;
  toKesimAlaniName: string;
  removedFromSource: boolean;
  shareCount: number;
  createdAt: string;
}

export async function createDonationTransfers(entries: DonationTransferEntry[]): Promise<{ success: boolean; count: number }> {
  return apiFetch<{ success: boolean; count: number }>("/donation-transfers", {
    method: "POST",
    body: JSON.stringify({ entries }),
  });
}

export async function fetchTransferLog(projectId: string): Promise<DonationTransferEntry[]> {
  return apiFetch<DonationTransferEntry[]>(`/projects/${projectId}/transfer-log`);
}

export interface IntegrityIssue {
  type: string;
  severity: "error" | "warning";
  description: string;
  count: number;
  repairable: boolean;
}

export interface IntegrityReport {
  checkedAt: string;
  totalIssues: number;
  issues: IntegrityIssue[];
}

export interface IntegrityRepairResult {
  repairedAt: string;
  repairs: { type: string; action: string; count: number }[];
  remainingIssues: number;
  remainingDetails: IntegrityIssue[];
}

export async function runIntegrityCheck(): Promise<IntegrityReport> {
  return apiFetch<IntegrityReport>("/integrity/check");
}

export async function repairIntegrity(): Promise<IntegrityRepairResult> {
  return apiFetch<IntegrityRepairResult>("/integrity/repair", { method: "POST" });
}

export interface GlobalSearchResult {
  donationId: string;
  name: string;
  description: string;
  donationType: string;
  vekalet: string;
  notes: string;
  phone: string;
  shareCount: number;
  kesimAlaniId: string;
  kesimAlaniName: string;
  projectId: string | null;
  projectName: string | null;
  animalGroupId: string | null;
  animalNo: number | null;
}

export async function globalSearch(
  q: string,
  column: string = "all",
  projectId?: string
): Promise<GlobalSearchResult[]> {
  const params = new URLSearchParams({ q, column });
  if (projectId) params.set("projectId", projectId);
  return apiFetch<GlobalSearchResult[]>(`/global-search?${params.toString()}`);
}
