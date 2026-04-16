import type { KesimAlani, Donation } from "../types";
import { apiFetch } from "./core";
import { buildSignedPhotoUrl } from "./signed-url";

export async function fetchKesimAlanlari(projectId?: string | null): Promise<KesimAlani[]> {
  const url = projectId ? `/kesim-alanlari?projectId=${encodeURIComponent(projectId)}` : "/kesim-alanlari";
  return apiFetch<KesimAlani[]>(url);
}

export async function fetchDeletedKesimAlanlari(): Promise<KesimAlani[]> {
  return apiFetch<KesimAlani[]>("/kesim-alanlari/deleted");
}

interface CompactAnimalGroup {
  id: string;
  animalNo: number;
  donationIds: string[];
  colorTag?: string;
  locked?: boolean;
  notes?: string;
  kesildi?: boolean;
  kesildiAt?: string | null;
  teamId?: string | null;
  updatedAt?: string;
}

interface CompactKesimAlani extends Omit<KesimAlani, "animalGroups"> {
  animalGroups: CompactAnimalGroup[];
  _compact?: boolean;
}

function reconstructFromCompact(data: CompactKesimAlani): KesimAlani {
  const donationsById = new Map<string, KesimAlani["donations"][0]>();
  for (const d of data.donations) {
    donationsById.set(d.id, d);
  }
  const animalGroups = data.animalGroups.map(g => ({
    id: g.id,
    animalNo: g.animalNo,
    colorTag: g.colorTag,
    locked: g.locked,
    notes: g.notes,
    kesildi: g.kesildi,
    kesildiAt: g.kesildiAt,
    teamId: g.teamId,
    updatedAt: g.updatedAt,
    donations: g.donationIds.map(did => donationsById.get(did)).filter(Boolean) as KesimAlani["donations"],
  }));
  const { _compact, ...rest } = data;
  return { ...rest, animalGroups } as KesimAlani;
}

