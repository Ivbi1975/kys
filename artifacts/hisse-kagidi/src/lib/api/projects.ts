import type { Project } from "../types";
import { apiFetch } from "./core";

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
