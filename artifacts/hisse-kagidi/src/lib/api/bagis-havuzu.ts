import type { PoolDonation, PoolStats } from "../types";
import { apiFetch } from "./core";

export interface PoolDonationsResponse {
  items: PoolDonation[];
  total: number;
  kesimAlanlari: { id: string; name: string }[];
  allFilteredIds: string[];
}

export interface PoolFilters {
  search?: string;
  status?: string;
  donationType?: string;
  birim?: string;
  temsilci?: string;
  kesimAlaniId?: string;
  aiCategory?: string;
  ozellik?: string;
  fiyat?: string;
  yerTalebi?: string;
  gunTalebi?: string;
  ilkHayvan?: string;
  safi?: string;
  tagIds?: string;
  notesFilter?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  sortBy2?: string;
  sortDir2?: "asc" | "desc";
  sortBy3?: string;
  sortDir3?: "asc" | "desc";
  limit?: number;
  offset?: number;
  shareCountMin?: number;
  shareCountMax?: number;
  excludeFields?: string;
  dateField?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchPoolDonations(projectId: string, filters: PoolFilters = {}): Promise<PoolDonationsResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.donationType) params.set("donationType", filters.donationType);
  if (filters.birim) params.set("birim", filters.birim);
  if (filters.temsilci) params.set("temsilci", filters.temsilci);
  if (filters.kesimAlaniId) params.set("kesimAlaniId", filters.kesimAlaniId);
  if (filters.aiCategory) params.set("aiCategory", filters.aiCategory);
  if (filters.ozellik) params.set("ozellik", filters.ozellik);
  if (filters.fiyat) params.set("fiyat", filters.fiyat);
  if (filters.yerTalebi) params.set("yerTalebi", filters.yerTalebi);
  if (filters.gunTalebi) params.set("gunTalebi", filters.gunTalebi);
  if (filters.ilkHayvan) params.set("ilkHayvan", filters.ilkHayvan);
  if (filters.safi) params.set("safi", filters.safi);
  if (filters.tagIds) params.set("tagIds", filters.tagIds);
  if (filters.notesFilter) params.set("notesFilter", filters.notesFilter);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  if (filters.sortBy2) params.set("sortBy2", filters.sortBy2);
  if (filters.sortDir2) params.set("sortDir2", filters.sortDir2);
  if (filters.sortBy3) params.set("sortBy3", filters.sortBy3);
  if (filters.sortDir3) params.set("sortDir3", filters.sortDir3);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
  if (filters.shareCountMin !== undefined) params.set("shareCountMin", String(filters.shareCountMin));
  if (filters.shareCountMax !== undefined) params.set("shareCountMax", String(filters.shareCountMax));
  if (filters.excludeFields) params.set("excludeFields", filters.excludeFields);
  if (filters.dateField) params.set("dateField", filters.dateField);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const qs = params.toString();
  return apiFetch<PoolDonationsResponse>(`/projects/${projectId}/donations${qs ? `?${qs}` : ""}`);
}

export type StatsFilters = Omit<PoolFilters, 'sortBy' | 'sortDir' | 'sortBy2' | 'sortDir2' | 'sortBy3' | 'sortDir3' | 'limit' | 'offset'>;

export async function fetchPoolStats(projectId: string, filters: StatsFilters = {}): Promise<PoolStats> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.donationType) params.set("donationType", filters.donationType);
  if (filters.birim) params.set("birim", filters.birim);
  if (filters.temsilci) params.set("temsilci", filters.temsilci);
  if (filters.kesimAlaniId) params.set("kesimAlaniId", filters.kesimAlaniId);
  if (filters.aiCategory) params.set("aiCategory", filters.aiCategory);
  if (filters.ozellik) params.set("ozellik", filters.ozellik);
  if (filters.fiyat) params.set("fiyat", filters.fiyat);
  if (filters.yerTalebi) params.set("yerTalebi", filters.yerTalebi);
  if (filters.gunTalebi) params.set("gunTalebi", filters.gunTalebi);
  if (filters.ilkHayvan) params.set("ilkHayvan", filters.ilkHayvan);
  if (filters.safi) params.set("safi", filters.safi);
  if (filters.tagIds) params.set("tagIds", filters.tagIds);
  if (filters.notesFilter) params.set("notesFilter", filters.notesFilter);
  if (filters.shareCountMin !== undefined) params.set("shareCountMin", String(filters.shareCountMin));
  if (filters.shareCountMax !== undefined) params.set("shareCountMax", String(filters.shareCountMax));
  if (filters.excludeFields) params.set("excludeFields", filters.excludeFields);
  if (filters.dateField) params.set("dateField", filters.dateField);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const qs = params.toString();
  return apiFetch<PoolStats>(`/projects/${projectId}/donations/stats${qs ? `?${qs}` : ""}`);
}