export async function fetchKesimAlani(id: string): Promise<KesimAlani | null> {
  try {
    const raw = await apiFetch<CompactKesimAlani | KesimAlani>(`/kesim-alanlari/${id}?compact=1`);
    if (raw && "_compact" in raw && raw._compact) {
      return reconstructFromCompact(raw as CompactKesimAlani);
    }
    return raw as KesimAlani;
  } catch (err) {
    console.warn(`fetchKesimAlani(${id}) failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export interface KesimAlaniMeta {
  id: string;
  name: string;
  createdAt: string;
  deletedAt: string | null;
  projectId: string | null;
  trackingToken: string | null;
  kesimListeId: string | null;
  parentKesimAlaniId: string | null;
  splitStatus: string | null;
  teams: { id: string; name: string; color: string }[];
  donationCount: number;
  groupCount: number;
}

export async function fetchKesimAlaniMeta(id: string): Promise<KesimAlaniMeta | null> {
  try {
    return await apiFetch<KesimAlaniMeta>(`/kesim-alanlari/${id}/meta`);
  } catch {
    return null;
  }
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function fetchDonationsPage(
  kaId: string,
  limit = 500,
  cursor: string | null = null,
): Promise<PaginatedResult<Donation>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiFetch<PaginatedResult<Donation>>(`/kesim-alanlari/${kaId}/donations?${params}`);
}

interface CompactGroupItem {
  id: string;
  animalNo: number;
  colorTag?: string;
  locked?: boolean;
  notes?: string;
  kesildi?: boolean;
  kesildiAt?: string | null;
  teamId?: string | null;
  updatedAt?: string | null;
  donationIds: string[];
  donationCount: number;
}

export async function fetchGroupsPageCompact(
  kaId: string,
  limit = 100,
  cursor: string | null = null,
): Promise<PaginatedResult<CompactGroupItem>> {
  const params = new URLSearchParams({ limit: String(limit), compact: "1" });
  if (cursor) params.set("cursor", cursor);
  return apiFetch<PaginatedResult<CompactGroupItem>>(`/kesim-alanlari/${kaId}/groups?${params}`);
}

export async function fetchAllDonations(
  kaId: string,
  onPage?: (accumulated: Donation[], pageItems: Donation[]) => void,
): Promise<Donation[]> {
  const all: Donation[] = [];
  let cursor: string | null = null;
  let hasMore = true;
  while (hasMore) {
    const page = await fetchDonationsPage(kaId, 500, cursor);
    all.push(...page.items);
    onPage?.(all, page.items);
    cursor = page.nextCursor;
    hasMore = page.hasMore;
  }
  return all;
}

export async function fetchAllGroupsCompact(
  kaId: string,
  onPage?: (accumulated: CompactGroupItem[], pageItems: CompactGroupItem[]) => void,
): Promise<CompactGroupItem[]> {
  const all: CompactGroupItem[] = [];
  let cursor: string | null = null;
  let hasMore = true;
  while (hasMore) {
    const page = await fetchGroupsPageCompact(kaId, 200, cursor);
    all.push(...page.items);
    onPage?.(all, page.items);
    cursor = page.nextCursor;
    hasMore = page.hasMore;
  }
  return all;
}

export type { CompactGroupItem };

export async function createKesimAlani(data: KesimAlani & { projectId?: string | null }): Promise<KesimAlani> {
  return apiFetch<KesimAlani>("/kesim-alanlari", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

const DONATION_CHUNK_THRESHOLD = 3000;
const DONATION_CHUNK_SIZE = 2000;

export async function apiUpdateKesimAlani(
  data: KesimAlani,
  onChunkProgress?: (progress: ChunkProgress) => void,
): Promise<KesimAlani> {
  const donationCount = data.donations?.length ?? 0;

  if (donationCount <= DONATION_CHUNK_THRESHOLD) {
    return apiFetch<KesimAlani>(`/kesim-alanlari/${data.id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  const donations = data.donations;
  const totalChunks = Math.ceil(donations.length / DONATION_CHUNK_SIZE);
  const allDonationIds = donations.map(d => d.id);
  let lastResult: unknown = null;
  let savedCount = 0;

  for (let i = 0; i < totalChunks; i++) {
    const chunk = donations.slice(i * DONATION_CHUNK_SIZE, (i + 1) * DONATION_CHUNK_SIZE);
    const payload: Record<string, unknown> = {
      donations: chunk,
      chunkIndex: i,
      totalChunks,
      sortOrderOffset: i * DONATION_CHUNK_SIZE,
    };
    if (i === 0) {
      payload.allDonationIds = allDonationIds;
      if (data.name) payload.name = data.name;
      if (data.kesimListeId !== undefined) payload.kesimListeId = data.kesimListeId;
    }

    const result = await apiFetch<{ chunkIndex: number; totalChunks: number; savedCount: number; data?: KesimAlani }>(
      `/kesim-alanlari/${data.id}/update-chunked`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
    savedCount += result.savedCount;
    lastResult = result;
    onChunkProgress?.({ chunkIndex: i, totalChunks, savedCount, totalGroups: donations.length });
  }

  if (data.animalGroups !== undefined) {
    return apiUpdateBulkAnimalGroups(data.id, data.animalGroups, onChunkProgress ? (progress) => {
      onChunkProgress({ ...progress, savedCount: savedCount + progress.savedCount });
    } : undefined);
  }

  const finalResult = lastResult as { data?: KesimAlani };
  if (finalResult?.data) {
    return finalResult.data;
  }
  return apiFetch<KesimAlani>(`/kesim-alanlari/${data.id}`);
}

const CHUNK_SIZE = 500;

export interface ChunkProgress {
  chunkIndex: number;
  totalChunks: number;
  savedCount: number;
  totalGroups: number;
}

export async function apiUpdateBulkAnimalGroups(
  kesimAlaniId: string,
  animalGroups: KesimAlani["animalGroups"],
  onChunkProgress?: (progress: ChunkProgress) => void,
): Promise<KesimAlani> {
  const groupsWithSortOrder = animalGroups.map((g, i) => ({
    ...g,
    sortOrder: i,
  }));

  if (groupsWithSortOrder.length <= CHUNK_SIZE) {
    return apiFetch<KesimAlani>(`/kesim-alanlari/${kesimAlaniId}/animal-groups/bulk`, {
      method: "PUT",
      body: JSON.stringify({ animalGroups: groupsWithSortOrder }),
    });
  }

  const totalChunks = Math.ceil(groupsWithSortOrder.length / CHUNK_SIZE);
  const saveSessionId = `${kesimAlaniId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let savedCount = 0;
  let lastResult: unknown = null;

  for (let i = 0; i < totalChunks; i++) {
    const chunk = groupsWithSortOrder.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    try {
      const result = await apiFetch<{ chunkIndex: number; totalChunks: number; savedCount: number; saveSessionId: string; data?: KesimAlani }>(
        `/kesim-alanlari/${kesimAlaniId}/animal-groups/bulk-chunked`,
        {
          method: "PUT",
          body: JSON.stringify({ animalGroups: chunk, chunkIndex: i, totalChunks, saveSessionId }),
        },
      );
      savedCount += result.savedCount;
      lastResult = result;
      onChunkProgress?.({ chunkIndex: i, totalChunks, savedCount, totalGroups: animalGroups.length });
    } catch (err) {
      const baseMsg = err instanceof Error ? err.message : "Bilinmeyen hata";
      throw new Error(`Kaydetme ${i + 1}/${totalChunks} parçasında başarısız oldu: ${baseMsg}`);
    }
  }

  const finalResult = lastResult as { data?: KesimAlani };
  if (finalResult?.data) {
    return finalResult.data;
  }
  return apiFetch<KesimAlani>(`/kesim-alanlari/${kesimAlaniId}`);
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

export async function apiDeleteAnimalGroup(kesimAlaniId: string, groupId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/kesim-alanlari/${kesimAlaniId}/animal-groups/${groupId}`, { method: "DELETE" });
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

export async function moveKesimAlani(kesimAlaniId: string, projectId: string | null): Promise<KesimAlani> {
  return apiFetch<KesimAlani>(`/kesim-alanlari/${kesimAlaniId}/move`, {
    method: "PUT",
    body: JSON.stringify({ projectId }),
  });
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

export async function apiCreateDonation(
  kesimAlaniId: string,
  donation: { id: string; name: string; description: string; donationType: string; shareCount: number; vekalet: string; notes: string }
): Promise<unknown> {
  return apiFetch(`/kesim-alanlari/${kesimAlaniId}/donations`, {
    method: "POST",
    body: JSON.stringify(donation),
  });
}

export async function moveDonationsToKesimAlani(donationIds: string[], sourceKesimAlaniId: string, targetKesimAlaniId: string): Promise<{ success: boolean; count: number; skipped: number; movedIds: string[] }> {
  return apiFetch<{ success: boolean; count: number; skipped: number; movedIds: string[] }>("/kesim-alanlari/move-donations", {
    method: "POST",
    body: JSON.stringify({ donationIds, sourceKesimAlaniId, targetKesimAlaniId }),
  });
}

export async function moveAnimalGroupToKesimAlani(animalGroupId: string, sourceKesimAlaniId: string, targetKesimAlaniId: string, lastUpdatedAt?: string): Promise<{ success: boolean; animalGroupId: string; newAnimalNo: number }> {
  return apiFetch<{ success: boolean; animalGroupId: string; newAnimalNo: number }>("/kesim-alanlari/move-animal-group", {
    method: "POST",
    body: JSON.stringify({ animalGroupId, sourceKesimAlaniId, targetKesimAlaniId, lastUpdatedAt }),
  });
}

export async function generateTrackingToken(kesimAlaniId: string): Promise<string> {
  const data = await apiFetch<{ trackingToken: string }>(`/kesim-alanlari/${kesimAlaniId}/generate-tracking-token`, {
    method: "POST",
  });
  return data.trackingToken;
}

export async function fetchPhotoCountsAdmin(kesimAlaniId: string): Promise<Record<string, number>> {
  return apiFetch<Record<string, number>>(`/kesim-alanlari/${kesimAlaniId}/photos/counts`);
}

export async function fetchKesimAlaniTrackingNotes(kesimAlaniId: string): Promise<import("./tracking").TrackingNote[]> {
  return apiFetch<import("./tracking").TrackingNote[]>(`/kesim-alanlari/${kesimAlaniId}/tracking-notes`);
}

export async function updateTrackingNoteStatus(kesimAlaniId: string, noteId: string, status: import("../constants").NoteStatus): Promise<void> {
  await apiFetch(`/kesim-alanlari/${kesimAlaniId}/tracking-notes/${noteId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export interface SplitTarget {
  name: string;
  kesimListeId: string;
  hayvanSayisi: number;
}

export interface SplitResult {
  parent: KesimAlani;
  children: KesimAlani[];
}

export async function splitKesimAlani(id: string, targets: SplitTarget[]): Promise<SplitResult> {
  return apiFetch<SplitResult>(`/kesim-alanlari/${id}/split`, {
    method: "POST",
    body: JSON.stringify({ targets }),
  });
}

export async function fetchGroupPhotosAdmin(kesimAlaniId: string, groupId: string): Promise<import("./tracking").GroupPhoto[]> {
  return apiFetch<import("./tracking").GroupPhoto[]>(`/kesim-alanlari/${kesimAlaniId}/group/${groupId}/photos`);
}

export function getGroupPhotoUrlAdmin(kesimAlaniId: string, groupId: string, photoId: string, size?: "thumb"): string {
  const path = `/kesim-alanlari/${kesimAlaniId}/group/${groupId}/photos/${photoId}`;
  const extraParams = size ? new URLSearchParams({ size }) : undefined;
  return buildSignedPhotoUrl(path, extraParams);
}
