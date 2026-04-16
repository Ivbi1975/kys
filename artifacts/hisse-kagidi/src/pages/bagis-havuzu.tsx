import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Upload, Search, X, Filter, Package,
  BarChart3, Loader2, AlertTriangle, Settings2, Zap, Trash2, ListPlus, FileSpreadsheet, Brain,
} from "lucide-react";
import {
  fetchPoolDonations, fetchPoolStats,
  bulkActionDonations, bulkTagDonations, bulkNoteDonations,
  classifyNotesAsyncChunked, PartialChunkError, ApiFetchError,
  fetchJobStatus, cancelJob, fetchProjects, saveAiClassifications,
  transferDonationsToKA, createKesimAlani,
  fetchTags, createTag,
  flagDonation, unflagDonation,
  updatePoolDonationField,
  deleteAllPoolDonations,
  fetchDonationSiblings,
  previewBulkDeleteFiltered,
  bulkDeleteFiltered,
} from "@/lib/api";
import type { BulkDeletePreviewResult } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatsPanel } from "./bagis-havuzu/StatsPanel";
import { VirtualizedDonationTable } from "./bagis-havuzu/VirtualizedDonationTable";
import { PoolFilters } from "./bagis-havuzu/PoolFilters";
import { PoolBulkActions } from "./bagis-havuzu/PoolBulkActions";
import { TransferDialog } from "./bagis-havuzu/TransferDialog";
import { BulkCreateListeDialog } from "./bagis-havuzu/BulkCreateListeDialog";
import { ImportWizard } from "./bagis-havuzu/ImportWizard";
import { BulkTagDialog } from "./bagis-havuzu/BulkTagDialog";
import { AutomationRulesPanel } from "./bagis-havuzu/AutomationRulesPanel";
import { BulkNoteDialog } from "./bagis-havuzu/BulkNoteDialog";
import { CinsStatsBar } from "./bagis-havuzu/CinsStatsBar";
import { HavuzAiClassification, type HavuzAiResult } from "./bagis-havuzu/HavuzAiClassification";
import { BulkDeleteFilteredDialog } from "./bagis-havuzu/BulkDeleteFilteredDialog";
import { ALL_TABLE_COLUMNS, PAGE_SIZE, type TableColumnKey } from "./bagis-havuzu/types";
import type { CustomTag, PoolDonation } from "@/lib/types";
import { trUpperCase } from "@/lib/utils";
import { loadBasketFromStorage, saveBasketToStorage } from "@/components/kesim-alani/hooks/types";
import type { BasketItem } from "@/components/kesim-alani/hooks/types";
import type { TransferredItem } from "@/lib/api/bagis-havuzu";

const TEXT_COLUMNS_SET = new Set<TableColumnKey>([
  "name", "description", "donationType", "birim", "temsilci",
  "ozellik", "fiyat", "yerTalebi", "gunTalebi", "ilkHayvan", "safi", "notes",
]);

