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
