import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Printer,
  ArrowUpDown,
  Wand2,
  Upload,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  FileSpreadsheet,
  ClipboardPaste,
  Settings2,
} from "lucide-react";
import type { Donation, AnimalGroup, KesimAlani } from "@/lib/types";
import { getKesimAlani, updateKesimAlani } from "@/lib/storage";
import { autoGroupDonations, getTotalShares, getRequiredAnimals } from "@/lib/grouping";
import * as XLSX from "xlsx";

type SortField = "name" | "description" | "donationType" | "shareCount";
type SortDir = "asc" | "desc";
type ColumnMapping = "name" | "description" | "donationType" | "shareCount" | "skip";

const COLUMN_OPTIONS: { value: ColumnMapping; label: string }[] = [
  { value: "name", label: "İsim" },
  { value: "description", label: "Açıklama" },
  { value: "donationType", label: "Bağış Türü" },
  { value: "shareCount", label: "Hisse Sayısı" },
  { value: "skip", label: "Atla (kullanma)" },
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 12);
}

export default function KesimAlaniPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [bulkStep, setBulkStep] = useState<"input" | "mapping">("input");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDonation, setNewDonation] = useState({
    name: "",
    description: "",
    donationType: "",
    shareCount: 1,
  });
  const [editingCell, setEditingCell] = useState<{
    donationId: string;
    field: string;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [dragItem, setDragItem] = useState<{
    groupIdx: number;
    donationIdx: number;
  } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{
    groupIdx: number;
    donationIdx: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.id) {
      const data = getKesimAlani(params.id);
      if (data) setKesim(data);
      else setLocation("/");
    }
  }, [params.id, setLocation]);

  const save = useCallback(
    (updated: KesimAlani) => {
      setKesim(updated);
      updateKesimAlani(updated);
    },
    []
  );

  function addDonation() {
    if (!kesim || !newDonation.name.trim()) return;
    const donation: Donation = {
      id: generateId(),
      name: newDonation.name.trim(),
      description: newDonation.description.trim(),
      donationType: newDonation.donationType.trim(),
      shareCount: Math.max(1, Math.min(7, newDonation.shareCount)),
    };
    save({ ...kesim, donations: [...kesim.donations, donation] });
    setNewDonation({ name: "", description: "", donationType: "", shareCount: 1 });
    setAddDialogOpen(false);
  }

  function deleteDonation(id: string) {
    if (!kesim) return;
    save({
      ...kesim,
      donations: kesim.donations.filter((d) => d.id !== id),
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function deleteSelected() {
    if (!kesim || selectedIds.size === 0) return;
    save({
      ...kesim,
      donations: kesim.donations.filter((d) => !selectedIds.has(d.id)),
    });
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!kesim) return;
    if (selectedIds.size === kesim.donations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(kesim.donations.map((d) => d.id)));
    }
  }

  function updateDonationField(id: string, field: keyof Donation, value: string | number) {
    if (!kesim) return;
    save({
      ...kesim,
      donations: kesim.donations.map((d) =>
        d.id === id ? { ...d, [field]: value } : d
      ),
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (rows.length > 0) {
          processRawData(rows);
        }
      } catch {
        alert("Excel dosyası okunamadı. Lütfen geçerli bir dosya seçin.");
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
    const defaults: ColumnMapping[] = ["name", "description", "donationType", "shareCount"];
    for (let i = 0; i < colCount; i++) {
      defaultMappings.push(i < defaults.length ? defaults[i] : "skip");
    }
    setColumnMappings(defaultMappings);
    setBulkStep("mapping");
  }

  function applyBulkImport() {
    if (!kesim || previewData.length === 0) return;
    const startRow = hasHeaderRow ? 1 : 0;
    const newDonations: Donation[] = [];

    for (let r = startRow; r < previewData.length; r++) {
      const row = previewData[r];
      const donation: Partial<Donation> = {
        id: generateId(),
        name: "",
        description: "",
        donationType: "",
        shareCount: 1,
      };

      for (let c = 0; c < columnMappings.length; c++) {
        const mapping = columnMappings[c];
        const cellValue = (row[c] || "").trim();
        if (mapping === "skip" || !cellValue) continue;
        if (mapping === "shareCount") {
          donation.shareCount = Math.max(1, Math.min(7, parseInt(cellValue, 10) || 1));
        } else {
          (donation as any)[mapping] = cellValue;
        }
      }

      if (donation.name) {
        newDonations.push(donation as Donation);
      }
    }

    save({ ...kesim, donations: [...kesim.donations, ...newDonations] });
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
  }

  function handleAutoGroup() {
    if (!kesim) return;
    const groups = autoGroupDonations(kesim.donations);
    save({ ...kesim, animalGroups: groups });
  }

  function handleSort(field: SortField) {
    if (!kesim) return;
    const newDir = sortField === field && sortDir === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortDir(newDir);
    const sorted = [...kesim.donations].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return newDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return newDir === "asc"
        ? String(aVal).localeCompare(String(bVal), "tr")
        : String(bVal).localeCompare(String(aVal), "tr");
    });
    save({ ...kesim, donations: sorted });
  }

  function moveGroupDonation(
    groupIdx: number,
    fromIdx: number,
    toGroupIdx: number,
    toIdx: number
  ) {
    if (!kesim) return;
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: [...g.donations],
    }));
    const [item] = groups[groupIdx].donations.splice(fromIdx, 1);
    groups[toGroupIdx].donations.splice(toIdx, 0, item);

    if (groups[groupIdx].donations.length > 7) {
      groups[groupIdx].donations = groups[groupIdx].donations.slice(0, 7);
    }
    if (groups[toGroupIdx].donations.length > 7) {
      const overflow = groups[toGroupIdx].donations.splice(7);
      groups[groupIdx].donations.push(...overflow);
    }

    save({ ...kesim, animalGroups: groups });
  }

  function handleDragStart(groupIdx: number, donationIdx: number) {
    setDragItem({ groupIdx, donationIdx });
  }

  function handleDragOver(
    e: React.DragEvent,
    groupIdx: number,
    donationIdx: number
  ) {
    e.preventDefault();
    setDragOverItem({ groupIdx, donationIdx });
  }

  function handleDrop(groupIdx: number, donationIdx: number) {
    if (dragItem) {
      moveGroupDonation(
        dragItem.groupIdx,
        dragItem.donationIdx,
        groupIdx,
        donationIdx
      );
    }
    setDragItem(null);
    setDragOverItem(null);
  }

  function removeFromGroup(groupIdx: number, donationIdx: number) {
    if (!kesim) return;
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: [...g.donations],
    }));
    groups[groupIdx].donations.splice(donationIdx, 1);
    groups[groupIdx].donations.push({
      id: generateId(),
      name: "",
      description: "",
      donationType: "",
      shareCount: 1,
    });
    save({ ...kesim, animalGroups: groups });
  }

  function updateGroupDonation(
    groupIdx: number,
    donationIdx: number,
    field: keyof Donation,
    value: string | number
  ) {
    if (!kesim) return;
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: g.donations.map((d) => ({ ...d })),
    }));
    (groups[groupIdx].donations[donationIdx] as any)[field] = value;
    save({ ...kesim, animalGroups: groups });
  }

  function toggleGroupCollapse(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  if (!kesim) return null;

  const totalShares = getTotalShares(kesim.donations);
  const requiredAnimals = getRequiredAnimals(kesim.donations);

  const nameCountMap = new Map<string, number>();
  for (const d of kesim.donations) {
    const normalizedName = d.name.trim().toLowerCase();
    if (normalizedName) {
      nameCountMap.set(normalizedName, (nameCountMap.get(normalizedName) || 0) + 1);
    }
  }

  const displayPreviewRows = hasHeaderRow ? previewData.slice(1) : previewData;
  const headerRow = hasHeaderRow && previewData.length > 0 ? previewData[0] : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{kesim.name}</h1>
            <p className="text-sm text-muted-foreground">
              {kesim.donations.length} bağışçı • {totalShares} hisse •{" "}
              {requiredAnimals} hayvan gerekli
            </p>
          </div>
          <div className="flex gap-2">
            {kesim.animalGroups.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setLocation(`/print/${kesim.id}`)}
              >
                <Printer className="w-4 h-4 mr-2" />
                Yazdır
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Bağışçı Listesi</h2>
              <div className="flex gap-2">
                <Dialog open={bulkDialogOpen} onOpenChange={(open) => { if (!open) resetBulkDialog(); else setBulkDialogOpen(true); }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-1" />
                      Toplu Ekle
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {bulkStep === "input" ? "Toplu Bağışçı Ekle" : "Sütun Eşleştirme"}
                      </DialogTitle>
                    </DialogHeader>

                    {bulkStep === "input" && (
                      <div className="space-y-4 pt-4">
                        <div className="flex gap-2">
                          <Button
                            variant={bulkMode === "upload" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBulkMode("upload")}
                            className="flex-1"
                          >
                            <FileSpreadsheet className="w-4 h-4 mr-1" />
                            Excel Yükle
                          </Button>
                          <Button
                            variant={bulkMode === "paste" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBulkMode("paste")}
                            className="flex-1"
                          >
                            <ClipboardPaste className="w-4 h-4 mr-1" />
                            Kopyala Yapıştır
                          </Button>
                        </div>

                        {bulkMode === "upload" && (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Excel dosyanızı (.xlsx, .xls) seçin. İlk sayfa okunacaktır.
                            </p>
                            <div
                              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                              <p className="text-sm font-medium">Excel dosyası seçmek için tıklayın</p>
                              <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv desteklenir</p>
                            </div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              className="hidden"
                              onChange={handleFileUpload}
                            />
                          </div>
                        )}

                        {bulkMode === "paste" && (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Excel'den kopyaladığınız verileri aşağıya yapıştırın. Bir sonraki adımda hangi sütunun ne olduğunu belirleyeceksiniz.
                            </p>
                            <textarea
                              className="w-full h-48 p-3 border rounded-md bg-background text-foreground font-mono text-sm resize-none"
                              placeholder={"Ali Yılmaz\tAnkara\tAdak\t1\nMehmet Kaya\tİstanbul\tKurban\t3\nAyşe Demir\tBursa\tAkika\t2"}
                              value={pasteText}
                              onChange={(e) => setPasteText(e.target.value)}
                            />
                            <Button onClick={handlePasteData} className="w-full" disabled={!pasteText.trim()}>
                              Devam Et
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {bulkStep === "mapping" && (
                      <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Settings2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">
                            Her sütunun hangi bilgiye karşılık geldiğini aşağıdan seçin. Kullanmak istemediğiniz sütunları "Atla" olarak ayarlayın.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="hasHeader"
                            checked={hasHeaderRow}
                            onChange={(e) => setHasHeaderRow(e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor="hasHeader" className="text-sm font-medium">
                            İlk satır başlık satırıdır (veri olarak eklenmez)
                          </label>
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-primary/10 border-b">
                                  {columnMappings.map((mapping, colIdx) => (
                                    <th key={colIdx} className="p-2 min-w-[140px]">
                                      <Select
                                        value={mapping}
                                        onValueChange={(v) => {
                                          const newMappings = [...columnMappings];
                                          newMappings[colIdx] = v as ColumnMapping;
                                          setColumnMappings(newMappings);
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {COLUMN_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                              {opt.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </th>
                                  ))}
                                </tr>
                                {headerRow && (
                                  <tr className="bg-muted/30 border-b">
                                    {headerRow.map((cell, idx) => (
                                      <td key={idx} className="p-2 text-xs text-muted-foreground font-medium">
                                        {cell || "—"}
                                      </td>
                                    ))}
                                  </tr>
                                )}
                              </thead>
                              <tbody>
                                {displayPreviewRows.slice(0, 5).map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b">
                                    {columnMappings.map((mapping, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className={`p-2 text-xs ${mapping === "skip" ? "text-muted-foreground/40 line-through" : ""}`}
                                      >
                                        {row[cIdx] || "—"}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {displayPreviewRows.length > 5 && (
                            <div className="p-2 text-xs text-muted-foreground text-center bg-muted/20">
                              ... ve {displayPreviewRows.length - 5} satır daha (toplam {displayPreviewRows.length} satır)
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setBulkStep("input")} className="flex-1">
                            Geri
                          </Button>
                          <Button onClick={applyBulkImport} className="flex-1">
                            {displayPreviewRows.length} Bağışçı Ekle
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Tekli Ekle
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Yeni Bağışçı Ekle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-4">
                      <Input
                        placeholder="İsim"
                        value={newDonation.name}
                        onChange={(e) =>
                          setNewDonation({ ...newDonation, name: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Açıklama"
                        value={newDonation.description}
                        onChange={(e) =>
                          setNewDonation({
                            ...newDonation,
                            description: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Bağış Türü"
                        value={newDonation.donationType}
                        onChange={(e) =>
                          setNewDonation({
                            ...newDonation,
                            donationType: e.target.value,
                          })
                        }
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Hisse:</label>
                        <Select
                          value={String(newDonation.shareCount)}
                          onValueChange={(v) =>
                            setNewDonation({
                              ...newDonation,
                              shareCount: parseInt(v),
                            })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={addDonation} className="w-full">
                        Ekle
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div className="mb-3 flex items-center gap-3 p-2 bg-primary/10 rounded-lg">
                <span className="text-sm font-medium">
                  {selectedIds.size} satır seçildi
                </span>
                <Button variant="destructive" size="sm" onClick={deleteSelected}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Seçilenleri Sil
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Seçimi Kaldır
                </Button>
              </div>
            )}

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 w-8">
                        <input
                          type="checkbox"
                          checked={kesim.donations.length > 0 && selectedIds.size === kesim.donations.length}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                      <th className="p-2 text-left w-8">#</th>
                      <th
                        className="p-2 text-left cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("name")}
                      >
                        <span className="flex items-center gap-1">
                          İsim
                          {sortField === "name" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "name" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="p-2 text-left cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("description")}
                      >
                        <span className="flex items-center gap-1">
                          Açıklama
                          {sortField === "description" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "description" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="p-2 text-left cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("donationType")}
                      >
                        <span className="flex items-center gap-1">
                          Bağış Türü
                          {sortField === "donationType" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "donationType" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="p-2 text-center cursor-pointer hover:bg-muted w-16"
                        onClick={() => handleSort("shareCount")}
                      >
                        <span className="flex items-center gap-1 justify-center">
                          Hisse
                          {sortField === "shareCount" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "shareCount" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kesim.donations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          Henüz bağışçı eklenmedi. "Toplu Ekle" ile Excel yükleyin veya yapıştırın.
                        </td>
                      </tr>
                    ) : (
                      kesim.donations.map((d, idx) => {
                        const nameCount = nameCountMap.get(d.name.trim().toLowerCase()) || 1;
                        const effectiveShare = nameCount > 1 ? nameCount : d.shareCount;
                        return (
                        <tr
                          key={d.id}
                          className={`border-b hover:bg-muted/30 transition-colors ${selectedIds.has(d.id) ? "bg-primary/5" : ""}`}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(d.id)}
                              onChange={() => toggleSelect(d.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="p-2 text-muted-foreground">{idx + 1}</td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "name" ? (
                              <Input
                                className="h-7 text-sm"
                                value={d.name}
                                onChange={(e) =>
                                  updateDonationField(d.id, "name", e.target.value)
                                }
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text"
                                onClick={() =>
                                  setEditingCell({ donationId: d.id, field: "name" })
                                }
                              >
                                {d.name || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "description" ? (
                              <Input
                                className="h-7 text-sm"
                                value={d.description}
                                onChange={(e) =>
                                  updateDonationField(
                                    d.id,
                                    "description",
                                    e.target.value
                                  )
                                }
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text"
                                onClick={() =>
                                  setEditingCell({
                                    donationId: d.id,
                                    field: "description",
                                  })
                                }
                              >
                                {d.description || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "donationType" ? (
                              <Input
                                className="h-7 text-sm"
                                value={d.donationType}
                                onChange={(e) =>
                                  updateDonationField(
                                    d.id,
                                    "donationType",
                                    e.target.value
                                  )
                                }
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text"
                                onClick={() =>
                                  setEditingCell({
                                    donationId: d.id,
                                    field: "donationType",
                                  })
                                }
                              >
                                {d.donationType || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {nameCount > 1 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                                {effectiveShare}
                              </span>
                            ) : (
                              <Select
                                value={String(d.shareCount)}
                                onValueChange={(v) =>
                                  updateDonationField(
                                    d.id,
                                    "shareCount",
                                    parseInt(v)
                                  )
                                }
                              >
                                <SelectTrigger className="h-7 w-16 text-sm mx-auto">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                      {n}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => deleteDonation(d.id)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {kesim.donations.length > 0 && (
              <div className="mt-4 flex gap-2">
                <Button onClick={handleAutoGroup} className="flex-1">
                  <Wand2 className="w-4 h-4 mr-2" />
                  Otomatik Grupla ({requiredAnimals} Hayvan)
                </Button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Hayvan Grupları
                {kesim.animalGroups.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({kesim.animalGroups.length} hayvan)
                  </span>
                )}
              </h2>
            </div>

            {kesim.animalGroups.length === 0 ? (
              <Card className="p-8 text-center">
                <Wand2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Bağışçı listesini doldurup "Otomatik Grupla" butonuna tıklayın
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {kesim.animalGroups.map((group, groupIdx) => {
                  const isCollapsed = collapsedGroups.has(group.id);
                  const filledCount = group.donations.filter(
                    (d) => d.name.trim() !== ""
                  ).length;
                  return (
                    <Card key={group.id} className="overflow-hidden">
                      <div
                        className="flex items-center justify-between p-3 bg-primary/10 cursor-pointer"
                        onClick={() => toggleGroupCollapse(group.id)}
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                          <h3 className="font-semibold text-sm">
                            {kesim.name} - HAYVAN NO: {group.animalNo}
                          </h3>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {filledCount}/7 dolu
                        </span>
                      </div>
                      {!isCollapsed && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="p-1.5 w-6"></th>
                              <th className="p-1.5 text-left w-6">#</th>
                              <th className="p-1.5 text-left">İsim</th>
                              <th className="p-1.5 text-left">Açıklama</th>
                              <th className="p-1.5 text-left">Bağış Türü</th>
                              <th className="p-1.5 w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.donations.map((d, dIdx) => (
                              <tr
                                key={d.id}
                                className={`border-b transition-colors ${
                                  dragOverItem?.groupIdx === groupIdx &&
                                  dragOverItem?.donationIdx === dIdx
                                    ? "bg-primary/20"
                                    : "hover:bg-muted/20"
                                }`}
                                draggable
                                onDragStart={() =>
                                  handleDragStart(groupIdx, dIdx)
                                }
                                onDragOver={(e) =>
                                  handleDragOver(e, groupIdx, dIdx)
                                }
                                onDrop={() => handleDrop(groupIdx, dIdx)}
                                onDragEnd={() => {
                                  setDragItem(null);
                                  setDragOverItem(null);
                                }}
                              >
                                <td className="p-1.5 cursor-grab">
                                  <GripVertical className="w-3 h-3 text-muted-foreground" />
                                </td>
                                <td className="p-1.5 text-muted-foreground">
                                  {dIdx + 1}
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    className="h-6 text-xs border-0 bg-transparent p-0"
                                    value={d.name}
                                    onChange={(e) =>
                                      updateGroupDonation(
                                        groupIdx,
                                        dIdx,
                                        "name",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    className="h-6 text-xs border-0 bg-transparent p-0"
                                    value={d.description}
                                    onChange={(e) =>
                                      updateGroupDonation(
                                        groupIdx,
                                        dIdx,
                                        "description",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    className="h-6 text-xs border-0 bg-transparent p-0"
                                    value={d.donationType}
                                    onChange={(e) =>
                                      updateGroupDonation(
                                        groupIdx,
                                        dIdx,
                                        "donationType",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="p-1.5">
                                  {d.name.trim() && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0"
                                      onClick={() =>
                                        removeFromGroup(groupIdx, dIdx)
                                      }
                                    >
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