function getDonationCellValue(d: PoolDonation, key: TableColumnKey): string | number {
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

function parseUrlMulti(val: string | null): string[] {
  if (!val) return [];
  return val.split(",").map(v => v.trim()).filter(Boolean);
}

function serializeMulti(arr: string[]): string {
  return arr.join(",");
}

export default function BagisHavuzuPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id || "";
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const urlParams = useMemo(() => new URLSearchParams(searchString), [searchString]);

  const [search, setSearch] = useState(() => urlParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => urlParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(() => urlParams.get("status") || "");
  const [donationTypeFilter, setDonationTypeFilter] = useState<string[]>(() => parseUrlMulti(urlParams.get("type")));
  const [birimFilter, setBirimFilter] = useState<string[]>(() => parseUrlMulti(urlParams.get("birim")));
  const [temsilciFilter, setTemsilciFilter] = useState<string[]>(() => parseUrlMulti(urlParams.get("temsilci")));
  const [kesimAlaniFilter, setKesimAlaniFilter] = useState(() => urlParams.get("ka") || "");
  const [aiCategoryFilter, setAiCategoryFilter] = useState(() => urlParams.get("ai") || "");
  const [ozellikFilter, setOzellikFilter] = useState<string[]>(() => parseUrlMulti(urlParams.get("ozellik")));
  const [fiyatFilter, setFiyatFilter] = useState<string[]>(() => parseUrlMulti(urlParams.get("fiyat")));
  const [yerTalebiFilter, setYerTalebiFilter] = useState<string[]>(() => parseUrlMulti(urlParams.get("yer")));
  const [gunTalebiFilter, setGunTalebiFilter] = useState<string[]>(() => parseUrlMulti(urlParams.get("gun")));
  const [ilkHayvanFilter, setIlkHayvanFilter] = useState<string[]>(() => parseUrlMulti(urlParams.get("hayvan")));
  const [safiFilter, setSafiFilter] = useState<string[]>(() => parseUrlMulti(urlParams.get("safi")));
  const [tagFilter, setTagFilter] = useState<string[]>(() => parseUrlMulti(urlParams.get("tags")));
  const [notesFilter, setNotesFilter] = useState(() => urlParams.get("notes") || "");
  const [page, setPage] = useState(() => Number(urlParams.get("p")) || 0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [sortBy, setSortBy] = useState(() => urlParams.get("sort") || "sortOrder");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => (urlParams.get("dir") === "desc" ? "desc" : "asc"));
  const [sortBy2, setSortBy2] = useState(() => urlParams.get("sort2") || "");
  const [sortDir2, setSortDir2] = useState<"asc" | "desc">(() => (urlParams.get("dir2") === "desc" ? "desc" : "asc"));
  const [sortBy3, setSortBy3] = useState(() => urlParams.get("sort3") || "");
  const [sortDir3, setSortDir3] = useState<"asc" | "desc">(() => (urlParams.get("dir3") === "desc" ? "desc" : "asc"));
  const [shareCountMin, setShareCountMin] = useState(() => urlParams.get("scMin") || "");
  const [shareCountMax, setShareCountMax] = useState(() => urlParams.get("scMax") || "");
  const [excludeFields, setExcludeFields] = useState<Set<string>>(() => {
    const v = urlParams.get("excl");
    return v ? new Set(v.split(",").filter(Boolean)) : new Set();
  });
  const [dateField, setDateField] = useState(() => urlParams.get("dateField") || "updatedAt");
  const [dateFrom, setDateFrom] = useState(() => urlParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(() => urlParams.get("dateTo") || "");
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<TableColumnKey>>(() => {
    const stored = localStorage.getItem(`bagis-havuzu-columns-${projectId}`);
    if (stored) {
      try { return new Set(JSON.parse(stored) as TableColumnKey[]); } catch { /* ignore */ }
    }
    return new Set(ALL_TABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
  });

  const [showRules, setShowRules] = useState(false);
  const [bulkCreateListeOpen, setBulkCreateListeOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [bulkDeleteFilteredOpen, setBulkDeleteFilteredOpen] = useState(false);
  const [bulkDeleteFilteredPreview, setBulkDeleteFilteredPreview] = useState<BulkDeletePreviewResult | null>(null);
  const [bulkDeleteFilteredLoading, setBulkDeleteFilteredLoading] = useState(false);
  const [bulkDeleteFilteredDeleting, setBulkDeleteFilteredDeleting] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingNewList, setCreatingNewList] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiStopped, setAiStopped] = useState(false);
  const [aiResults, setAiResults] = useState<Map<string, HavuzAiResult>>(new Map());
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiBatchSize, setAiBatchSize] = useState(25);
  const [aiRangeMode, setAiRangeMode] = useState<"all" | "selected">("all");
  const [aiSkipClassified, setAiSkipClassified] = useState(false);
  const [showAiReport, setShowAiReport] = useState(false);
  const [aiReportCollapsed, setAiReportCollapsed] = useState(false);
  const [aiErrorBatches, setAiErrorBatches] = useState(0);
  const [aiTotalBatches, setAiTotalBatches] = useState(0);
  const [siblingCount, setSiblingCount] = useState(0);
  const activeJobIdsRef = useRef<string[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const siblingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => { stopPolling(); };
  }, [stopPolling]);

  useEffect(() => {
    const ids = selectAllPages && allFilteredIds.length > 0
      ? allFilteredIds
      : [...selectedIds];
    if (ids.length === 0) {
      setSiblingCount(0);
      return;
    }
    clearTimeout(siblingTimerRef.current);
    siblingTimerRef.current = setTimeout(async () => {
      try {
        const result = await fetchDonationSiblings(projectId, ids);
        const total = result.siblings.reduce((sum, s) => sum + s.extraCount, 0);
        setSiblingCount(total);
      } catch {
        setSiblingCount(0);
      }
    }, 600);
    return () => clearTimeout(siblingTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, selectAllPages, allFilteredIds, projectId]);

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

  useEffect(() => {
    const p = new URLSearchParams();
    if (debouncedSearch) p.set("q", debouncedSearch);
    if (statusFilter) p.set("status", statusFilter);
    if (donationTypeFilter.length) p.set("type", serializeMulti(donationTypeFilter));
    if (birimFilter.length) p.set("birim", serializeMulti(birimFilter));
    if (temsilciFilter.length) p.set("temsilci", serializeMulti(temsilciFilter));
    if (kesimAlaniFilter) p.set("ka", kesimAlaniFilter);
    if (aiCategoryFilter) p.set("ai", aiCategoryFilter);
    if (ozellikFilter.length) p.set("ozellik", serializeMulti(ozellikFilter));
    if (fiyatFilter.length) p.set("fiyat", serializeMulti(fiyatFilter));
    if (yerTalebiFilter.length) p.set("yer", serializeMulti(yerTalebiFilter));
    if (gunTalebiFilter.length) p.set("gun", serializeMulti(gunTalebiFilter));
    if (ilkHayvanFilter.length) p.set("hayvan", serializeMulti(ilkHayvanFilter));
    if (safiFilter.length) p.set("safi", serializeMulti(safiFilter));
    if (tagFilter.length) p.set("tags", serializeMulti(tagFilter));
    if (notesFilter) p.set("notes", notesFilter);
    if (sortBy !== "sortOrder") p.set("sort", sortBy);
    if (sortDir !== "asc") p.set("dir", sortDir);
    if (sortBy2) p.set("sort2", sortBy2);
    if (sortDir2 !== "asc") p.set("dir2", sortDir2);
    if (sortBy3) p.set("sort3", sortBy3);
    if (sortDir3 !== "asc") p.set("dir3", sortDir3);
    if (shareCountMin) p.set("scMin", shareCountMin);
    if (shareCountMax) p.set("scMax", shareCountMax);
    if (excludeFields.size > 0) p.set("excl", [...excludeFields].join(","));
    if (dateField && dateField !== "updatedAt") p.set("dateField", dateField);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    if (page > 0) p.set("p", String(page));
    const qs = p.toString();
    const newUrl = `/bagis-havuzu/${projectId}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", import.meta.env.BASE_URL.replace(/\/$/, "") + newUrl);
  }, [debouncedSearch, statusFilter, donationTypeFilter, birimFilter, temsilciFilter, kesimAlaniFilter, aiCategoryFilter, ozellikFilter, fiyatFilter, yerTalebiFilter, gunTalebiFilter, ilkHayvanFilter, safiFilter, tagFilter, notesFilter, sortBy, sortDir, sortBy2, sortDir2, sortBy3, sortDir3, shareCountMin, shareCountMax, excludeFields, dateField, dateFrom, dateTo, page, projectId]);

  const toggleExcludeField = useCallback((field: string) => {
    setExcludeFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  }, []);

  const activeFilterCount = [
    debouncedSearch, statusFilter, kesimAlaniFilter, aiCategoryFilter, notesFilter, shareCountMin, shareCountMax, dateFrom, dateTo,
  ].filter(Boolean).length
  + [donationTypeFilter, birimFilter, temsilciFilter, ozellikFilter, fiyatFilter, yerTalebiFilter, gunTalebiFilter, ilkHayvanFilter, safiFilter, tagFilter].filter(a => a.length > 0).length;

  const excludeFieldsStr = useMemo(() => [...excludeFields].join(","), [excludeFields]);

  const statsFilters = useMemo(() => ({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    donationType: donationTypeFilter.length ? serializeMulti(donationTypeFilter) : undefined,
    birim: birimFilter.length ? serializeMulti(birimFilter) : undefined,
    temsilci: temsilciFilter.length ? serializeMulti(temsilciFilter) : undefined,
    kesimAlaniId: kesimAlaniFilter || undefined,
    aiCategory: aiCategoryFilter || undefined,
    ozellik: ozellikFilter.length ? serializeMulti(ozellikFilter) : undefined,
    fiyat: fiyatFilter.length ? serializeMulti(fiyatFilter) : undefined,
    yerTalebi: yerTalebiFilter.length ? serializeMulti(yerTalebiFilter) : undefined,
    gunTalebi: gunTalebiFilter.length ? serializeMulti(gunTalebiFilter) : undefined,
    ilkHayvan: ilkHayvanFilter.length ? serializeMulti(ilkHayvanFilter) : undefined,
    safi: safiFilter.length ? serializeMulti(safiFilter) : undefined,
    tagIds: tagFilter.length ? serializeMulti(tagFilter) : undefined,
    notesFilter: notesFilter || undefined,
    shareCountMin: shareCountMin ? Number(shareCountMin) : undefined,
    shareCountMax: shareCountMax ? Number(shareCountMax) : undefined,
    excludeFields: excludeFieldsStr || undefined,
    dateField: dateField !== "updatedAt" ? dateField : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [debouncedSearch, statusFilter, donationTypeFilter, birimFilter, temsilciFilter, kesimAlaniFilter, aiCategoryFilter, ozellikFilter, fiyatFilter, yerTalebiFilter, gunTalebiFilter, ilkHayvanFilter, safiFilter, tagFilter, notesFilter, shareCountMin, shareCountMax, excludeFieldsStr, dateField, dateFrom, dateTo]);

  const filters = useMemo(() => ({
    ...statsFilters,
    sortBy: sortBy !== "sortOrder" ? sortBy : undefined,
    sortDir: sortDir !== "asc" ? sortDir : undefined,
    sortBy2: sortBy2 || undefined,
    sortDir2: sortDir2 !== "asc" ? sortDir2 : undefined,
    sortBy3: sortBy3 || undefined,
    sortDir3: sortDir3 !== "asc" ? sortDir3 : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [statsFilters, sortBy, sortDir, sortBy2, sortDir2, sortBy3, sortDir3, page]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["pool-donations", projectId, filters],
    queryFn: () => fetchPoolDonations(projectId, filters),
    enabled: !!projectId,
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ["pool-stats", projectId, statsFilters],
    queryFn: () => fetchPoolStats(projectId, statsFilters),
    enabled: !!projectId,
    placeholderData: (prev) => prev,
  });

  const { data: globalTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: fetchTags,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const projectName = projects?.find(p => p.id === projectId)?.name || "";
  const items = data?.items || [];
  const total = data?.total || 0;
  const allFilteredIds = data?.allFilteredIds || [];
  const kesimAlanlari = (data?.kesimAlanlari || []).filter(ka => ka.name !== "__havuz__");
  const donorMissedCounts = data?.donorMissedCounts || {};
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const multiLocationVekalets = useMemo(() => {
    return new Set(stats?.multiLocationVekalets || []);
  }, [stats?.multiLocationVekalets]);

  const effectiveSelectedIds = useMemo(() => {
    if (selectAllPages && allFilteredIds.length > 0) {
      return new Set(allFilteredIds);
    }
    return selectedIds;
  }, [selectAllPages, allFilteredIds, selectedIds]);

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
    setDonationTypeFilter([]);
    setBirimFilter([]);
    setTemsilciFilter([]);
    setKesimAlaniFilter("");
    setAiCategoryFilter("");
    setOzellikFilter([]);
    setFiyatFilter([]);
    setYerTalebiFilter([]);
    setGunTalebiFilter([]);
    setIlkHayvanFilter([]);
    setSafiFilter([]);
    setTagFilter([]);
    setNotesFilter("");
    setShareCountMin("");
    setShareCountMax("");
    setExcludeFields(new Set());
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }, []);

  const invalidatePool = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pool-donations"] });
    queryClient.invalidateQueries({ queryKey: ["pool-stats"] });
  }, [queryClient]);

  const handleFlagDonation = useCallback(async (id: string, reason: string) => {
    try {
      await flagDonation(projectId, id, reason);
      invalidatePool();
      toast({ title: "Bağış işaretlendi", description: reason });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }, [projectId, invalidatePool, toast]);

  const handleUnflagDonation = useCallback(async (id: string) => {
    try {
      await unflagDonation(projectId, id);
      invalidatePool();
      toast({ title: "İşaret kaldırıldı" });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }, [projectId, invalidatePool, toast]);

  const handleInlineEdit = useCallback(async (donationId: string, field: string, value: string) => {
    const isNumeric = field === "shareCount";
    const apiValue: string | number = isNumeric ? parseInt(value, 10) || 1 : value;
    const cacheValue = isNumeric ? (parseInt(value, 10) || 1) : value;

    const queryKey = ["pool-donations", projectId];
    queryClient.setQueriesData<{ items: PoolDonation[]; total: number; kesimAlanlari: { id: string; name: string }[]; allFilteredIds: string[] }>(
      { queryKey },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map(d =>
            d.id === donationId ? { ...d, [field]: cacheValue } : d
          ),
        };
      },
    );

    try {
      await updatePoolDonationField(projectId, donationId, field, apiValue);
      invalidatePool();
    } catch (err) {
      invalidatePool();
      toast({ title: "Güncelleme hatası", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }, [projectId, queryClient, invalidatePool, toast]);

  const toggleSelect = useCallback((id: string) => {
    setSelectAllPages(false);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectAllPages) {
      setSelectAllPages(false);
      setSelectedIds(new Set());
      return;
    }
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  }, [items, selectedIds.size, selectAllPages]);

  const handleSelectAllPages = useCallback(() => {
    setSelectAllPages(true);
    setSelectedIds(new Set(allFilteredIds));
  }, [allFilteredIds]);

  const handleBulkAction = useCallback(async (action: "exclude" | "include" | "delete") => {
    const ids = [...effectiveSelectedIds];
    if (ids.length === 0) return;
    const labels: Record<string, string> = { exclude: "sepetten çıkarıldı", include: "sepete eklendi", delete: "silindi" };
    try {
      const result = await bulkActionDonations(projectId, ids, action);
      toast({ title: `${result.affected} bağış ${labels[action]}` });
      setSelectedIds(new Set());
      setSelectAllPages(false);
      invalidatePool();
    } catch (err) {
      toast({ title: "İşlem başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    }
  }, [effectiveSelectedIds, projectId, toast, invalidatePool]);

  const handleBulkTag = useCallback(async (tagId: string, action: "add" | "remove") => {
    const ids = [...effectiveSelectedIds];
    if (ids.length === 0) return;
    try {
      const result = await bulkTagDonations(projectId, ids, tagId, action);
      const tagName = globalTags.find(t => t.id === tagId)?.name || tagId;
      toast({ title: `${result.affected} bağışa "${tagName}" etiketi ${action === "add" ? "eklendi" : "kaldırıldı"}` });
      setSelectedIds(new Set());
      setSelectAllPages(false);
      invalidatePool();
    } catch (err) {
      toast({ title: "Etiketleme başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    }
  }, [effectiveSelectedIds, projectId, globalTags, toast, invalidatePool]);

  const handleBulkNote = useCallback(async (note: string, mode: "append" | "replace") => {
    const ids = [...effectiveSelectedIds];
    if (ids.length === 0) return;
    try {
      const result = await bulkNoteDonations(projectId, ids, note, mode);
      toast({ title: `${result.affected} bağışa not ${mode === "append" ? "eklendi" : "güncellendi"}` });
      setSelectedIds(new Set());
      setSelectAllPages(false);
      invalidatePool();
    } catch (err) {
      toast({ title: "Not ekleme başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    }
  }, [effectiveSelectedIds, projectId, toast, invalidatePool]);

  const handleCreateTag = useCallback(async (name: string, color: string): Promise<CustomTag | null> => {
    try {
      const newTag = await createTag({ id: crypto.randomUUID(), name, color });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      return newTag;
    } catch (err) {
      toast({ title: "Etiket oluşturulamadı", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
      return null;
    }
  }, [queryClient, toast]);

  const handleTransfer = useCallback(async (extraIds: string[] = []) => {
    const baseIds = [...effectiveSelectedIds];
    const ids = extraIds.length > 0
      ? [...new Set([...baseIds, ...extraIds])]
      : baseIds;
    if (ids.length === 0) return;
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
      const result = await transferDonationsToKA(projectId, ids, targetId, true);
      let msg = `${result.moved} bağış aktarıldı`;
      if (result.alreadyInTarget && result.alreadyInTarget > 0) {
        msg += ` (${result.alreadyInTarget} bağış zaten bu listede)`;
      }

      if (result.moved > 0 && result.transferredItems && result.transferredItems.length > 0) {
        const targetKAName = (creatingNewList && newListName.trim())
          ? newListName.trim()
          : kesimAlanlari.find(ka => ka.id === targetId)?.name || "";
        const existingBasket = loadBasketFromStorage(projectId);
        const seenIds = new Set(existingBasket.map(b => b.donationId));
        const now = Date.now();
        const newBasketItems: BasketItem[] = result.transferredItems
          .filter(item => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          })
          .map(item => ({
            type: "donation" as const,
            donationId: item.id,
            kesimAlaniId: targetId,
            kesimAlaniName: targetKAName,
            name: item.name,
            description: item.description || "",
            donationType: item.donationType || "",
            donorShareCount: item.shareCount || 1,
            vekalet: item.vekalet || "",
            donorNotes: item.notes || "",
            addedAt: now,
          }));
        if (newBasketItems.length > 0) {
          saveBasketToStorage([...existingBasket, ...newBasketItems], projectId);
          try {
            const channel = new BroadcastChannel(`basket-${projectId}`);
            channel.postMessage({ type: "basket-update", items: [...existingBasket, ...newBasketItems] });
            channel.close();
          } catch {}
        }
      }

      toast({ title: msg });
      setSelectedIds(new Set());
      setSelectAllPages(false);
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
  }, [effectiveSelectedIds, transferTarget, creatingNewList, newListName, projectId, toast, invalidatePool, kesimAlanlari]);

  const handleDeleteAll = useCallback(async () => {
    setDeletingAll(true);
    try {
      const result = await deleteAllPoolDonations(projectId);
      toast({ title: `${result.affected} bağış silindi` });
      setSelectedIds(new Set());
      setSelectAllPages(false);
      invalidatePool();
    } catch (err) {
      toast({ title: "Silme başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    } finally {
      setDeletingAll(false);
      setDeleteAllDialogOpen(false);
    }
  }, [projectId, toast, invalidatePool]);

  const handleOpenBulkDeleteFiltered = useCallback(async () => {
    setBulkDeleteFilteredOpen(true);
    setBulkDeleteFilteredPreview(null);
    setBulkDeleteFilteredLoading(true);
    try {
      const result = await previewBulkDeleteFiltered(projectId, statsFilters);
      setBulkDeleteFilteredPreview(result);
    } catch (err) {
      toast({ title: "Ön kontrol başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
      setBulkDeleteFilteredOpen(false);
    } finally {
      setBulkDeleteFilteredLoading(false);
    }
  }, [projectId, statsFilters, toast]);

  const handleBulkDeleteFiltered = useCallback(async () => {
    setBulkDeleteFilteredDeleting(true);
    try {
      const result = await bulkDeleteFiltered(projectId, statsFilters);
      toast({ title: `${result.affected} bağış kalıcı olarak silindi` });
      setSelectedIds(new Set());
      setSelectAllPages(false);
      invalidatePool();
      setBulkDeleteFilteredOpen(false);
      setBulkDeleteFilteredPreview(null);
    } catch (err) {
      toast({ title: "Silme başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    } finally {
      setBulkDeleteFilteredDeleting(false);
    }
  }, [projectId, statsFilters, toast, invalidatePool]);

  const handleColumnSort = useCallback((colKey: string) => {
    setSortBy(prev => {
      if (prev === colKey) {
        setSortDir(d => d === "asc" ? "desc" : "asc");
        return prev;
      }
      setSortDir("asc");
      return colKey;
    });
    setPage(0);
  }, []);

  const startPollingJobs = useCallback((jobIds: string[]) => {
    stopPolling();
    const finishedJobs = new Set<string>();
    const jobProgressMap = new Map<string, { done: number; total: number }>();
    const jobErrorMap = new Map<string, number>();
    const jobBatchMap = new Map<string, number>();
    const allCollectedResults: { donationId: string; categories: string[]; warnings: string }[] = [];
    let isPolling = false;

    const poll = async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const activeIds = jobIds.filter(id => !finishedJobs.has(id));
        const statuses = await Promise.all(activeIds.map(id => fetchJobStatus(id).catch(() => null)));

        for (let i = 0; i < activeIds.length; i++) {
          const status = statuses[i];
          if (!status) continue;
          const jid = activeIds[i];

          const prev = jobProgressMap.get(jid);
          jobProgressMap.set(jid, {
            done: status.processedDonations,
            total: Math.max(status.totalDonations, prev?.total ?? 0),
          });

          if (status.failedBatchCount !== undefined) {
            jobErrorMap.set(jid, status.failedBatchCount);
          }
          if (status.totalBatches !== undefined) {
            jobBatchMap.set(jid, status.totalBatches);
          }

          if (status.results && status.results.length > 0) {
            setAiResults(prevResults => {
              const next = new Map(prevResults);
              for (const r of status.results!) {
                const cats = Array.isArray(r.categories) ? r.categories : (r.categories ? [String(r.categories)] : []);
                let warnings = r.warnings || "";
                next.set(r.donationId, { ...r, categories: cats, warnings });
              }
              return next;
            });
          }

          if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") {
            finishedJobs.add(jid);
            if (status.results && status.results.length > 0) {
              allCollectedResults.push(...status.results.map(r => ({
                donationId: r.donationId,
                categories: Array.isArray(r.categories) ? r.categories : (r.categories ? [String(r.categories)] : []),
                warnings: r.warnings || "",
              })));
            }
            if (status.status === "cancelled") {
              setAiStopped(true);
            }
            if (status.status === "failed") {
              toast({ title: "AI İşlemi Başarısız", description: status.error || "Bilinmeyen hata", variant: "destructive" });
            }
          }
        }

        let totalDone = 0;
        let totalAll = 0;
        for (const p of jobProgressMap.values()) { totalDone += p.done; totalAll += p.total; }
        setAiProgress({ done: totalDone, total: totalAll });

        let totalErrors = 0;
        for (const e of jobErrorMap.values()) totalErrors += e;
        setAiErrorBatches(totalErrors);
        let totalBatch = 0;
        for (const b of jobBatchMap.values()) totalBatch += b;
        setAiTotalBatches(totalBatch);

        if (finishedJobs.size === jobIds.length) {
          stopPolling();
          setAiRunning(false);
          activeJobIdsRef.current = [];

          if (allCollectedResults.length > 0) {
            try {
              const SAVE_CHUNK = 2000;
              for (let si = 0; si < allCollectedResults.length; si += SAVE_CHUNK) {
                await saveAiClassifications(allCollectedResults.slice(si, si + SAVE_CHUNK));
              }
              invalidatePool();
            } catch {}
          }

          setShowAiReport(true);
          setAiReportCollapsed(false);
        }
      } catch {} finally { isPolling = false; }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 3000);
  }, [stopPolling, toast, invalidatePool]);

  const handleStartAiClassification = useCallback(async (resume = false) => {
    const donationsToClassify = aiRangeMode === "selected"
      ? items.filter(i => effectiveSelectedIds.has(i.id))
      : items;

    setAiRunning(true);
    setAiStopped(false);
    setAiErrorBatches(0);
    setAiTotalBatches(0);
    setShowAiReport(false);
    setAiReportCollapsed(false);
    if (!resume) { setAiResults(new Map()); }

    let withNotes = donationsToClassify.filter(d => (d.notes || "").trim() !== "");

    if (resume) {
      withNotes = withNotes.filter(d => !aiResults.has(d.id));
    }
    if (aiSkipClassified) {
      withNotes = withNotes.filter(d => !d.aiCategories || d.aiCategories.length === 0);
    }

    if (withNotes.length === 0) {
      toast({
        title: resume ? "Devam edilecek bağış yok" : "İşlenecek bağış yok",
        description: resume ? "Tüm bağışçılar zaten işlenmiş" : aiSkipClassified ? "Tüm bağışçılar zaten sınıflandırılmış" : "Notu olan bağışçı bulunamadı",
      });
      setAiRunning(false);
      return;
    }

    const previouslyDone = resume ? aiResults.size : 0;
    setAiProgress({ done: previouslyDone, total: previouslyDone + withNotes.length });

    try {
      const { jobIds } = await classifyNotesAsyncChunked(
        withNotes.map(d => ({ id: d.id, name: d.name || d.description || "", donationType: d.donationType || "", vekalet: d.vekalet || "", notes: d.notes || "" }))
      );
      activeJobIdsRef.current = jobIds;
      startPollingJobs(jobIds);
    } catch (err) {
      if (err instanceof PartialChunkError && err.jobIds.length > 0) {
        activeJobIdsRef.current = err.jobIds;
        startPollingJobs(err.jobIds);
        toast({ title: "Kısmi başlatma", description: `${err.message}. Başarılı parçalar işlenmeye devam ediyor.`, variant: "destructive" });
        return;
      }
      setAiRunning(false);
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      const details = err instanceof ApiFetchError ? err.details : undefined;
      const detailStr = details ? details.map(d => `${(d.path || []).join(".")}: ${d.message || ""}`).join(", ") : "";
      toast({ title: "AI Başlatılamadı", description: detailStr ? `${msg} (${detailStr})` : msg, variant: "destructive" });
    }
  }, [items, effectiveSelectedIds, aiRangeMode, aiSkipClassified, aiResults, toast, startPollingJobs]);

  const handleStopAiClassification = useCallback(async () => {
    const jobIds = activeJobIdsRef.current;
    if (jobIds.length > 0) {
      await Promise.all(jobIds.map(id => cancelJob(id).catch(() => {})));
    }
    setAiStopped(true);
  }, []);

  const handleExportExcel = useCallback(async () => {
    if (items.length === 0) return;
    const XLSX = await import("xlsx-js-style");
    const wb = XLSX.utils.book_new();

    const exportCols = ALL_TABLE_COLUMNS.filter(c => visibleColumns.has(c.key));
    const headers = exportCols.map(c => c.label);
    const rows = items.map(d => exportCols.map(c => getDonationCellValue(d, c.key)));

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = exportCols.map(c => ({ wch: c.key === "notes" ? 30 : c.key === "name" || c.key === "description" ? 22 : 14 }));

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1E3A5F" } },
      alignment: { horizontal: "center" },
    };
    for (let ci = 0; ci < headers.length; ci++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (ws[ref]) ws[ref].s = headerStyle;
    }

    XLSX.utils.book_append_sheet(wb, ws, "Bağış Havuzu");
    const date = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `bagis_havuzu_${projectId}_${date}.xlsx`);
  }, [items, visibleColumns, projectId]);

  const aiReportStats = useMemo(() => {
    const results = Array.from(aiResults.values());
    const withWarnings = results.filter(r => r.warnings && r.warnings.trim() !== "");
    const withRequests = results.filter(r => r.requests && r.requests.trim() !== "");
    const categoryMap = new Map<string, number>();
    const categoryCanonical = new Map<string, string>();
    for (const r of results) {
      if (r.categories) for (const cat of r.categories) {
        const key = cat.toLocaleLowerCase("tr");
        if (!categoryCanonical.has(key)) categoryCanonical.set(key, cat);
        const canonical = categoryCanonical.get(key)!;
        categoryMap.set(canonical, (categoryMap.get(canonical) || 0) + 1);
      }
    }
    return {
      totalProcessed: results.length,
      warningDonors: withWarnings,
      warningCount: withWarnings.length,
      requestCount: withRequests.length,
      categoryDistribution: Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]),
      errorBatches: aiErrorBatches,
      totalBatches: aiTotalBatches,
    };
  }, [aiResults, aiErrorBatches, aiTotalBatches]);

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

  const showSelectAllBanner = selectedIds.size === items.length && items.length > 0 && total > items.length && !selectAllPages;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation(`/proje/${projectId}`)}>
            <ArrowLeft className="w-4 h-4 mr-1" />Geri
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Bağış Havuzu
            </h1>
            <p className="text-sm text-muted-foreground">{projectName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setShowStats(!showStats)}>
              <BarChart3 className="w-4 h-4 mr-1" />İstatistik
            </Button>
            <Button variant={showRules ? "default" : "outline"} size="sm" onClick={() => setShowRules(!showRules)}>
              <Zap className="w-4 h-4 mr-1" />Kurallar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkCreateListeOpen(true)}>
              <ListPlus className="w-4 h-4 mr-1" />Toplu Liste Oluştur
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-1" />Toplu Yükle
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={items.length === 0} title="Görünen bağışları Excel olarak indir">
              <FileSpreadsheet className="w-4 h-4 mr-1" />Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => setDeleteAllDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" />Tüm Bağışları Sil
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {showStats && stats && <StatsPanel stats={stats} />}

        {showRules && (
          <div className="mb-3">
            <AutomationRulesPanel
              projectId={projectId}
              kesimAlanlari={kesimAlanlari}
              globalTags={globalTags}
            />
          </div>
        )}

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

          {total > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={handleOpenBulkDeleteFiltered}
              title={activeFilterCount > 0 ? "Filtredeki bağışları kalıcı olarak sil" : "Tüm havuzu kalıcı olarak sil"}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {activeFilterCount > 0 ? "Filtredeki Bağışları Sil" : "Havuzu Kalıcı Sil"}
            </Button>
          )}

          <Button
            variant={aiRunning ? "default" : "outline"}
            size="sm"
            onClick={() => setAiDialogOpen(true)}
          >
            <Brain className="w-4 h-4 mr-1" />
            AI Sınıfla
            {aiRunning && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs animate-pulse">
                {aiProgress.done}/{aiProgress.total}
              </Badge>
            )}
            {!aiRunning && aiResults.size > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{aiResults.size}</Badge>
            )}
          </Button>

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

        {aiCategoryFilter && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">AI Kategori:</span>
            <Badge variant="default" className="text-xs cursor-pointer" onClick={() => { setAiCategoryFilter(""); setPage(0); }}>
              {aiCategoryFilter.replace(/_/g, " ")} <X className="w-3 h-3 ml-1" />
            </Badge>
          </div>
        )}

        <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                AI Sınıflandırma
              </DialogTitle>
            </DialogHeader>
            <HavuzAiClassification
              items={items}
              selectedCount={effectiveSelectedIds.size}
              aiRunning={aiRunning}
              aiStopped={aiStopped}
              aiResults={aiResults}
              aiProgress={aiProgress}
              showAiPanel={true}
              setShowAiPanel={() => {}}
              hideToggle={true}
              rangeMode={aiRangeMode}
              setRangeMode={setAiRangeMode}
              batchSize={aiBatchSize}
              setBatchSize={setAiBatchSize}
              startAiClassification={handleStartAiClassification}
              stopAiClassification={handleStopAiClassification}
              skipClassified={aiSkipClassified}
              setSkipClassified={setAiSkipClassified}
              showAiReport={showAiReport}
              setShowAiReport={setShowAiReport}
              aiReportCollapsed={aiReportCollapsed}
              setAiReportCollapsed={setAiReportCollapsed}
              aiReportStats={aiReportStats}
              aiCategoryFilter={aiCategoryFilter || null}
              setAiCategoryFilter={(v) => { setAiCategoryFilter(v || ""); setPage(0); }}
              total={total}
            />
          </DialogContent>
        </Dialog>

        <CinsStatsBar
          stats={stats}
          items={items}
          donationTypeFilter={donationTypeFilter}
          onToggleType={(type) => {
            setDonationTypeFilter(prev =>
              prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
            );
            setPage(0);
          }}
        />

        {showFilters && (
          <PoolFilters
            statusFilter={statusFilter} setStatusFilter={v => { setStatusFilter(v); setPage(0); }}
            kesimAlaniFilter={kesimAlaniFilter} setKesimAlaniFilter={v => { setKesimAlaniFilter(v); setPage(0); }}
            donationTypeFilter={donationTypeFilter} setDonationTypeFilter={v => { setDonationTypeFilter(v); setPage(0); }}
            birimFilter={birimFilter} setBirimFilter={v => { setBirimFilter(v); setPage(0); }}
            temsilciFilter={temsilciFilter} setTemsilciFilter={v => { setTemsilciFilter(v); setPage(0); }}
            aiCategoryFilter={aiCategoryFilter} setAiCategoryFilter={v => { setAiCategoryFilter(v); setPage(0); }}
            ozellikFilter={ozellikFilter} setOzellikFilter={v => { setOzellikFilter(v); setPage(0); }}
            fiyatFilter={fiyatFilter} setFiyatFilter={v => { setFiyatFilter(v); setPage(0); }}
            yerTalebiFilter={yerTalebiFilter} setYerTalebiFilter={v => { setYerTalebiFilter(v); setPage(0); }}
            gunTalebiFilter={gunTalebiFilter} setGunTalebiFilter={v => { setGunTalebiFilter(v); setPage(0); }}
            ilkHayvanFilter={ilkHayvanFilter} setIlkHayvanFilter={v => { setIlkHayvanFilter(v); setPage(0); }}
            safiFilter={safiFilter} setSafiFilter={v => { setSafiFilter(v); setPage(0); }}
            tagFilter={tagFilter} setTagFilter={v => { setTagFilter(v); setPage(0); }}
            notesFilter={notesFilter} setNotesFilter={v => { setNotesFilter(v); setPage(0); }}
            sortBy={sortBy} setSortBy={v => { setSortBy(v); setPage(0); }}
            sortDir={sortDir} setSortDir={setSortDir}
            sortBy2={sortBy2} setSortBy2={v => { setSortBy2(v); setPage(0); }}
            sortDir2={sortDir2} setSortDir2={setSortDir2}
            sortBy3={sortBy3} setSortBy3={v => { setSortBy3(v); setPage(0); }}
            sortDir3={sortDir3} setSortDir3={setSortDir3}
            shareCountMin={shareCountMin} setShareCountMin={v => { setShareCountMin(v); setPage(0); }}
            shareCountMax={shareCountMax} setShareCountMax={v => { setShareCountMax(v); setPage(0); }}
            excludeFields={excludeFields} toggleExcludeField={v => { toggleExcludeField(v); setPage(0); }}
            dateField={dateField} setDateField={v => { setDateField(v); setPage(0); }}
            dateFrom={dateFrom} setDateFrom={v => { setDateFrom(v); setPage(0); }}
            dateTo={dateTo} setDateTo={v => { setDateTo(v); setPage(0); }}
            stats={stats}
            kesimAlanlari={kesimAlanlari}
            globalTags={globalTags}
          />
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

        {stats && stats.multiLocationNames && stats.multiLocationNames.length > 0 && (
          <div className="flex items-center gap-2 mb-3 p-2 border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>{stats.multiLocationNames.length}</strong> kişi birden fazla kesim listesinde mevcut (adına göre):{" "}
              {stats.multiLocationNames.slice(0, 5).map(n => n.name).join(", ")}
              {stats.multiLocationNames.length > 5 && ` ve ${stats.multiLocationNames.length - 5} kişi daha`}
            </p>
          </div>
        )}

        <div className="mb-2 flex items-center gap-2">
          <p className="text-sm">
            <span className="font-bold text-lg text-foreground">{total}</span>
            <span className="text-muted-foreground ml-1">bağış bulundu</span>
            {activeFilterCount > 0 && <span className="text-muted-foreground ml-1">(filtre uygulandı)</span>}
          </p>
        </div>

        {showSelectAllBanner && (
          <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Bu sayfadaki <strong>{items.length}</strong> bağış seçildi.{" "}
              <button
                className="underline font-medium hover:text-blue-900 dark:hover:text-blue-100"
                onClick={handleSelectAllPages}
              >
                Tüm {total} bağışı seç
              </button>
            </p>
          </div>
        )}

        {selectAllPages && (
          <div className="mb-2 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-center">
            <p className="text-xs text-green-700 dark:text-green-300">
              Tüm sayfalardaki <strong>{total}</strong> bağış seçildi.{" "}
              <button
                className="underline font-medium hover:text-green-900 dark:hover:text-green-100"
                onClick={() => { setSelectAllPages(false); setSelectedIds(new Set()); }}
              >
                Seçimi temizle
              </button>
            </p>
          </div>
        )}

        <VirtualizedDonationTable
          items={items}
          isLoading={isLoading}
          activeFilterCount={activeFilterCount}
          selectedIds={effectiveSelectedIds}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          multiLocationVekalets={multiLocationVekalets}
          visibleColumns={visibleColumns}
          sortBy={sortBy}
          sortDir={sortDir}
          onColumnSort={handleColumnSort}
          onFlagDonation={handleFlagDonation}
          onUnflagDonation={handleUnflagDonation}
          onInlineEdit={handleInlineEdit}
          donorMissedCounts={donorMissedCounts}
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

        <PoolBulkActions
          selectedCount={effectiveSelectedIds.size}
          siblingCount={siblingCount}
          onTransferOpen={() => setTransferOpen(true)}
          onBulkAction={handleBulkAction}
          onTagOpen={() => setTagDialogOpen(true)}
          onNoteOpen={() => setNoteDialogOpen(true)}
          onClearSelection={() => { setSelectedIds(new Set()); setSelectAllPages(false); }}
        />

        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          selectedCount={effectiveSelectedIds.size}
          selectedIds={[...effectiveSelectedIds]}
          transferTarget={transferTarget}
          setTransferTarget={setTransferTarget}
          newListName={newListName}
          setNewListName={setNewListName}
          creatingNewList={creatingNewList}
          setCreatingNewList={setCreatingNewList}
          transferring={transferring}
          onTransfer={handleTransfer}
          kesimAlanlari={kesimAlanlari}
          projectId={projectId}
        />

        <BulkCreateListeDialog
          open={bulkCreateListeOpen}
          onOpenChange={setBulkCreateListeOpen}
          projectId={projectId}
          onSuccess={invalidatePool}
        />

        <ImportWizard
          open={importOpen}
          onOpenChange={setImportOpen}
          projectId={projectId}
          onSuccess={invalidatePool}
        />

        <BulkTagDialog
          open={tagDialogOpen}
          onOpenChange={setTagDialogOpen}
          tags={globalTags}
          selectedCount={effectiveSelectedIds.size}
          onTag={handleBulkTag}
          onCreateTag={handleCreateTag}
        />

        <BulkNoteDialog
          open={noteDialogOpen}
          onOpenChange={setNoteDialogOpen}
          selectedCount={effectiveSelectedIds.size}
          onSubmit={handleBulkNote}
        />

        <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tüm bağışları sil</AlertDialogTitle>
              <AlertDialogDescription>
                Bu havuzdaki <strong>{total}</strong> bağışın tamamı kalıcı olarak silinecek. Bu işlem geri alınamaz.
                Devam etmek istediğinize emin misiniz?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingAll}>Vazgeç</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deletingAll}
                onClick={(e) => { e.preventDefault(); handleDeleteAll(); }}
              >
                {deletingAll ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Siliniyor...</> : "Evet, tümünü sil"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BulkDeleteFilteredDialog
          open={bulkDeleteFilteredOpen}
          onOpenChange={setBulkDeleteFilteredOpen}
          preview={bulkDeleteFilteredPreview}
          loading={bulkDeleteFilteredLoading}
          deleting={bulkDeleteFilteredDeleting}
          onConfirm={handleBulkDeleteFiltered}
        />
      </div>
    </div>
  );
}
