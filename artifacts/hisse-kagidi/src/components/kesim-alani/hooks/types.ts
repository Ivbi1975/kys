import type { KesimAlani, Donation } from "@/lib/types";

export type SortField = "name" | "description" | "donationType" | "shareCount";

export const FIND_DELETE_COLUMN_LABELS: Record<string, string> = {
  name: "Adına Kesilen",
  description: "Vekaleti Veren",
  donationType: "Cinsi",
  vekalet: "Vekalet No",
  notes: "Notlar",
};

export interface BasketItem {
  type: "donation" | "animalGroup";
  donationId: string;
  kesimAlaniId: string;
  kesimAlaniName: string;
  name: string;
  description: string;
  animalGroupId?: string;
  animalNo?: number;
  filledCount?: number;
  colorTag?: string;
  donationIds?: string[];
  groupUpdatedAt?: string;
  donationType?: string;
  donorShareCount?: number;
  vekalet?: string;
  donorNotes?: string;
  sourceGroupId?: string;
  sourceGroupAnimalNo?: number;
  sourceSlotIndex?: number;
  addedAt?: number;
  donationSnapshots?: Array<{
    id: string;
    name: string;
    description: string;
    donationType: string;
    shareCount: number;
    vekalet: string;
    notes: string;
    slotIndex?: number;
  }>;
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
    const items = JSON.parse(raw) as BasketItem[];
    return items.map(item => ({
      ...item,
      type: item.type || "donation",
    }));
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

export type BasketSortKey = "name" | "type" | "source";
export type BasketSortDir = "asc" | "desc";

export interface ReturnToSourceResult {
  success: boolean;
  restoredToOriginalSlot: number;
  restoredToAlternativeSlot: number;
  sentToDonorList: number;
  groupDeletedCount: number;
  slotFullCount: number;
}

export interface OfflineQueueItem {
  id: string;
  action: "crossKATransfer" | "sendToPool";
  payload: Record<string, unknown>;
  timestamp: number;
}

export const OFFLINE_QUEUE_KEY = "kurban-basket-offline-queue";
