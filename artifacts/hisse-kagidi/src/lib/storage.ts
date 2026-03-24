const PRINT_PREFS_KEY = "hisse-kagidi-print-prefs";

export type PrintTemplate = "standard" | "portrait" | "compact" | "namelist" | "summary";

export interface PrintPreferences {
  hiddenColumns: string[];
  contentHideRules: Record<string, string[]>;
  template: PrintTemplate;
  columnFontSizes: Record<string, number>;
}

export const DEFAULT_PRINT_PREFS: PrintPreferences = {
  hiddenColumns: [],
  contentHideRules: {
    "vekaleti-veren": ["Vacip", "VACİB", "vacib", "Vacib"],
  },
  template: "standard",
  columnFontSizes: {},
};

export const PRINT_TEMPLATES: { value: PrintTemplate; label: string; description: string }[] = [
  { value: "standard", label: "Kesim Kağıdı", description: "Her hayvan grubu ayrı A4 yatay sayfada" },
  { value: "portrait", label: "A4 Dikey", description: "Her hayvan grubu ayrı A4 dikey sayfada" },
  { value: "compact", label: "Kompakt Liste", description: "Her grup tek satırda, isimler virgülle ayrılmış" },
  { value: "namelist", label: "Sadece İsim Listesi", description: "Basit bağışçı adı ve hisse tablosu" },
  { value: "summary", label: "Özet Rapor", description: "İstatistik kartları ve grupların özet tablosu" },
];

export function savePrintPreferences(prefs: PrintPreferences): void {
  localStorage.setItem(PRINT_PREFS_KEY, JSON.stringify(prefs));
}

const VALID_COLUMN_KEYS = ["hayvan", "sira", "vekalet", "vekaleti-veren", "adina-kesilen", "cinsi", "notlar"];
const VALID_TEMPLATES: PrintTemplate[] = ["standard", "portrait", "compact", "namelist", "summary"];

export function loadPrintPreferences(): PrintPreferences {
  try {
    const data = localStorage.getItem(PRINT_PREFS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      const hiddenColumns = Array.isArray(parsed.hiddenColumns)
        ? parsed.hiddenColumns.filter((k: unknown) => typeof k === "string" && VALID_COLUMN_KEYS.includes(k as string))
        : [];
      const contentHideRules: Record<string, string[]> = {};
      const CONTENT_HIDE_ALLOWED = ["vekaleti-veren", "notlar"];
      if (parsed.contentHideRules && typeof parsed.contentHideRules === "object") {
        for (const [key, val] of Object.entries(parsed.contentHideRules)) {
          if (CONTENT_HIDE_ALLOWED.includes(key) && Array.isArray(val) && val.every((v) => typeof v === "string")) {
            contentHideRules[key] = val as string[];
          }
        }
      }
      const template = VALID_TEMPLATES.includes(parsed.template) ? parsed.template : "standard";
      const columnFontSizes: Record<string, number> = {};
      if (parsed.columnFontSizes && typeof parsed.columnFontSizes === "object") {
        for (const [key, val] of Object.entries(parsed.columnFontSizes)) {
          if (VALID_COLUMN_KEYS.includes(key) && typeof val === "number" && val >= 8 && val <= 36) {
            columnFontSizes[key] = val;
          }
        }
      }
      return { hiddenColumns, contentHideRules, template, columnFontSizes };
    }
  } catch {
    console.warn("Print preferences could not be loaded, using defaults");
  }
  return { ...DEFAULT_PRINT_PREFS, contentHideRules: { ...DEFAULT_PRINT_PREFS.contentHideRules }, columnFontSizes: {} };
}

export function resetPrintPreferences(): void {
  localStorage.removeItem(PRINT_PREFS_KEY);
}
