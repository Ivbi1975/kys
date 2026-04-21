import type { BasketItem } from "../hooks/types";

export type BasketTab = "contents" | "place" | "transfer";
export type GroupByCriterion = "cins" | "share" | "source";

export const ITEMS_PER_PAGE = 50;
export const TIMEOUT_WARNING_MS = 2 * 60 * 60 * 1000;

export function getGroupKey(b: BasketItem, groupByCriteria: Set<GroupByCriterion>): string {
  const parts: string[] = [];
  if (groupByCriteria.has("cins")) parts.push(b.donationType || "Belirtilmemiş");
  if (groupByCriteria.has("share")) parts.push(`${b.donorShareCount || 1} Hisse`);
  if (groupByCriteria.has("source")) {
    parts.push(b.sourceGroupAnimalNo ? `Hayvan ${b.sourceGroupAnimalNo}` : "Bağışçı Listesi");
  }
  return parts.join(" · ") || "__all__";
}

export function buildGroupedChips<T extends BasketItem>(items: T[]): Array<{ key: string; label: string; items: T[] }> {
  const grouped: { key: string; label: string; items: T[] }[] = [];
  const seen = new Map<string, number>();
  for (const b of items) {
    const label = (b.description || b.name).trim();
    const existing = seen.get(label);
    if (existing !== undefined) {
      grouped[existing].items.push(b);
    } else {
      seen.set(label, grouped.length);
      grouped.push({ key: label, label, items: [b] });
    }
  }
  return grouped;
}

export function formatTimeInBasket(addedAt: number | undefined, now: number): string | null {
  if (!addedAt) return null;
  const elapsed = now - addedAt;
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}dk`;
  const hours = Math.floor(minutes / 60);
  const remainMins = minutes % 60;
  return `${hours}s ${remainMins}dk`;
}
