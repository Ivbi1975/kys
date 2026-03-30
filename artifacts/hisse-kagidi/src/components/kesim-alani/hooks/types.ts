import type { KesimAlani, Donation } from "@/lib/types";

export type SortField = "name" | "description" | "donationType" | "shareCount";

export interface BasketItem {
  donationId: string;
  kesimAlaniId: string;
  kesimAlaniName: string;
  name: string;
  description: string;
}

export type SaveFn = (
  updated: KesimAlani,
  desc?: string,
  immediate?: boolean,
  saveType?: "full" | "donations" | "groups"
) => void;

export interface KesimDeps {
  kesim: KesimAlani | null;
  setKesim: React.Dispatch<React.SetStateAction<KesimAlani | null>>;
  save: SaveFn;
  history: { push: (data: KesimAlani, desc: string) => void; initialize: (data: KesimAlani) => void };
  toast: (opts: { title: string; description?: string | React.ReactNode; variant?: "default" | "destructive" }) => void;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export const BASKET_STORAGE_KEY = "kurban-basket";

export function loadBasketFromStorage(projectId: string | null | undefined): BasketItem[] {
  try {
    const key = projectId ? `${BASKET_STORAGE_KEY}-${projectId}` : BASKET_STORAGE_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveBasketToStorage(items: BasketItem[], projectId: string | null | undefined) {
  try {
    const key = projectId ? `${BASKET_STORAGE_KEY}-${projectId}` : BASKET_STORAGE_KEY;
    if (items.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(items));
    }
  } catch {}
}
