import type { KesimAlani } from "../types";
import { apiFetch } from "./core";
import { buildSignedPhotoUrl } from "./signed-url";

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
