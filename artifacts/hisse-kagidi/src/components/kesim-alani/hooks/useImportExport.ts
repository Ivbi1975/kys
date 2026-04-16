import { useState, useRef } from "react";
import { produce } from "immer";
import type { KesimAlani, Donation } from "@/lib/types";
import { downloadCsvExport, downloadExcelExport, apiCreateDonation, checkVekaletConflicts } from "@/lib/api";

export type ColumnMapping = "name" | "description" | "donationType" | "shareCount" | "vekalet" | "notes" | "phone" | "birim" | "temsilci" | "skip";

export const COLUMN_OPTIONS: { value: ColumnMapping; label: string }[] = [
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

const COLUMN_KEYWORDS: Record<Exclude<ColumnMapping, "skip">, string[]> = {
  name: ["adına kesilen", "adina kesilen", "kesilen", "ad", "isim", "bağışçı", "bagisci", "donor", "name", "adı", "adi", "kime", "kimin adına"],
  description: ["vekaleti veren", "vekalet veren", "veren", "açıklama", "aciklama", "description", "desc", "kimden", "gönderen", "gonderen"],
  donationType: ["cinsi", "cins", "tür", "tur", "tip", "type", "donation type", "bağış türü", "bagis turu", "kurban türü", "kurban cinsi", "çeşit", "cesit", "nevi"],
  shareCount: ["hisse sayısı", "hisse sayisi", "hisse", "share", "adet", "miktar", "sayı", "sayi", "count", "pay"],
  vekalet: ["vekalet no", "vekalet", "vekâlet", "numara", "sıra no", "sira no", "fiş no", "fiş", "fis", "makbuz no", "makbuz"],
  notes: ["notlar", "not", "note", "notes", "açıklama notu", "ek bilgi", "bilgi", "memo", "yorum"],
  phone: ["telefon", "tel", "phone", "gsm", "cep", "iletişim", "iletisim"],
  birim: ["birim", "şube", "sube", "bölge", "bolge", "il", "şehir", "sehir", "branch", "unit"],
  temsilci: ["temsilci", "sorumlu", "yetkili", "representative", "agent", "danışman", "danisman"],
};

function normalizeText(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/[^a-zçğıöşü0-9\s]/gi, "")
    .trim();
}

