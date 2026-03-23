import type { KesimAlani, Donation } from "./types";

const STORAGE_KEY = "hisse-kagidi-data";

function migrateDonation(d: Partial<Donation>): Donation {
  return {
    id: d.id || "",
    name: d.name || "",
    description: d.description || "",
    donationType: d.donationType || "",
    shareCount: d.shareCount || 1,
    vekalet: d.vekalet || "",
    notes: d.notes || "",
    excluded: d.excluded ?? false,
    tags: d.tags ?? [],
  };
}

export function loadKesimAlanlari(): KesimAlani[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data) as KesimAlani[];
      return parsed.map((k) => ({
        ...k,
        donations: k.donations.map(migrateDonation),
        animalGroups: k.animalGroups.map((g) => ({
          ...g,
          donations: g.donations.map(migrateDonation),
        })),
      }));
    }
  } catch {}
  return [];
}

export function saveKesimAlanlari(data: KesimAlani[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getKesimAlani(id: string): KesimAlani | undefined {
  return loadKesimAlanlari().find((k) => k.id === id);
}

export function updateKesimAlani(updated: KesimAlani): void {
  const all = loadKesimAlanlari();
  const idx = all.findIndex((k) => k.id === updated.id);
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push(updated);
  }
  saveKesimAlanlari(all);
}

export function deleteKesimAlani(id: string): void {
  saveKesimAlanlari(loadKesimAlanlari().filter((k) => k.id !== id));
}

const LOGO_KEY = "hisse-kagidi-logo";

export function saveLogo(base64: string): void {
  localStorage.setItem(LOGO_KEY, base64);
}

export function loadLogo(): string | null {
  return localStorage.getItem(LOGO_KEY);
}

export function deleteLogo(): void {
  localStorage.removeItem(LOGO_KEY);
}

export function exportBackup(): string {
  const data = {
    version: 1,
    timestamp: new Date().toISOString(),
    kesimAlanlari: loadKesimAlanlari(),
    logo: loadLogo(),
  };
  return JSON.stringify(data, null, 2);
}

const PRINT_PREFS_KEY = "hisse-kagidi-print-prefs";

export interface PrintPreferences {
  hiddenColumns: string[];
  contentHideRules: Record<string, string[]>;
}

export const DEFAULT_PRINT_PREFS: PrintPreferences = {
  hiddenColumns: [],
  contentHideRules: {
    "vekaleti-veren": ["Vacip", "VACİB", "vacib", "Vacib"],
  },
};

export function savePrintPreferences(prefs: PrintPreferences): void {
  localStorage.setItem(PRINT_PREFS_KEY, JSON.stringify(prefs));
}

const VALID_COLUMN_KEYS = ["hayvan", "sira", "vekalet", "vekaleti-veren", "adina-kesilen", "cinsi", "notlar"];

export function loadPrintPreferences(): PrintPreferences {
  try {
    const data = localStorage.getItem(PRINT_PREFS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      const hiddenColumns = Array.isArray(parsed.hiddenColumns)
        ? parsed.hiddenColumns.filter((k: unknown) => typeof k === "string" && VALID_COLUMN_KEYS.includes(k as string))
        : [];
      const contentHideRules: Record<string, string[]> = {};
      if (parsed.contentHideRules && typeof parsed.contentHideRules === "object") {
        for (const [key, val] of Object.entries(parsed.contentHideRules)) {
          if (VALID_COLUMN_KEYS.includes(key) && Array.isArray(val) && val.every((v) => typeof v === "string")) {
            contentHideRules[key] = val as string[];
          }
        }
      }
      return { hiddenColumns, contentHideRules };
    }
  } catch {}
  return { ...DEFAULT_PRINT_PREFS, contentHideRules: { ...DEFAULT_PRINT_PREFS.contentHideRules } };
}

export function resetPrintPreferences(): void {
  localStorage.removeItem(PRINT_PREFS_KEY);
}

export function importBackup(json: string): { success: boolean; count: number; error?: string } {
  try {
    const data = JSON.parse(json);
    if (!data.kesimAlanlari || !Array.isArray(data.kesimAlanlari)) {
      return { success: false, count: 0, error: "Geçersiz yedek dosyası" };
    }
    const validated = data.kesimAlanlari.map((k: any) => ({
      id: k.id || Math.random().toString(36).substring(2, 12),
      name: k.name || "İsimsiz",
      donations: Array.isArray(k.donations) ? k.donations.map(migrateDonation) : [],
      animalGroups: Array.isArray(k.animalGroups) ? k.animalGroups.map((g: any) => ({
        id: g.id || Math.random().toString(36).substring(2, 12),
        animalNo: g.animalNo || 0,
        donations: Array.isArray(g.donations) ? g.donations.map(migrateDonation) : [],
        colorTag: g.colorTag || "",
        locked: g.locked || false,
        notes: g.notes || "",
      })) : [],
      createdAt: k.createdAt || new Date().toISOString(),
    }));
    saveKesimAlanlari(validated);
    if (data.logo) {
      saveLogo(data.logo);
    } else {
      deleteLogo();
    }
    return { success: true, count: validated.length };
  } catch {
    return { success: false, count: 0, error: "Dosya okunamadı" };
  }
}