export type ImportDonationPayload = {
  id: string; name: string; description: string; donationType: string;
  shareCount: number; vekalet: string; notes: string; phone: string;
  birim: string; temsilci: string; ozellik: string; fiyat: string;
  yerTalebi: string; gunTalebi: string; ilkHayvan: string; safi: string;
};

const IMPORT_CHUNK_SIZE = 5000;

export async function bulkImportDonations(
  projectId: string,
  donations: ImportDonationPayload[],
  onProgress?: (inserted: number, total: number, chunkIndex: number, totalChunks: number) => void,
): Promise<{ success: boolean; inserted: number }> {
  if (donations.length <= IMPORT_CHUNK_SIZE) {
    return apiFetch<{ success: boolean; inserted: number }>(`/projects/${projectId}/donations/bulk-import`, {
      method: "POST",
      body: JSON.stringify({ donations }),
    });
  }

  let totalInserted = 0;
  const totalChunks = Math.ceil(donations.length / IMPORT_CHUNK_SIZE);

  for (let i = 0; i < donations.length; i += IMPORT_CHUNK_SIZE) {
    const chunk = donations.slice(i, i + IMPORT_CHUNK_SIZE);
    const chunkIndex = Math.floor(i / IMPORT_CHUNK_SIZE);
    const result = await apiFetch<{ success: boolean; inserted: number }>(`/projects/${projectId}/donations/bulk-import`, {
      method: "POST",
      body: JSON.stringify({ donations: chunk }),
    });
    totalInserted += result.inserted;
    onProgress?.(totalInserted, donations.length, chunkIndex + 1, totalChunks);
  }

  return { success: true, inserted: totalInserted };
}

export interface TransferredItem {
  id: string;
  name: string;
  description: string;
  donationType: string;
  shareCount: number;
  vekalet: string;
  notes: string;
}

export async function transferDonationsToKA(
  projectId: string,
  donationIds: string[],
  targetKesimAlaniId: string,
  skipExisting?: boolean,
): Promise<{ success: boolean; moved: number; alreadyInTarget?: number; skipped?: number; transferredItems?: TransferredItem[] }> {
  return apiFetch<{ success: boolean; moved: number; alreadyInTarget?: number; skipped?: number; transferredItems?: TransferredItem[] }>(`/projects/${projectId}/donations/transfer`, {
    method: "POST",
    body: JSON.stringify({ donationIds, targetKesimAlaniId, skipExisting }),
  });
}

export async function bulkActionDonations(projectId: string, donationIds: string[], action: "exclude" | "include" | "delete"): Promise<{ success: boolean; affected: number }> {
  return apiFetch<{ success: boolean; affected: number }>(`/projects/${projectId}/donations/bulk-action`, {
    method: "POST",
    body: JSON.stringify({ donationIds, action }),
  });
}

export async function bulkTagDonations(
  projectId: string,
  donationIds: string[],
  tagId: string,
  action: "add" | "remove" = "add",
): Promise<{ success: boolean; affected: number }> {
  return apiFetch<{ success: boolean; affected: number }>(`/projects/${projectId}/donations/bulk-tag`, {
    method: "POST",
    body: JSON.stringify({ donationIds, tagId, action }),
  });
}

export async function bulkNoteDonations(
  projectId: string,
  donationIds: string[],
  note: string,
  mode: "append" | "replace" = "append",
): Promise<{ success: boolean; affected: number }> {
  return apiFetch<{ success: boolean; affected: number }>(`/projects/${projectId}/donations/bulk-notes`, {
    method: "POST",
    body: JSON.stringify({ donationIds, note, mode }),
  });
}

export interface VekaletConflict {
  vekalet: string;
  id: string;
  name: string;
  kesimAlaniId: string;
  kesimAlaniName: string;
}

export async function updatePoolDonationField(
  projectId: string,
  donationId: string,
  field: string,
  value: string | number,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/projects/${projectId}/donations/${donationId}`, {
    method: "PATCH",
    body: JSON.stringify({ field, value }),
  });
}

export async function checkVekaletConflicts(projectId: string, vekalets: string[]): Promise<{ conflicts: VekaletConflict[] }> {
  return apiFetch<{ conflicts: VekaletConflict[] }>(
    `/projects/${projectId}/donations/vekalet-check`, {
      method: "POST",
      body: JSON.stringify({ vekalets }),
    }
  );
}

export async function deleteAllPoolDonations(projectId: string): Promise<{ success: boolean; affected: number }> {
  return apiFetch<{ success: boolean; affected: number }>(`/projects/${projectId}/donations`, {
    method: "DELETE",
  });
}
