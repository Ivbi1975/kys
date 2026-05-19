import type { KesimAlani, CustomTag, TagCategory } from "../types";
import { apiFetch } from "./core";
import { fetchKesimAlanlari, createKesimAlani } from "./kesim-alanlari";

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

export async function fetchTagCategories(): Promise<TagCategory[]> {
  return apiFetch<TagCategory[]>("/tag-categories");
}

export async function createTagCategory(category: TagCategory): Promise<TagCategory> {
  return apiFetch<TagCategory>("/tag-categories", {
    method: "POST",
    body: JSON.stringify(category),
  });
}

export async function updateTagCategory(category: TagCategory): Promise<TagCategory> {
  return apiFetch<TagCategory>(`/tag-categories/${category.id}`, {
    method: "PUT",
    body: JSON.stringify(category),
  });
}

export async function deleteTagCategoryApi(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/tag-categories/${id}`, { method: "DELETE" });
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

export async function fetchNotificationLogs(kesimAlaniId: string): Promise<import("./tracking").NotificationLog[]> {
  return apiFetch<import("./tracking").NotificationLog[]>(`/kesim-alanlari/${kesimAlaniId}/notification-logs`);
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
