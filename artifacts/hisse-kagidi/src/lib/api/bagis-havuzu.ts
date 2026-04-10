import type { PoolDonation, PoolStats } from "../types";
import { apiFetch } from "./core";

export interface PoolDonationsResponse {
  items: PoolDonation[];
  total: number;
  kesimAlanlari: { id: string; name: string }[];
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
  notesFilter?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
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
  if (filters.notesFilter) params.set("notesFilter", filters.notesFilter);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
  const qs = params.toString();
  return apiFetch<PoolDonationsResponse>(`/projects/${projectId}/donations${qs ? `?${qs}` : ""}`);
}

export async function fetchPoolStats(projectId: string): Promise<PoolStats> {
  return apiFetch<PoolStats>(`/projects/${projectId}/donations/stats`);
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

export async function transferDonationsToKA(projectId: string, donationIds: string[], targetKesimAlaniId: string): Promise<{ success: boolean; moved: number }> {
  return apiFetch<{ success: boolean; moved: number }>(`/projects/${projectId}/donations/transfer`, {
    method: "POST",
    body: JSON.stringify({ donationIds, targetKesimAlaniId }),
  });
}

export async function bulkActionDonations(projectId: string, donationIds: string[], action: "exclude" | "include" | "delete"): Promise<{ success: boolean; affected: number }> {
  return apiFetch<{ success: boolean; affected: number }>(`/projects/${projectId}/donations/bulk-action`, {
    method: "POST",
    body: JSON.stringify({ donationIds, action }),
  });
}

export async function checkVekaletConflicts(projectId: string, vekalets: string[]): Promise<{ conflicts: Array<{ vekalet: string; id: string; name: string; kesimAlaniId: string }> }> {
  return apiFetch<{ conflicts: Array<{ vekalet: string; id: string; name: string; kesimAlaniId: string }> }>(
    `/projects/${projectId}/donations/vekalet-check`, {
      method: "POST",
      body: JSON.stringify({ vekalets }),
    }
  );
}
