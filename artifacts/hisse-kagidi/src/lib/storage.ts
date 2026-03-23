const PRINT_PREFS_KEY = "hisse-kagidi-print-prefs";

export type PrintTemplate = "standard" | "portrait" | "compact" | "namelist";

export interface PrintPreferences {
  hiddenColumns: string[];
  contentHideRules: Record<string, string[]>;
  template: PrintTemplate;
}

export const DEFAULT_PRINT_PREFS: PrintPreferences = {
  hiddenColumns: [],
  contentHideRules: {
    "vekaleti-veren": ["Vacip", "VACİB", "vacib", "Vacib"],
  },
  template: "standard",
};

export const PRINT_TEMPLATES: { value: PrintTemplate; label: string; description: string }[] = [
  { value: "standard", label: "Standart A4 Yatay", description: "Her hayvan grubu ayrı A4 yatay sayfada" },
  { value: "portrait", label: "A4 Dikey", description: "Her hayvan grubu ayrı A4 dikey sayfada" },
  { value: "compact", label: "Kompakt Liste", description: "Birden fazla grup tek sayfada, küçük tablo" },
  { value: "namelist", label: "Sadece İsim Listesi", description: "Basit bağışçı adı ve hisse tablosu" },
];

export function savePrintPreferences(prefs: PrintPreferences): void {
  localStorage.setItem(PRINT_PREFS_KEY, JSON.stringify(prefs));
}

const VALID_COLUMN_KEYS = ["hayvan", "sira", "vekalet", "vekaleti-veren", "adina-kesilen", "cinsi", "notlar"];
const VALID_TEMPLATES: PrintTemplate[] = ["standard", "portrait", "compact", "namelist"];

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
      const template = VALID_TEMPLATES.includes(parsed.template) ? parsed.template : "standard";
      return { hiddenColumns, contentHideRules, template };
    }
  } catch {
    console.warn("Print preferences could not be loaded, using defaults");
  }
  return { ...DEFAULT_PRINT_PREFS, contentHideRules: { ...DEFAULT_PRINT_PREFS.contentHideRules } };
}

export function resetPrintPreferences(): void {
  localStorage.removeItem(PRINT_PREFS_KEY);
}
