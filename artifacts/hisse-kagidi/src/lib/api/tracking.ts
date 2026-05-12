import type { NoteType, NoteStatus } from "../constants";
import { apiFetch, API_BASE } from "./core";

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
  type: NoteType;
  content: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  status: NoteStatus;
  createdAt: string;
}

export async function fetchTrackingNotes(token: string): Promise<TrackingNote[]> {
  return apiFetch<TrackingNote[]>(`/tracking/${token}/notes`);
}

export async function createTrackingNote(token: string, data: {
  animalGroupId?: string;
  type: NoteType;
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

export async function reorderGroups(token: string, orderedIds: string[]): Promise<void> {
  await apiFetch(`/tracking/${token}/reorder`, {
    method: "PUT",
    body: JSON.stringify({ orderedIds }),
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

export async function fetchTrackingNotificationLogs(token: string, since?: string): Promise<NotificationLog[]> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiFetch<NotificationLog[]>(`/tracking/${token}/notification-logs${query}`);
}