function matchColumnHeader(header: string): ColumnMapping {
  const normalized = normalizeText(header);
  if (!normalized || normalized.length < 2) return "skip";

  let bestField: ColumnMapping = "skip";
  let bestScore = 0;

  for (const [field, keywords] of Object.entries(COLUMN_KEYWORDS) as [Exclude<ColumnMapping, "skip">, string[]][]) {
    for (const keyword of keywords) {
      let score = 0;

      if (normalized === keyword) {
        score = 1.0;
      } else if (normalized.includes(keyword) && keyword.length >= 3) {
        score = 0.9;
      } else if (keyword.includes(normalized) && normalized.length >= 4) {
        score = 0.8;
      } else if (normalized.length >= 3 && keyword.length >= 3) {
        const sim = computeSimilarity(normalized, keyword);
        if (sim >= 0.7) {
          score = sim * 0.7;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }
  }

  return bestScore >= 0.4 ? bestField : "skip";
}

function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;

  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer[i - 1] !== shorter[j - 1]) {
          newValue = Math.min(newValue, lastValue, costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longer.length - costs[shorter.length]) / longer.length;
}

function autoMapColumns(headers: string[]): ColumnMapping[] {
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

const getXLSX = () => import("xlsx-js-style");

function generateId(): string {
  return crypto.randomUUID();
}

interface UseImportExportParams {
  kesim: KesimAlani | null;
  save: (data: KesimAlani, label?: string, forceImmediate?: boolean, saveType?: "full" | "donations" | "groups") => void;
  toast: (opts: { title: string; description?: string; variant?: "destructive" }) => void;
  siblingKesimAlanlari: { id: string; name: string }[];
  addSelectedToBasket?: (ids: Set<string>) => void;
}

export function useImportExport({ kesim, save, toast, siblingKesimAlanlari, addSelectedToBasket }: UseImportExportParams) {
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [bulkStep, setBulkStep] = useState<"input" | "mapping" | "review">("input");
  const [bulkReviewRows, setBulkReviewRows] = useState<{ idx: number; row: string[]; rawShareCount: number; selected: boolean; groupKey: string; groupTotal: number }[]>([]);
  const [bulkReviewExpanded, setBulkReviewExpanded] = useState<Set<string>>(new Set());
  const [csvExporting, setCsvExporting] = useState(false);
  const [donorListReportOpen, setDonorListReportOpen] = useState(false);
  const [bulkReviewTransferTarget, setBulkReviewTransferTarget] = useState("");
  const [bulkReviewTransferring, setBulkReviewTransferring] = useState(false);
  const [bulkReviewHandledIdxs, setBulkReviewHandledIdxs] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { parseExcelInWorker } = await import("@/lib/excel.worker.client");
      const rows = await parseExcelInWorker(file);
      if (rows.length > 0) {
        processRawData(rows);
      }
    } catch {
      toast({ title: "Excel dosyası okunamadı", description: "Lütfen geçerli bir dosya seçin.", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handlePasteData() {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split("\n");
    const rows = lines.map((line) => line.split("\t").map((c) => c.trim()));
    processRawData(rows);
  }

  function processRawData(rows: string[][]) {
    setPreviewData(rows);
    const colCount = Math.max(...rows.map((r) => r.length));

    if (rows.length > 0 && hasHeaderRow) {
      const headers = rows[0].map((cell) => String(cell ?? "").trim());
      const smartMappings = autoMapColumns(headers);
      while (smartMappings.length < colCount) smartMappings.push("skip");
      setColumnMappings(smartMappings);
    } else {
      const defaultMappings: ColumnMapping[] = [];
      const defaults: ColumnMapping[] = ["skip", "skip", "vekalet", "description", "name", "donationType", "notes"];
      for (let i = 0; i < colCount; i++) {
        defaultMappings.push(i < defaults.length ? defaults[i] : "skip");
      }
      setColumnMappings(defaultMappings);
    }
    setBulkStep("mapping");
  }

  async function applyBulkImportChecked() {
    if (!kesim || previewData.length === 0) return;
    const startRow = hasHeaderRow ? 1 : 0;
    const vekaletColIdx = columnMappings.indexOf("vekalet");
    if (vekaletColIdx >= 0 && kesim.projectId) {
      const vekaletValues: string[] = [];
      for (let r = startRow; r < previewData.length; r++) {
        const val = String(previewData[r][vekaletColIdx] ?? "").trim();
        if (val) vekaletValues.push(val);
      }
      if (vekaletValues.length > 0) {
        try {
          const { conflicts } = await checkVekaletConflicts(kesim.projectId, vekaletValues);
          if (conflicts.length > 0) {
            const conflictingVekalets = new Set(conflicts.map(c => c.vekalet));
            applyBulkImport(conflictingVekalets);
            toast({
              title: `${conflicts.length} bağış vekalet çakışması nedeniyle atlandı`,
              description: "Aynı vekalet numarasına sahip mevcut kayıtlar korundu.",
            });
            return;
          }
        } catch {
          // vekalet check failed, continue without filtering
        }
      }
    }
    applyBulkImport();
  }

  function applyBulkImport(excludeVekalets?: Set<string>) {
    if (!kesim || previewData.length === 0) return;
    const startRow = hasHeaderRow ? 1 : 0;
    const shareCountColIdx = columnMappings.indexOf("shareCount");
    const descColIdx = columnMappings.indexOf("description");

    if (bulkStep !== "review") {
      const groupTotals = new Map<string, { total: number; rows: { idx: number; row: string[]; shareCount: number }[] }>();

      for (let r = startRow; r < previewData.length; r++) {
        const row = previewData[r];
        const desc = descColIdx >= 0 ? String(row[descColIdx] ?? "").trim().toLocaleLowerCase("tr") : "";
        const shareCount = shareCountColIdx >= 0
          ? (parseInt(String(row[shareCountColIdx] ?? "1").trim(), 10) || 1)
          : 1;

        if (!desc) continue;

        if (!groupTotals.has(desc)) {
          groupTotals.set(desc, { total: 0, rows: [] });
        }
        const group = groupTotals.get(desc)!;
        group.total += shareCount;
        group.rows.push({ idx: r, row, shareCount });
      }

      const highShareRows: typeof bulkReviewRows = [];
      for (const [groupKey, group] of groupTotals) {
        if (group.total > 50) {
          for (const item of group.rows) {
            highShareRows.push({
              idx: item.idx,
              row: item.row,
              rawShareCount: item.shareCount,
              selected: true,
              groupKey,
              groupTotal: group.total,
            });
          }
        }
      }

      if (highShareRows.length > 0) {
        highShareRows.sort((a, b) => a.groupKey.localeCompare(b.groupKey) || a.idx - b.idx);
        setBulkReviewRows(highShareRows);
        setBulkStep("review");
        return;
      }
    }

    const excludedIdxs = new Set([
      ...bulkReviewRows.filter(r => !r.selected).map(r => r.idx),
      ...bulkReviewHandledIdxs,
    ]);

    const newDonations: Donation[] = [];
    for (let r = startRow; r < previewData.length; r++) {
      if (excludedIdxs.has(r)) continue;
      const row = previewData[r];
      const donation: Partial<Donation> = {
        id: generateId(),
        name: "",
        description: "",
        donationType: "",
        shareCount: 1,
        vekalet: "",
        notes: "",
      };

      const notesParts: string[] = [];
      for (let c = 0; c < columnMappings.length; c++) {
        const mapping = columnMappings[c];
        const cellValue = String(row[c] ?? "").trim();
        if (mapping === "skip" || !cellValue) continue;
        if (mapping === "shareCount") {
          donation.shareCount = Math.max(1, Math.min(7, parseInt(cellValue, 10) || 1));
        } else if (mapping === "name") {
          donation.name = cellValue;
        } else if (mapping === "description") {
          donation.description = cellValue;
        } else if (mapping === "donationType") {
          donation.donationType = cellValue;
        } else if (mapping === "vekalet") {
          donation.vekalet = cellValue;
        } else if (mapping === "notes") {
          notesParts.push(cellValue);
        } else if (mapping === "phone") {
          donation.phone = cellValue;
        } else if (mapping === "birim") {
          donation.birim = cellValue;
        } else if (mapping === "temsilci") {
          donation.temsilci = cellValue;
        }
      }
      donation.notes = notesParts.join(" | ");

      if (donation.name) {
        if (excludeVekalets && donation.vekalet && excludeVekalets.has(donation.vekalet)) continue;
        newDonations.push(donation as Donation);
      }
    }

    const updated = produce(kesim, (draft) => {
      draft.donations.push(...newDonations);
    });
    save(updated, `${newDonations.length} bağışçı toplu eklendi`, true);
    resetBulkDialog();
  }

  function buildDonationFromRow(row: string[]): Donation {
    const donation: Partial<Donation> = {
      id: generateId(),
      name: "",
      description: "",
      donationType: "",
      shareCount: 1,
      vekalet: "",
      notes: "",
      phone: "",
      birim: "",
      temsilci: "",
    };
    const notesParts: string[] = [];
    for (let c = 0; c < columnMappings.length; c++) {
      const mapping = columnMappings[c];
      const cellValue = String(row[c] ?? "").trim();
      if (mapping === "skip" || !cellValue) continue;
      if (mapping === "shareCount") {
        donation.shareCount = Math.max(1, Math.min(7, parseInt(cellValue, 10) || 1));
      } else if (mapping === "name") {
        donation.name = cellValue;
      } else if (mapping === "description") {
        donation.description = cellValue;
      } else if (mapping === "donationType") {
        donation.donationType = cellValue;
      } else if (mapping === "vekalet") {
        donation.vekalet = cellValue;
      } else if (mapping === "notes") {
        notesParts.push(cellValue);
      } else if (mapping === "phone") {
        donation.phone = cellValue;
      } else if (mapping === "birim") {
        donation.birim = cellValue;
      } else if (mapping === "temsilci") {
        donation.temsilci = cellValue;
      }
    }
    donation.notes = notesParts.join(" | ");
    return donation as Donation;
  }

  function addReviewRowsToBasket() {
    if (!kesim || !addSelectedToBasket) return;
    const selectedRows = bulkReviewRows.filter(r => !r.selected);
    if (selectedRows.length === 0) {
      toast({ title: "Hariç tutulan satır yok", description: "Sepete eklemek için satırların işaretini kaldırın.", variant: "destructive" });
      return;
    }
    const newDonations: Donation[] = [];
    for (const item of selectedRows) {
      const donation = buildDonationFromRow(item.row);
      if (donation.name) newDonations.push(donation);
    }
    if (newDonations.length === 0) {
      toast({ title: "Geçerli satır yok", description: "Hariç tutulan satırlarda isim bulunamadı.", variant: "destructive" });
      return;
    }
    const updated = produce(kesim, (draft) => {
      draft.donations.push(...newDonations);
    });
    save(updated, `${newDonations.length} bağışçı eklendi (sepete)`, true, "donations");
    const newIds = new Set(newDonations.map(d => d.id));
    addSelectedToBasket(newIds);
    const handledIdxs = selectedRows.map(r => r.idx);
    setBulkReviewHandledIdxs(prev => {
      const next = new Set(prev);
      for (const idx of handledIdxs) next.add(idx);
      return next;
    });
    setBulkReviewRows(prev => prev.filter(r => !handledIdxs.includes(r.idx)));
    toast({ title: `${newDonations.length} satır sepete eklendi` });
  }

  async function transferReviewRowsToKesimAlani() {
    if (!bulkReviewTransferTarget) {
      toast({ title: "Hedef kesim listesi seçin", variant: "destructive" });
      return;
    }
    const selectedRows = bulkReviewRows.filter(r => !r.selected);
    if (selectedRows.length === 0) {
      toast({ title: "Hariç tutulan satır yok", description: "Aktarmak için satırların işaretini kaldırın.", variant: "destructive" });
      return;
    }
    const newDonations: Donation[] = [];
    for (const item of selectedRows) {
      const donation = buildDonationFromRow(item.row);
      if (donation.name) newDonations.push(donation);
    }
    if (newDonations.length === 0) {
      toast({ title: "Geçerli satır yok", description: "Hariç tutulan satırlarda isim bulunamadı.", variant: "destructive" });
      return;
    }
    setBulkReviewTransferring(true);
    const successIdxs: number[] = [];
    try {
      for (let i = 0; i < newDonations.length; i++) {
        const d = newDonations[i];
        try {
          await apiCreateDonation(bulkReviewTransferTarget, {
            id: d.id,
            name: d.name,
            description: d.description,
            donationType: d.donationType,
            shareCount: d.shareCount,
            vekalet: d.vekalet,
            notes: d.notes,
          });
          successIdxs.push(selectedRows[i].idx);
        } catch (err) {
          toast({
            title: `"${d.name}" aktarılamadı`,
            description: err instanceof Error ? err.message : "Bilinmeyen hata",
            variant: "destructive",
          });
        }
      }
      if (successIdxs.length > 0) {
        setBulkReviewHandledIdxs(prev => {
          const next = new Set(prev);
          for (const idx of successIdxs) next.add(idx);
          return next;
        });
        setBulkReviewRows(prev => prev.filter(r => !successIdxs.includes(r.idx)));
        const targetName = siblingKesimAlanlari.find(ka => ka.id === bulkReviewTransferTarget)?.name || "";
        toast({ title: `${successIdxs.length} satır "${targetName}" listesine aktarıldı` });
      }
      if (successIdxs.length === newDonations.length) {
        setBulkReviewTransferTarget("");
      }
    } finally {
      setBulkReviewTransferring(false);
    }
  }

  function resetBulkDialog() {
    setBulkDialogOpen(false);
    setBulkStep("input");
    setBulkMode("upload");
    setPasteText("");
    setPreviewData([]);
    setColumnMappings([]);
    setHasHeaderRow(true);
    setBulkReviewRows([]);
    setBulkReviewExpanded(new Set());
    setBulkReviewTransferTarget("");
    setBulkReviewTransferring(false);
    setBulkReviewHandledIdxs(new Set());
  }

  async function exportDonorsExcel() {
    if (!kesim) return;
    const XLSX = await getXLSX();
    const wb = XLSX.utils.book_new();

    const donorData = kesim.donations.map((d, i) => ({
      "Sıra": i + 1,
      "Kesim Listesi ID": kesim.kesimListeId || "",
      "Adına Kesilen": d.name,
      "Vekaleti Veren": d.description,
      "Cinsi": d.donationType,
      "Hisse": d.shareCount,
      "Vekalet": d.vekalet,
      "Notlar": d.notes,
      "Durum": d.excluded ? "Hariç" : "Dahil",
    }));
    const wsDonors = XLSX.utils.json_to_sheet(donorData);
    wsDonors["!cols"] = [
      { wch: 6 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 8 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDonors, "Bağışçılar");

    if (kesim.animalGroups.length > 0) {
      const groupData: Record<string, string | number>[] = [];
      for (const group of kesim.animalGroups) {
        for (let i = 0; i < group.donations.length; i++) {
          const d = group.donations[i];
          groupData.push({
            "Kesim Listesi ID": kesim.kesimListeId || "",
            "Hayvan No": group.animalNo,
            "Sıra": i + 1,
            "Vekalet": d.vekalet,
            "Vekaleti Veren": d.description,
            "Adına Kesilen": d.name,
            "Cinsi": d.donationType,
            "Notlar": d.notes,
          });
        }
      }
      const wsGroups = XLSX.utils.json_to_sheet(groupData);
      wsGroups["!cols"] = [
        { wch: 16 }, { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsGroups, "Hayvan Grupları");
    }

    XLSX.writeFile(wb, `${kesim.name}_bagiscilar.xlsx`);
  }

  const [excelExporting, setExcelExporting] = useState(false);

  async function exportGroupsExcel() {
    if (!kesim || kesim.animalGroups.length === 0) return;
    setExcelExporting(true);
    try {
      const blob = await downloadExcelExport(kesim.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kesim.name.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ ]/g, "").replace(/\s+/g, "_")}_kesim_kagidi.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Excel indirildi" });
    } catch (err) {
      toast({
        title: "Excel export hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setExcelExporting(false);
    }
  }

  async function handleExportKaCsv() {
    if (!kesim) return;
    setCsvExporting(true);
    try {
      const blob = await downloadCsvExport(kesim.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kesim.name.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ ]/g, "").replace(/\s+/g, "_")}_bagiscilar.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV indirildi" });
    } catch (err) {
      toast({
        title: "CSV export hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setCsvExporting(false);
    }
  }

  const displayPreviewRows = hasHeaderRow ? previewData.slice(1) : previewData;
  const headerRow = hasHeaderRow && previewData.length > 0 ? previewData[0] : null;

  return {
    bulkDialogOpen,
    setBulkDialogOpen,
    bulkMode,
    setBulkMode,
    pasteText,
    setPasteText,
    previewData,
    setPreviewData,
    columnMappings,
    setColumnMappings,
    hasHeaderRow,
    setHasHeaderRow,
    bulkStep,
    setBulkStep,
    bulkReviewRows,
    setBulkReviewRows,
    bulkReviewExpanded,
    setBulkReviewExpanded,
    csvExporting,
    setCsvExporting,
    excelExporting,
    donorListReportOpen,
    setDonorListReportOpen,
    bulkReviewTransferTarget,
    setBulkReviewTransferTarget,
    bulkReviewTransferring,
    fileInputRef,
    handleFileUpload,
    handlePasteData,
    processRawData,
    applyBulkImport,
    applyBulkImportChecked,
    addReviewRowsToBasket,
    transferReviewRowsToKesimAlani,
    resetBulkDialog,
    exportDonorsExcel,
    exportGroupsExcel,
    handleExportKaCsv,
    displayPreviewRows,
    headerRow,
    COLUMN_OPTIONS,
    siblingKesimAlanlari,
  };
}
