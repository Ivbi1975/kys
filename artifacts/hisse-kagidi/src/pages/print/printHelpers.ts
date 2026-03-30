import type { AnimalGroup } from "@/lib/types";

export const COLUMNS = [
  { key: "hayvan", label: "HAYVAN" },
  { key: "sira", label: "SIRA" },
  { key: "vekalet", label: "VEKALET" },
  { key: "vekaleti-veren", label: "VEKALETİ VEREN" },
  { key: "adina-kesilen", label: "ADINA KESİLEN" },
  { key: "cinsi", label: "CİNSİ" },
  { key: "notlar", label: "NOTLAR" },
] as const;

export type ColumnKey = (typeof COLUMNS)[number]["key"];

export const DEFAULT_FONT_SIZES: Record<string, number> = {
  hayvan: 32,
  sira: 14,
  vekalet: 11,
  "vekaleti-veren": 13,
  "adina-kesilen": 13,
  cinsi: 12,
  notlar: 11,
};

export const CONTENT_HIDE_ALLOWED_COLUMNS = ["vekaleti-veren", "notlar"];

export function getAiLabel(d: AnimalGroup["donations"][0]): string {
  const parts: string[] = [];
  if (d.aiCategories && d.aiCategories.length > 0) {
    parts.push(d.aiCategories.join(", "));
  }
  if (d.aiWarnings && d.aiWarnings.trim()) {
    parts.push(`⚠ ${d.aiWarnings.trim()}`);
  }
  return parts.join(" | ");
}

export function getCellContent(columnKey: ColumnKey, d: AnimalGroup["donations"][0]): string {
  switch (columnKey) {
    case "vekalet": return d.vekalet || "";
    case "vekaleti-veren": return d.description || "";
    case "adina-kesilen": return d.name || "";
    case "cinsi": return d.donationType || "";
    case "notlar": {
      const notes = d.notes || "";
      const ai = getAiLabel(d);
      if (ai) return notes ? `${notes} [${ai}]` : `[${ai}]`;
      return notes;
    }
    default: return "";
  }
}
