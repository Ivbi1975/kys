import type { KesimAlani } from "../types";
import { apiFetch, getApiKey, API_BASE } from "./core";

export interface ExportScope {
  kaId?: string;
  projectId?: string;
}

function buildScopeQuery(scope?: ExportScope): string {
  if (!scope) return "";
  if (scope.kaId) return `?kaId=${encodeURIComponent(scope.kaId)}`;
  if (scope.projectId) return `?projectId=${encodeURIComponent(scope.projectId)}`;
  return "";
}

export async function fetchExportCount(scope?: ExportScope | string): Promise<{ total: number }> {
  const normalized: ExportScope | undefined = typeof scope === "string" ? { kaId: scope } : scope;
  const qs = buildScopeQuery(normalized);
  return apiFetch<{ total: number }>(`/export/count${qs}`);
}

export async function downloadCsvExport(
  scope: ExportScope | string | undefined,
  onProgress?: (received: number, total: number) => void,
): Promise<Blob> {
  const normalized: ExportScope | undefined = typeof scope === "string" ? { kaId: scope } : scope;
  const qs = buildScopeQuery(normalized);
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

export async function downloadExcelExport(
  scope: ExportScope | string,
  onProgress?: (phase: string) => void,
): Promise<Blob> {
  const normalized: ExportScope = typeof scope === "string" ? { kaId: scope } : scope;
  const qs = buildScopeQuery(normalized);
  if (!qs) throw new Error("Excel export için kaId veya projectId gerekli");
  const apiKey = getApiKey();
  const fetchHeaders: Record<string, string> = {};
  if (apiKey) {
    fetchHeaders["X-API-Key"] = apiKey;
  }
  onProgress?.("Sunucudan Excel oluşturuluyor...");
  const res = await fetch(`${API_BASE}/export/excel${qs}`, {
    headers: fetchHeaders,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Excel export hatası" }));
    throw new Error(err.error || "Excel export hatası");
  }

  onProgress?.("İndiriliyor...");
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Stream desteklenmiyor");

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return new Blob(chunks as BlobPart[], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
  batchId?: string;
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

export async function createTeam(kesimAlaniId: string, name: string, color: string): Promise<import("./tracking").TrackingTeam> {
  return apiFetch<import("./tracking").TrackingTeam>(`/kesim-alanlari/${kesimAlaniId}/teams`, {
    method: "POST",
    body: JSON.stringify({ name, color }),
  });
}

export async function updateTeam(kesimAlaniId: string, teamId: string, data: { name?: string; color?: string }): Promise<import("./tracking").TrackingTeam> {
  return apiFetch<import("./tracking").TrackingTeam>(`/kesim-alanlari/${kesimAlaniId}/teams/${teamId}`, {
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
  transferType?: "donation" | "animalGroup";
  animalGroupId?: string;
  animalNo?: number;
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

export interface FlaggedDonation {
  id: string;
  name: string;
  description: string;
  donationType: string;
  shareCount: number;
  vekalet: string;
  notes: string;
  phone: string;
  excluded: boolean;
  isFlagged: boolean;
  flagReason: string;
  aiWarnings: string;
  aiCategories: string[];
  kesimAlaniId: string;
  kesimAlaniName: string;
  groups: { groupId: string; animalNo: number; slotIndex: number }[];
  flagResolvedAt: string | null;
  problemType: "manual" | "ai_warning" | "resolved";
}

export async function flagDonation(projectId: string, donationId: string, reason: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/projects/${projectId}/donations/${donationId}/flag`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function unflagDonation(projectId: string, donationId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/projects/${projectId}/donations/${donationId}/unflag`, {
    method: "POST",
  });
}

export async function fetchFlaggedDonations(projectId: string): Promise<{ items: FlaggedDonation[] }> {
  return apiFetch<{ items: FlaggedDonation[] }>(`/projects/${projectId}/flagged-donations`);
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

export interface ConflictLogEntry {
  id: string;
  projectId: string | null;
  donationId: string | null;
  donationName: string;
  vekalet: string;
  sourceKesimAlaniId: string | null;
  sourceKesimAlaniName: string;
  targetKesimAlaniId: string | null;
  targetKesimAlaniName: string;
  conflictType: string;
  detectedAt: string;
  resolution: string | null;
  resolvedAt: string | null;
}

export async function fetchConflictLog(projectId: string): Promise<ConflictLogEntry[]> {
  return apiFetch<ConflictLogEntry[]>(`/projects/${projectId}/conflict-log`);
}

export async function undoTransfer(payload: {
  batchId: string;
  projectId: string;
}): Promise<{ success: boolean; count: number }> {
  return apiFetch<{ success: boolean; count: number }>("/kesim-alanlari/undo-transfer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function restoreNotes(
  projectId: string,
  restores: { donationId: string; notes: string }[],
): Promise<{ success: boolean; affected: number }> {
  return apiFetch<{ success: boolean; affected: number }>(`/projects/${projectId}/donations/restore-notes`, {
    method: "POST",
    body: JSON.stringify({ restores }),
  });
}

export async function syncAiTagsToKesim(kaId: string): Promise<{ synced: number }> {
  return apiFetch<{ synced: number }>(`/ai-notes/sync-to-kesim/${kaId}`, {
    method: "POST",
  });
}
