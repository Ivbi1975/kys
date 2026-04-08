import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Upload, Search, X, Filter, Package, ShoppingBasket,
  ListChecks, Trash2, ArrowRightLeft,
  BarChart3, FileSpreadsheet, ClipboardPaste, Settings2, Ban,
  CheckSquare, Square, Loader2, Sparkles, AlertTriangle, Users, MapPin, Tag,
} from "lucide-react";
import {
  fetchPoolDonations, fetchPoolStats, bulkImportDonations,
  transferDonationsToKA, bulkActionDonations, classifyNotesAsync,
  fetchJobStatus, fetchProjects, saveAiClassifications, checkVekaletConflicts,
  createKesimAlani,
} from "@/lib/api";
import type { PoolDonation, PoolStats } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";

type ColumnMapping = "name" | "description" | "donationType" | "shareCount" | "vekalet" | "notes" | "phone" | "birim" | "temsilci" | "skip";

const POOL_COLUMN_OPTIONS: { value: ColumnMapping; label: string }[] = [
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

const POOL_COLUMN_KEYWORDS: Record<Exclude<ColumnMapping, "skip">, string[]> = {
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

function normalizeText(text: string): string {
  return text.toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9\s]/gi, "").trim();
}

function matchColumnHeader(header: string): ColumnMapping {
  const normalized = normalizeText(header);
  if (!normalized || normalized.length < 2) return "skip";
  for (const [field, keywords] of Object.entries(POOL_COLUMN_KEYWORDS) as [Exclude<ColumnMapping, "skip">, string[]][]) {
    for (const keyword of keywords) {
      if (normalized === keyword || (normalized.includes(keyword) && keyword.length >= 3)) return field;
    }
  }
  return "skip";
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

const PAGE_SIZE = 500;
const ROW_HEIGHT = 36;

type TableColumnKey = "vekalet" | "name" | "description" | "donationType" | "shareCount" | "birim" | "temsilci" | "notes" | "phone" | "kesimAlani" | "durum" | "aiEtiket";

const ALL_TABLE_COLUMNS: { key: TableColumnKey; label: string; defaultVisible: boolean }[] = [
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

function getStatusLabel(d: PoolDonation): { label: string; color: string } {
  if (d.excluded) return { label: "Sepet", color: "text-orange-600" };
  return { label: "Havuzda", color: "text-blue-600" };
}

function VirtualizedDonationTable({
  items, isLoading, activeFilterCount, selectedIds, toggleSelect, toggleSelectAll, multiLocationVekalets, visibleColumns,
}: {
  items: PoolDonation[];
  isLoading: boolean;
  activeFilterCount: number;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  multiLocationVekalets: Set<string>;
  visibleColumns: Set<TableColumnKey>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const cols = ALL_TABLE_COLUMNS.filter(c => visibleColumns.has(c.key));

  function renderCell(d: PoolDonation, key: TableColumnKey, isMultiLoc: boolean) {
    switch (key) {
      case "vekalet":
        return (
          <>
            {d.vekalet || "—"}
            {isMultiLoc && (
              <span className="ml-1 text-orange-500" title="Bu vekalet birden fazla listede mevcut">
                <AlertTriangle className="w-3 h-3 inline" />
              </span>
            )}
          </>
        );
      case "name": return <span className="font-medium">{d.name || "—"}</span>;
      case "description": return d.description || "—";
      case "donationType": return d.donationType || "—";
      case "shareCount": return <span className="font-mono">{d.shareCount}</span>;
      case "birim": return d.birim || "—";
      case "temsilci": return d.temsilci || "—";
      case "notes": return <span className="max-w-[150px] truncate block" title={d.notes}>{d.notes || "—"}</span>;
      case "phone": return d.phone || "—";
      case "kesimAlani": return <Badge variant="outline" className="text-xs">{d.kesimAlaniName}</Badge>;
      case "durum": {
        const { label, color } = getStatusLabel(d);
        return <span className={`font-medium ${color}`}>{label}</span>;
      }
      case "aiEtiket":
        return (
          <>
            {d.aiCategories && d.aiCategories.length > 0
              ? d.aiCategories.map((c: string) => (
                <Badge key={c} variant="secondary" className="text-xs mr-0.5 mb-0.5">{c}</Badge>
              ))
              : "—"}
            {d.aiWarnings && (
              <span className="text-orange-500 text-xs ml-1" title={d.aiWarnings}>
                <AlertTriangle className="w-3 h-3 inline" />
              </span>
            )}
          </>
        );
      default: return "—";
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr className="border-b">
              <th className="p-2 w-10 text-center">
                <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
                  {selectedIds.size === items.length && items.length > 0
                    ? <CheckSquare className="w-4 h-4" />
                    : <Square className="w-4 h-4" />}
                </button>
              </th>
              {cols.map(col => (
                <th key={col.key} className={`p-2 text-xs font-medium text-muted-foreground ${col.key === "shareCount" ? "text-center" : "text-left"}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {items.length === 0 && !isLoading && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {activeFilterCount > 0 ? "Filtreye uygun bağış bulunamadı." : "Bu projede henüz bağış yok."}
          </div>
        )}
        {items.length > 0 && (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
            <table className="w-full text-sm" style={{ position: "absolute", top: 0, left: 0, width: "100%" }}>
              <tbody>
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const d = items[virtualRow.index];
                  const isSelected = selectedIds.has(d.id);
                  const isMultiLoc = multiLocationVekalets.has((d.vekalet || "").trim());
                  return (
                    <tr
                      key={d.id}
                      style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)`, position: "absolute", top: 0, left: 0, width: "100%", display: "table-row" }}
                      className={`border-b hover:bg-muted/30 transition-colors ${isSelected ? "bg-primary/5" : virtualRow.index % 2 === 1 ? "bg-muted/10" : ""}`}
                    >
                      <td className="p-2 text-center w-10">
                        <button onClick={() => toggleSelect(d.id)} className="text-muted-foreground hover:text-foreground">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      {cols.map(col => (
                        <td key={col.key} className={`p-2 text-xs ${col.key === "shareCount" ? "text-center" : ""} ${col.key === "vekalet" ? "font-mono" : ""}`}>
                          {renderCell(d, col.key, isMultiLoc)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BagisHavuzuPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [donationTypeFilter, setDonationTypeFilter] = useState("");
  const [birimFilter, setBirimFilter] = useState("");
  const [temsilciFilter, setTemsilciFilter] = useState("");
  const [kesimAlaniFilter, setKesimAlaniFilter] = useState("");
  const [aiCategoryFilter, setAiCategoryFilter] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showStats, setShowStats] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("sortOrder");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<TableColumnKey>>(() => {
    const stored = localStorage.getItem(`bagis-havuzu-columns-${projectId}`);
    if (stored) {
      try { return new Set(JSON.parse(stored) as TableColumnKey[]); } catch { /* ignore */ }
    }
    return new Set(ALL_TABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
  });
  const [newListName, setNewListName] = useState("");
  const [creatingNewList, setCreatingNewList] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const aiPollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const [importStep, setImportStep] = useState<"input" | "mapping">("input");
  const [importMode, setImportMode] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [importTargetKA, setImportTargetKA] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  useEffect(() => {
    return () => {
      if (aiPollRef.current) clearInterval(aiPollRef.current);
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(`bagis-havuzu-columns-${projectId}`);
    if (stored) {
      try { setVisibleColumns(new Set(JSON.parse(stored) as TableColumnKey[])); } catch { /* ignore */ }
    } else {
      setVisibleColumns(new Set(ALL_TABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)));
    }
  }, [projectId]);

  useEffect(() => {
    if (!showColumnPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setShowColumnPicker(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showColumnPicker]);

  const activeFilterCount = [debouncedSearch, statusFilter, donationTypeFilter, birimFilter, temsilciFilter, kesimAlaniFilter, aiCategoryFilter].filter(Boolean).length;

  const filters = useMemo(() => ({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    donationType: donationTypeFilter || undefined,
    birim: birimFilter || undefined,
    temsilci: temsilciFilter || undefined,
    kesimAlaniId: kesimAlaniFilter || undefined,
    aiCategory: aiCategoryFilter || undefined,
    sortBy: sortBy !== "sortOrder" ? sortBy : undefined,
    sortDir: sortDir !== "asc" ? sortDir : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [debouncedSearch, statusFilter, donationTypeFilter, birimFilter, temsilciFilter, kesimAlaniFilter, aiCategoryFilter, sortBy, sortDir, page]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["pool-donations", projectId, filters],
    queryFn: () => fetchPoolDonations(projectId, filters),
    enabled: !!projectId,
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ["pool-stats", projectId],
    queryFn: () => fetchPoolStats(projectId),
    enabled: !!projectId,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const projectName = projects?.find(p => p.id === projectId)?.name || "";
  const items = data?.items || [];
  const total = data?.total || 0;
  const kesimAlanlari = data?.kesimAlanlari || [];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const multiLocationVekalets = useMemo(() => {
    return new Set(stats?.multiLocationVekalets || []);
  }, [stats?.multiLocationVekalets]);

  const toggleColumn = useCallback((key: TableColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem(`bagis-havuzu-columns-${projectId}`, JSON.stringify([...next]));
      return next;
    });
  }, [projectId]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("");
    setDonationTypeFilter("");
    setBirimFilter("");
    setTemsilciFilter("");
    setKesimAlaniFilter("");
    setAiCategoryFilter("");
    setPage(0);
  }, []);

  const invalidatePool = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pool-donations"] });
    queryClient.invalidateQueries({ queryKey: ["pool-stats"] });
  }, [queryClient]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  }, [items, selectedIds.size]);

  const handleBulkAction = useCallback(async (action: "exclude" | "include" | "delete") => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const labels: Record<string, string> = { exclude: "sepete atıldı", include: "havuza alındı", delete: "silindi" };
    try {
      const result = await bulkActionDonations(projectId, ids, action);
      toast({ title: `${result.affected} bağış ${labels[action]}` });
      setSelectedIds(new Set());
      invalidatePool();
    } catch (err) {
      toast({ title: "İşlem başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    }
  }, [selectedIds, projectId, toast, invalidatePool]);

  const handleTransfer = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setTransferring(true);
    try {
      let targetId = transferTarget;
      if (creatingNewList && newListName.trim()) {
        const newKA = await createKesimAlani({
          id: crypto.randomUUID(),
          name: newListName.trim(),
          donations: [],
          animalGroups: [],
          teams: [],
          createdAt: new Date().toISOString(),
          projectId,
        });
        targetId = newKA.id;
      }
      if (!targetId) {
        toast({ title: "Hedef kesim listesi seçin veya yeni bir tane oluşturun", variant: "destructive" });
        setTransferring(false);
        return;
      }
      const result = await transferDonationsToKA(projectId, [...selectedIds], targetId);
      toast({ title: `${result.moved} bağış aktarıldı` });
      setSelectedIds(new Set());
      setTransferOpen(false);
      setTransferTarget("");
      setNewListName("");
      setCreatingNewList(false);
      invalidatePool();
    } catch (err) {
      toast({ title: "Aktarma başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  }, [selectedIds, transferTarget, creatingNewList, newListName, projectId, toast, invalidatePool]);

  const handleAiClassify = useCallback(async () => {
    const donationsToClassify = selectedIds.size > 0
      ? items.filter(i => selectedIds.has(i.id))
      : items;
    if (donationsToClassify.length === 0) return;
    setAiProcessing(true);
    try {
      const aiDonations = donationsToClassify.map(d => ({
        id: d.id, name: d.name, donationType: d.donationType, vekalet: d.vekalet, notes: d.notes,
      }));
      const { jobId } = await classifyNotesAsync(aiDonations);
      toast({ title: `AI sınıflandırma başlatıldı (${aiDonations.length} bağış)` });
      if (aiPollRef.current) clearInterval(aiPollRef.current);
      aiPollRef.current = setInterval(async () => {
        try {
          const status = await fetchJobStatus(jobId);
          if (status.status === "completed" || status.status === "failed") {
            clearInterval(aiPollRef.current);
            aiPollRef.current = undefined;
            if (status.status === "completed" && status.results && status.results.length > 0) {
              const classifications = status.results.map(r => ({
                donationId: r.donationId,
                categories: r.categories,
                warnings: r.warnings,
              }));
              await saveAiClassifications(classifications);
            }
            setAiProcessing(false);
            invalidatePool();
            toast({
              title: status.status === "completed" ? "AI sınıflandırma tamamlandı" : "AI sınıflandırma başarısız",
              variant: status.status === "failed" ? "destructive" : undefined,
            });
          }
        } catch {
          clearInterval(aiPollRef.current);
          aiPollRef.current = undefined;
          setAiProcessing(false);
        }
      }, 3000);
    } catch (err) {
      setAiProcessing(false);
      toast({ title: "AI sınıflandırma başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    }
  }, [items, selectedIds, toast, invalidatePool]);

  const getXLSX = useCallback(() => import("xlsx-js-style"), []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        if (rows.length > 0) processRawData(rows);
      } catch {
        toast({ title: "Excel dosyası okunamadı", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [getXLSX, toast]);

  const handlePasteData = useCallback(() => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split("\n");
    const rows = lines.map(line => line.split("\t").map(c => c.trim()));
    processRawData(rows);
  }, [pasteText]);

  function processRawData(rows: string[][]) {
    setPreviewData(rows);
    const colCount = Math.max(...rows.map(r => r.length));
    if (rows.length > 0 && hasHeaderRow) {
      const headers = rows[0].map(cell => String(cell ?? "").trim());
      const smartMappings = autoMapColumns(headers);
      while (smartMappings.length < colCount) smartMappings.push("skip");
      setColumnMappings(smartMappings);
    } else {
      const defaultMappings: ColumnMapping[] = [];
      const defaults: ColumnMapping[] = ["vekalet", "description", "name", "donationType", "shareCount", "notes"];
      for (let i = 0; i < colCount; i++) {
        defaultMappings.push(i < defaults.length ? defaults[i] : "skip");
      }
      setColumnMappings(defaultMappings);
    }
    setImportStep("mapping");
  }

  const displayPreviewRows = useMemo(() => {
    if (previewData.length === 0) return [];
    return hasHeaderRow ? previewData.slice(1) : previewData;
  }, [previewData, hasHeaderRow]);

  const headerRow = useMemo(() => {
    if (!hasHeaderRow || previewData.length === 0) return null;
    return previewData[0];
  }, [hasHeaderRow, previewData]);

  const handleImport = useCallback(async () => {
    if (!importTargetKA || displayPreviewRows.length === 0) {
      toast({ title: "Hedef kesim listesi seçin", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      interface ImportDonation {
        id: string; name: string; description: string; donationType: string;
        shareCount: number; vekalet: string; notes: string; phone: string;
        birim: string; temsilci: string; kesimAlaniId: string;
      }
      const donations = displayPreviewRows.map((row): ImportDonation => {
        const d: ImportDonation = {
          id: crypto.randomUUID(), name: "", description: "", donationType: "",
          shareCount: 1, vekalet: "", notes: "", phone: "", birim: "", temsilci: "",
          kesimAlaniId: importTargetKA,
        };
        const notesParts: string[] = [];
        for (let c = 0; c < columnMappings.length; c++) {
          const mapping = columnMappings[c];
          const val = String(row[c] ?? "").trim();
          if (mapping === "skip" || !val) continue;
          if (mapping === "shareCount") {
            d.shareCount = Math.max(1, parseInt(val, 10) || 1);
          } else if (mapping === "notes") {
            notesParts.push(val);
          } else if (mapping === "name") {
            d.name = val;
          } else if (mapping === "description") {
            d.description = val;
          } else if (mapping === "donationType") {
            d.donationType = val;
          } else if (mapping === "vekalet") {
            d.vekalet = val;
          } else if (mapping === "phone") {
            d.phone = val;
          } else if (mapping === "birim") {
            d.birim = val;
          } else if (mapping === "temsilci") {
            d.temsilci = val;
          }
        }
        d.notes = notesParts.join(" | ");
        return d;
      }).filter((d: ImportDonation) => d.name);

      if (donations.length === 0) {
        toast({ title: "İsim sütunu eşleştirilmemiş veya boş", variant: "destructive" });
        setImporting(false);
        return;
      }

      const vekaletValues = donations.map(d => d.vekalet).filter(Boolean);
      if (vekaletValues.length > 0) {
        const { conflicts } = await checkVekaletConflicts(projectId, vekaletValues);
        if (conflicts.length > 0) {
          const uniqueConflicts = new Set(conflicts.map(c => c.vekalet));
          const proceed = window.confirm(
            `Dikkat: ${uniqueConflicts.size} vekalet numarası zaten başka yerlerde mevcut:\n${[...uniqueConflicts].slice(0, 10).join(", ")}${uniqueConflicts.size > 10 ? ` ve ${uniqueConflicts.size - 10} adet daha...` : ""}\n\nDevam etmek istiyor musunuz?`
          );
          if (!proceed) {
            setImporting(false);
            return;
          }
        }
      }

      const result = await bulkImportDonations(projectId, donations);
      toast({ title: `${result.inserted} bağış eklendi` });
      resetImport();
      invalidatePool();
    } catch (err) {
      toast({ title: "Yükleme başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }, [importTargetKA, displayPreviewRows, columnMappings, projectId, toast, invalidatePool]);

  function resetImport() {
    setImportOpen(false);
    setImportStep("input");
    setImportMode("upload");
    setPasteText("");
    setPreviewData([]);
    setColumnMappings([]);
    setHasHeaderRow(true);
    setImportTargetKA("");
  }

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation(`/proje/${projectId}`)}>
            <ArrowLeft className="w-4 h-4 mr-1" />Geri
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Bağış Havuzu
            </h1>
            <p className="text-sm text-muted-foreground">{projectName} — {total} bağış</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setShowStats(!showStats)}>
              <BarChart3 className="w-4 h-4 mr-1" />İstatistik
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-1" />Toplu Yükle
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={handleAiClassify}
              disabled={aiProcessing || items.length === 0}
            >
              {aiProcessing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              AI Sınıflandır
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {showStats && stats && <StatsPanel stats={stats} />}

        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Ara..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-8 h-9"
            />
            {search && (
              <button onClick={() => { setSearch(""); setDebouncedSearch(""); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filtre
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{activeFilterCount}</Badge>
            )}
          </Button>

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />Temizle
            </Button>
          )}

          <div className="relative" ref={columnPickerRef}>
            <Button variant="outline" size="sm" onClick={() => setShowColumnPicker(!showColumnPicker)}>
              <Settings2 className="w-4 h-4 mr-1" />Sütunlar
            </Button>
            {showColumnPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-background border rounded-lg shadow-lg p-2 min-w-[180px]">
                {ALL_TABLE_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded"
                    />
                    {col.label}
                  </label>
                ))}
                <div className="border-t mt-1 pt-1">
                  <button
                    className="w-full text-xs text-muted-foreground hover:text-foreground px-2 py-1 text-left rounded hover:bg-muted/50"
                    onClick={() => {
                      const defaults = new Set(ALL_TABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
                      setVisibleColumns(defaults);
                      localStorage.removeItem(`bagis-havuzu-columns-${projectId}`);
                    }}
                  >
                    Varsayılanlara dön
                  </button>
                </div>
              </div>
            )}
          </div>

          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-3 p-3 border rounded-lg bg-muted/30">
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === "all" ? "" : v); setPage(0); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="excluded">Sepette</SelectItem>
              </SelectContent>
            </Select>

            <Select value={kesimAlaniFilter} onValueChange={v => { setKesimAlaniFilter(v === "all" ? "" : v); setPage(0); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Kesim Listesi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {kesimAlanlari.map(ka => (
                  <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {stats && stats.typeDistribution.length > 0 && (
              <Select value={donationTypeFilter} onValueChange={v => { setDonationTypeFilter(v === "all" ? "" : v); setPage(0); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cinsi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {stats.typeDistribution.map(t => (
                    <SelectItem key={t.type} value={t.type}>{t.type} ({t.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {stats && stats.birimDistribution.length > 0 && (
              <Select value={birimFilter} onValueChange={v => { setBirimFilter(v === "all" ? "" : v); setPage(0); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Birim" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {stats.birimDistribution.map(b => (
                    <SelectItem key={b.birim} value={b.birim}>{b.birim} ({b.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {stats && stats.temsilciDistribution.length > 0 && (
              <Select value={temsilciFilter} onValueChange={v => { setTemsilciFilter(v === "all" ? "" : v); setPage(0); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Temsilci" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {stats.temsilciDistribution.map(t => (
                    <SelectItem key={t.temsilci} value={t.temsilci}>{t.temsilci} ({t.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Input
              placeholder="AI Etiketi..."
              value={aiCategoryFilter}
              onChange={e => { setAiCategoryFilter(e.target.value); setPage(0); }}
              className="h-8 text-xs"
            />

            <Select value={sortBy} onValueChange={v => { setSortBy(v); setPage(0); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sıralama" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sortOrder">Varsayılan</SelectItem>
                <SelectItem value="name">İsim</SelectItem>
                <SelectItem value="shareCount">Hisse</SelectItem>
                <SelectItem value="donationType">Cinsi</SelectItem>
                <SelectItem value="birim">Birim</SelectItem>
                <SelectItem value="temsilci">Temsilci</SelectItem>
                <SelectItem value="kesimAlaniId">Kesim Listesi</SelectItem>
                <SelectItem value="vekalet">Vekalet</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
            >
              {sortDir === "asc" ? "A→Z" : "Z→A"}
            </Button>
          </div>
        )}

        {multiLocationVekalets.size > 0 && (
          <div className="flex items-center gap-2 mb-3 p-2 border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <p className="text-xs text-orange-700 dark:text-orange-300">
              <strong>{multiLocationVekalets.size}</strong> vekalet numarası birden fazla kesim listesinde mevcut:{" "}
              {[...multiLocationVekalets].slice(0, 5).join(", ")}
              {multiLocationVekalets.size > 5 && ` ve ${multiLocationVekalets.size - 5} adet daha`}
            </p>
          </div>
        )}

        <VirtualizedDonationTable
          items={items}
          isLoading={isLoading}
          activeFilterCount={activeFilterCount}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          multiLocationVekalets={multiLocationVekalets}
          visibleColumns={visibleColumns}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Önceki</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sonraki</Button>
            </div>
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 z-50">
            <span className="text-sm font-medium">{selectedIds.size} bağış seçili</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="w-4 h-4 mr-1" />Listeye Aktar
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("exclude")}>
                <ShoppingBasket className="w-4 h-4 mr-1" />Sepete At
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("include")}>
                <ListChecks className="w-4 h-4 mr-1" />Havuza Al
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkAction("delete")}>
                <Trash2 className="w-4 h-4 mr-1" />Sil
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Kesim Listesine Aktar</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">{selectedIds.size} bağış aktarılacak.</p>
            <div className="space-y-3">
              <Select value={transferTarget} onValueChange={(v) => { setTransferTarget(v); setCreatingNewList(false); }}>
                <SelectTrigger><SelectValue placeholder="Mevcut kesim listesi seçin..." /></SelectTrigger>
                <SelectContent>
                  {kesimAlanlari.map(ka => (
                    <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 h-px bg-border" />
                <span>veya</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Yeni kesim listesi adı..."
                  value={newListName}
                  onChange={(e) => { setNewListName(e.target.value); if (e.target.value) { setTransferTarget(""); setCreatingNewList(true); } else { setCreatingNewList(false); } }}
                  className="h-9 flex-1"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => { setTransferOpen(false); setNewListName(""); setCreatingNewList(false); }}>İptal</Button>
              <Button className="flex-1" onClick={handleTransfer} disabled={(!transferTarget && !creatingNewList) || transferring || (creatingNewList && !newListName.trim())}>
                {transferring ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-1" />}
                Aktar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={importOpen} onOpenChange={(open) => { if (!open) resetImport(); else setImportOpen(true); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>{importStep === "input" ? "Toplu Bağış Yükle" : "Sütun Eşleştirme"}</DialogTitle>
            </DialogHeader>

            {importStep === "input" && (
              <div className="space-y-4 pt-4">
                <div className="flex gap-2">
                  <Button variant={importMode === "upload" ? "default" : "outline"} size="sm" onClick={() => setImportMode("upload")} className="flex-1">
                    <FileSpreadsheet className="w-4 h-4 mr-1" />Excel Yükle
                  </Button>
                  <Button variant={importMode === "paste" ? "default" : "outline"} size="sm" onClick={() => setImportMode("paste")} className="flex-1">
                    <ClipboardPaste className="w-4 h-4 mr-1" />Kopyala Yapıştır
                  </Button>
                </div>
                {importMode === "upload" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Excel dosyanızı (.xlsx, .xls, .csv) seçin.</p>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                      <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium">Excel dosyası seçmek için tıklayın</p>
                      <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv desteklenir</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                  </div>
                )}
                {importMode === "paste" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Excel'den kopyaladığınız verileri yapıştırın.</p>
                    <textarea className="w-full h-48 p-3 border rounded-md bg-background text-foreground font-mono text-sm resize-none" placeholder={"Ali Yılmaz\tAnkara\tAdak\t1"} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
                    <Button onClick={handlePasteData} className="w-full" disabled={!pasteText.trim()}>Devam Et</Button>
                  </div>
                )}
              </div>
            )}

            {importStep === "mapping" && (
              <div className="flex flex-col min-h-0 flex-1 pt-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-3 flex-shrink-0">
                  <Settings2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Her sütunun hangi bilgiye karşılık geldiğini seçin.</p>
                </div>
                <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                  <input type="checkbox" id="poolHasHeader" checked={hasHeaderRow} onChange={(e) => setHasHeaderRow(e.target.checked)} className="rounded" />
                  <label htmlFor="poolHasHeader" className="text-sm font-medium">İlk satır başlık satırıdır</label>
                </div>

                <div className="mb-3 flex-shrink-0">
                  <label className="text-sm font-medium mb-1 block">Hedef Kesim Listesi</label>
                  <Select value={importTargetKA} onValueChange={setImportTargetKA}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Yüklenecek kesim listesini seçin..." /></SelectTrigger>
                    <SelectContent>
                      {kesimAlanlari.map(ka => (
                        <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg overflow-hidden min-h-0 flex-1">
                  <div className="overflow-auto max-h-full thick-scrollbar">
                    <table className="w-full text-sm" style={{ minWidth: columnMappings.length * 150 + "px" }}>
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-primary/10 border-b">
                          {columnMappings.map((mapping, colIdx) => (
                            <th key={colIdx} className={`p-2 min-w-[140px] ${mapping === "skip" ? "bg-orange-100 dark:bg-orange-950/40" : ""}`}>
                              <Select value={mapping} onValueChange={(v) => { const m = [...columnMappings]; m[colIdx] = v as ColumnMapping; setColumnMappings(m); }}>
                                <SelectTrigger className={`h-8 text-xs ${mapping === "skip" ? "border-orange-400 bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 font-semibold" : ""}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {POOL_COLUMN_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.value === "skip" ? <span className="text-orange-600 font-semibold flex items-center gap-1"><Ban className="w-3.5 h-3.5" />{opt.label}</span> : opt.label}
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
                              <td key={idx} className={`p-2 text-xs text-muted-foreground font-medium ${columnMappings[idx] === "skip" ? "bg-orange-50/50 dark:bg-orange-950/20" : ""}`}>{cell || "—"}</td>
                            ))}
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {displayPreviewRows.slice(0, 5).map((row, rIdx) => (
                          <tr key={rIdx} className="border-b">
                            {columnMappings.map((mapping, cIdx) => (
                              <td key={cIdx} className={`p-2 text-xs ${mapping === "skip" ? "text-orange-400/60 line-through bg-orange-50/30 dark:bg-orange-950/10" : ""}`}>{row[cIdx] || "—"}</td>
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
                <div className="flex gap-2 pt-4 flex-shrink-0">
                  <Button variant="outline" onClick={() => setImportStep("input")} className="flex-1">Geri</Button>
                  <Button onClick={handleImport} className="flex-1" disabled={importing || !importTargetKA}>
                    {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                    {displayPreviewRows.length} Bağış Yükle
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function StatsPanel({ stats }: { stats: PoolStats }) {
  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Toplam</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Aktif</p>
                <p className="text-lg font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ShoppingBasket className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Sepet</p>
                <p className="text-lg font-bold">{stats.excluded}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Toplam Hisse</p>
                <p className="text-lg font-bold">{stats.total_shares}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(stats.birimDistribution.length > 0 || stats.temsilciDistribution.length > 0 || stats.typeDistribution.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stats.birimDistribution.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-1"><CardTitle className="text-xs flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />Birim Dağılımı</CardTitle></CardHeader>
              <CardContent className="p-3 pt-1">
                <div className="space-y-1 max-h-32 overflow-auto">
                  {stats.birimDistribution.map(b => (
                    <div key={b.birim} className="flex justify-between text-xs">
                      <span className="truncate">{b.birim}</span>
                      <span className="text-muted-foreground ml-2">{b.count} ({b.shares} hisse)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {stats.temsilciDistribution.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-1"><CardTitle className="text-xs flex items-center gap-1"><Users className="w-3.5 h-3.5" />Temsilci Dağılımı</CardTitle></CardHeader>
              <CardContent className="p-3 pt-1">
                <div className="space-y-1 max-h-32 overflow-auto">
                  {stats.temsilciDistribution.map(t => (
                    <div key={t.temsilci} className="flex justify-between text-xs">
                      <span className="truncate">{t.temsilci}</span>
                      <span className="text-muted-foreground ml-2">{t.count} ({t.shares} hisse)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {stats.typeDistribution.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-1"><CardTitle className="text-xs flex items-center gap-1"><Tag className="w-3.5 h-3.5" />Cinsi Dağılımı</CardTitle></CardHeader>
              <CardContent className="p-3 pt-1">
                <div className="space-y-1 max-h-32 overflow-auto">
                  {stats.typeDistribution.map(t => (
                    <div key={t.type} className="flex justify-between text-xs">
                      <span className="truncate">{t.type}</span>
                      <span className="text-muted-foreground ml-2">{t.count} ({t.shares} hisse)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {stats.kesimAlaniDistribution.length > 0 && (
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs">Kesim Listesi Dağılımı</CardTitle></CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {stats.kesimAlaniDistribution.map(ka => (
                <div key={ka.id} className="text-xs p-2 border rounded bg-muted/30">
                  <span className="font-medium">{ka.name}</span>
                  <span className="text-muted-foreground ml-1">({ka.count} bağış, {ka.shares} hisse)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
