import type { Project, KesimAlani, CustomTag } from "../types";
import { apiFetch } from "./core";

export interface HomeData {
  kesimAlanlari: KesimAlani[];
  deletedKesimAlanlari: KesimAlani[];
  tags: CustomTag[];
  logo: string | null;
  projects: Project[];
  deletedProjects: Project[];
  archivedProjects: Project[];
}

interface HomeDataCache {
  data: HomeData;
  expiresAt: number;
}

let homeDataCache: HomeDataCache | null = null;
const HOME_DATA_TTL_MS = 30_000;

export function invalidateHomeDataCache(): void {
  homeDataCache = null;
  window.dispatchEvent(new Event("homedata-invalidated"));
}

export async function fetchHomeData(): Promise<HomeData> {
  if (homeDataCache && Date.now() < homeDataCache.expiresAt) {
    return homeDataCache.data;
  }
  const data = await apiFetch<HomeData>("/home-data");
  homeDataCache = { data, expiresAt: Date.now() + HOME_DATA_TTL_MS };
  return data;
}

export async function fetchProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/projects");
}

export async function fetchProject(id: string): Promise<Project | null> {
  try {
    return await apiFetch<Project>(`/projects/${id}`);
  } catch {
    return null;
  }
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

export async function permanentDeleteProject(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/projects/${id}?permanent=true`, { method: "DELETE" });
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
