import type { KesimAlani, CustomTag } from "./types";

const API_BASE = import.meta.env.BASE_URL
  ? `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/").replace(/\/$/, "")
  : "/api";

interface ApiError {
  error: string;
  details?: unknown;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({ error: "Sunucu hatası" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
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

export async function createKesimAlani(data: KesimAlani): Promise<KesimAlani> {
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

export async function apiUpdateDonationsOnly(data: KesimAlani): Promise<KesimAlani> {
  return apiFetch<KesimAlani>(`/kesim-alanlari/${data.id}`, {
    method: "PUT",
    body: JSON.stringify({ donations: data.donations }),
  });
}

export async function apiUpdateGroupsOnly(data: KesimAlani): Promise<KesimAlani> {
  return apiFetch<KesimAlani>(`/kesim-alanlari/${data.id}`, {
    method: "PUT",
    body: JSON.stringify({ animalGroups: data.animalGroups }),
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
