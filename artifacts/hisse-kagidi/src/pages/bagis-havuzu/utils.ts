import type { PoolDonation } from "@/lib/types";
import { trUpperCase } from "@/lib/utils";
import type { TableColumnKey } from "./types";

const TEXT_COLUMNS_SET = new Set<TableColumnKey>([
  "name", "description", "donationType", "birim", "temsilci",
  "ozellik", "fiyat", "yerTalebi", "gunTalebi", "ilkHayvan", "safi", "notes",
]);

export function getDonationCellValue(d: PoolDonation, key: TableColumnKey): string | number {
  switch (key) {
    case "shareCount": return d.shareCount ?? 1;
    case "vekalet": return d.vekalet || "";
    case "phone": return d.phone || "";
    case "kesimAlani": return trUpperCase(d.kesimAlaniName);
    case "durum": return trUpperCase(d.excluded ? "Hariç" : "Dahil");
    case "aiEtiket": return trUpperCase((d.aiCategories || []).join(", "));
    default: {
      const raw = (d as unknown as Record<string, unknown>)[key];
      const str = raw != null ? String(raw) : "";
      return TEXT_COLUMNS_SET.has(key) ? trUpperCase(str) : str;
    }
  }
}

export function parseUrlMulti(val: string | null): string[] {
  if (!val) return [];
  return val.split(",").map(v => v.trim()).filter(Boolean);
}

export function serializeMulti(arr: string[]): string {
  return arr.join(",");
}
