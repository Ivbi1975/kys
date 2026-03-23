import type { KesimAlani } from "./types";

const STORAGE_KEY = "hisse-kagidi-data";

export function loadKesimAlanlari(): KesimAlani[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
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
