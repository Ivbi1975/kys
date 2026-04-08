export type ColumnMapping = "name" | "description" | "donationType" | "shareCount" | "vekalet" | "notes" | "phone" | "birim" | "temsilci" | "skip";

export type TableColumnKey = "vekalet" | "name" | "description" | "donationType" | "shareCount" | "birim" | "temsilci" | "notes" | "phone" | "kesimAlani" | "durum" | "aiEtiket";

export const POOL_COLUMN_OPTIONS: { value: ColumnMapping; label: string }[] = [
  { value: "name", label: "Adına Kesilen" },
  { value: "description", label: "Vekaleti Veren" },
  { value: "donationType", label: "Cinsi" },
  { value: "shareCount", label: "Hisse Sayısı" },
  { value: "vekalet", label: "Vekalet No" },
  { value: "notes", label: "Notlar" },
  { value: "phone", label: "Telefon" },
  { value: "birim", label: "Birim" },
  { value: "temsilci", label: "Temsilci" },
  { value: "skip", label: "Atla (kullanma)" },
];

export const POOL_COLUMN_KEYWORDS: Record<Exclude<ColumnMapping, "skip">, string[]> = {
  name: ["adına kesilen", "adina kesilen", "kesilen", "ad", "isim", "bağışçı", "bagisci", "donor", "name"],
  description: ["vekaleti veren", "vekalet veren", "veren", "açıklama", "aciklama", "description"],
  donationType: ["cinsi", "cins", "tür", "tur", "tip", "type", "bağış türü", "kurban cinsi"],
  shareCount: ["hisse sayısı", "hisse sayisi", "hisse", "share", "adet", "sayı", "count"],
  vekalet: ["vekalet no", "vekalet", "vekâlet", "numara", "sıra no", "fiş no", "makbuz no"],
  notes: ["notlar", "not", "note", "notes", "ek bilgi", "bilgi", "yorum"],
  phone: ["telefon", "tel", "phone", "gsm", "cep"],
  birim: ["birim", "şube", "sube", "bölge", "bolge", "il", "şehir", "branch"],
  temsilci: ["temsilci", "sorumlu", "yetkili", "representative", "agent"],
};

export const ALL_TABLE_COLUMNS: { key: TableColumnKey; label: string; defaultVisible: boolean }[] = [
  { key: "vekalet", label: "Vekalet", defaultVisible: true },
  { key: "name", label: "Adına Kesilen", defaultVisible: true },
  { key: "description", label: "Vekaleti Veren", defaultVisible: true },
  { key: "donationType", label: "Cinsi", defaultVisible: true },
  { key: "shareCount", label: "Hisse", defaultVisible: true },
  { key: "birim", label: "Birim", defaultVisible: true },
  { key: "temsilci", label: "Temsilci", defaultVisible: true },
  { key: "notes", label: "Notlar", defaultVisible: true },
  { key: "phone", label: "Telefon", defaultVisible: false },
  { key: "kesimAlani", label: "Kesim Listesi", defaultVisible: true },
  { key: "durum", label: "Durum", defaultVisible: true },
  { key: "aiEtiket", label: "AI Etiketi", defaultVisible: false },
];

export const PAGE_SIZE = 500;
export const ROW_HEIGHT = 36;

export function normalizeText(text: string): string {
  return text.toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9\s]/gi, "").trim();
}

export function matchColumnHeader(header: string): ColumnMapping {
  const normalized = normalizeText(header);
  if (!normalized || normalized.length < 2) return "skip";
  for (const [field, keywords] of Object.entries(POOL_COLUMN_KEYWORDS) as [Exclude<ColumnMapping, "skip">, string[]][]) {
    for (const keyword of keywords) {
      if (normalized === keyword || (normalized.includes(keyword) && keyword.length >= 3)) return field;
    }
  }
  return "skip";
}

export function autoMapColumns(headers: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const usedFields = new Set<ColumnMapping>();
  for (const header of headers) {
    const match = matchColumnHeader(header);
    if (match !== "skip" && match !== "notes" && usedFields.has(match)) {
      mappings.push("skip");
    } else {
      mappings.push(match);
      if (match !== "skip") usedFields.add(match);
    }
  }
  return mappings;
}

export function getStatusLabel(d: { excluded?: boolean }): { label: string; color: string } {
  if (d.excluded) return { label: "Sepet", color: "text-orange-600" };
  return { label: "Havuzda", color: "text-blue-600" };
}
