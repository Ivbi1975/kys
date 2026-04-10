import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Upload, Search, X, Filter, Package,
  BarChart3, Loader2, Sparkles, AlertTriangle, Settings2,
} from "lucide-react";
import {
  fetchPoolDonations, fetchPoolStats,
  bulkActionDonations, bulkTagDonations, classifyNotesAsync,
  fetchJobStatus, fetchProjects, saveAiClassifications,
  transferDonationsToKA, createKesimAlani,
  fetchTags, createTag,
  flagDonation, unflagDonation,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { processAiResultsInWorker } from "@/lib/excel.worker.client";
import { StatsPanel } from "./bagis-havuzu/StatsPanel";
import { VirtualizedDonationTable } from "./bagis-havuzu/VirtualizedDonationTable";
import { PoolFilters } from "./bagis-havuzu/PoolFilters";
import { PoolBulkActions } from "./bagis-havuzu/PoolBulkActions";
import { TransferDialog } from "./bagis-havuzu/TransferDialog";
import { ImportWizard } from "./bagis-havuzu/ImportWizard";
import { BulkTagDialog } from "./bagis-havuzu/BulkTagDialog";
import { ALL_TABLE_COLUMNS, PAGE_SIZE, type TableColumnKey } from "./bagis-havuzu/types";
import type { CustomTag } from "@/lib/types";

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
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<TableColumnKey>>(() => {
    const stored = localStorage.getItem(`bagis-havuzu-columns-${projectId}`);
    if (stored) {
      try { return new Set(JSON.parse(stored) as TableColumnKey[]); } catch { /* ignore */ }
    }
    return new Set(ALL_TABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
  });

  const [importOpen, setImportOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingNewList, setCreatingNewList] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const aiPollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const columnPickerRef = useRef<HTMLDivElement>(null);

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
    if (page > 0) p.set("p", String(page));
    const qs = p.toString();
    const newUrl = `/bagis-havuzu/${projectId}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", import.meta.env.BASE_URL.replace(/\/$/, "") + newUrl);
  }, [debouncedSearch, statusFilter, donationTypeFilter, birimFilter, temsilciFilter, kesimAlaniFilter, aiCategoryFilter, ozellikFilter, fiyatFilter, yerTalebiFilter, gunTalebiFilter, ilkHayvanFilter, safiFilter, tagFilter, notesFilter, sortBy, sortDir, page, projectId]);

  const activeFilterCount = [
    debouncedSearch, statusFilter, kesimAlaniFilter, aiCategoryFilter, notesFilter,
  ].filter(Boolean).length
  + [donationTypeFilter, birimFilter, temsilciFilter, ozellikFilter, fiyatFilter, yerTalebiFilter, gunTalebiFilter, ilkHayvanFilter, safiFilter, tagFilter].filter(a => a.length > 0).length;

  const filters = useMemo(() => ({
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
    sortBy: sortBy !== "sortOrder" ? sortBy : undefined,
    sortDir: sortDir !== "asc" ? sortDir : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [debouncedSearch, statusFilter, donationTypeFilter, birimFilter, temsilciFilter, kesimAlaniFilter, aiCategoryFilter, ozellikFilter, fiyatFilter, yerTalebiFilter, gunTalebiFilter, ilkHayvanFilter, safiFilter, tagFilter, notesFilter, sortBy, sortDir, page]);

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
    setPage(0);
  }, []);

  const invalidatePool = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pool-donations"] });
    queryClient.invalidateQueries({ queryKey: ["pool-stats"] });
  }, [queryClient]);

  const handleFlagDonation = useCallback(async (id: string, reason: string) => {
    try {
      await flagDonation(id, reason);
      invalidatePool();
      toast({ title: "Bağış işaretlendi", description: reason });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }, [invalidatePool, toast]);

  const handleUnflagDonation = useCallback(async (id: string) => {
    try {
      await unflagDonation(id);
      invalidatePool();
      toast({ title: "İşaret kaldırıldı" });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }, [invalidatePool, toast]);

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

  const handleTransfer = useCallback(async () => {
    const ids = [...effectiveSelectedIds];
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
  }, [effectiveSelectedIds, transferTarget, creatingNewList, newListName, projectId, toast, invalidatePool]);

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

  const handleAiClassify = useCallback(async () => {
    const ids = [...effectiveSelectedIds];
    const donationsToClassify = ids.length > 0
      ? items.filter(i => ids.includes(i.id))
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
              const classifications = await processAiResultsInWorker(status.results);
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
  }, [items, effectiveSelectedIds, toast, invalidatePool]);

  const handleStopAi = useCallback(() => {
    if (aiPollRef.current) {
      clearInterval(aiPollRef.current);
      aiPollRef.current = undefined;
    }
    setAiProcessing(false);
    toast({ title: "AI sınıflandırma durduruldu" });
  }, [toast]);

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
        <div className="flex items-center gap-3 mb-4">
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
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setShowStats(!showStats)}>
              <BarChart3 className="w-4 h-4 mr-1" />İstatistik
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-1" />Toplu Yükle
            </Button>
            {aiProcessing ? (
              <Button variant="outline" size="sm" onClick={handleStopAi}>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />Durdur
              </Button>
            ) : (
              <Button
                variant="outline" size="sm"
                onClick={handleAiClassify}
                disabled={items.length === 0}
              >
                <Sparkles className="w-4 h-4 mr-1" />AI Sınıflandır
              </Button>
            )}
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
          onTransferOpen={() => setTransferOpen(true)}
          onBulkAction={handleBulkAction}
          onTagOpen={() => setTagDialogOpen(true)}
          onClearSelection={() => { setSelectedIds(new Set()); setSelectAllPages(false); }}
        />

        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          selectedCount={effectiveSelectedIds.size}
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
      </div>
    </div>
  );
}
