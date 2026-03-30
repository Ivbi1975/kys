import { useState, useRef } from "react";
import { produce } from "immer";
import type { KesimAlani, Donation } from "@/lib/types";
import { downloadCsvExport } from "@/lib/api";

export type ColumnMapping = "name" | "description" | "donationType" | "shareCount" | "vekalet" | "notes" | "skip";

export const COLUMN_OPTIONS: { value: ColumnMapping; label: string }[] = [
  { value: "name", label: "Adına Kesilen" },
  { value: "description", label: "Vekaleti Veren" },
  { value: "donationType", label: "Cinsi" },
  { value: "shareCount", label: "Hisse Sayısı" },
  { value: "vekalet", label: "Vekalet No" },
  { value: "notes", label: "Notlar" },
  { value: "skip", label: "Atla (kullanma)" },
];

const getXLSX = () => import("xlsx-js-style");

function generateId(): string {
  return crypto.randomUUID();
}

interface UseImportExportParams {
  kesim: KesimAlani | null;
  save: (data: KesimAlani, label?: string, forceImmediate?: boolean, saveType?: "full" | "donations" | "groups") => void;
  toast: (opts: { title: string; description?: string; variant?: "destructive" }) => void;
}

export function useImportExport({ kesim, save, toast }: UseImportExportParams) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await getXLSX();
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (rows.length > 0) {
          processRawData(rows);
        }
      } catch {
        toast({ title: "Excel dosyası okunamadı", description: "Lütfen geçerli bir dosya seçin.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
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
    const defaultMappings: ColumnMapping[] = [];
    const defaults: ColumnMapping[] = ["skip", "skip", "vekalet", "description", "name", "donationType", "notes"];
    for (let i = 0; i < colCount; i++) {
      defaultMappings.push(i < defaults.length ? defaults[i] : "skip");
    }
    setColumnMappings(defaultMappings);
    setBulkStep("mapping");
  }

  function applyBulkImport() {
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

    const excludedIdxs = new Set(bulkReviewRows.filter(r => r.selected).map(r => r.idx));

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
          donation.notes = cellValue;
        }
      }

      if (donation.name) {
        newDonations.push(donation as Donation);
      }
    }

    const updated = produce(kesim, (draft) => {
      draft.donations.push(...newDonations);
    });
    save(updated, `${newDonations.length} bağışçı toplu eklendi`, true);
    resetBulkDialog();
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

  async function exportGroupsExcel() {
    if (!kesim || kesim.animalGroups.length === 0) return;
    const XLSX = await getXLSX();
    const data: Record<string, string | number>[] = [];
    for (const group of kesim.animalGroups) {
      for (let i = 0; i < group.donations.length; i++) {
        const d = group.donations[i];
        data.push({
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
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 16 }, { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kesim Kağıdı");
    XLSX.writeFile(wb, `${kesim.name}_kesim_kagidi.xlsx`);
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
    donorListReportOpen,
    setDonorListReportOpen,
    fileInputRef,
    handleFileUpload,
    handlePasteData,
    processRawData,
    applyBulkImport,
    resetBulkDialog,
    exportDonorsExcel,
    exportGroupsExcel,
    handleExportKaCsv,
    displayPreviewRows,
    headerRow,
    COLUMN_OPTIONS,
  };
}
