import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
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
  bulkActionDonations, classifyNotesAsync,
  fetchJobStatus, fetchProjects, saveAiClassifications,
  transferDonationsToKA, createKesimAlani,
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
import { ALL_TABLE_COLUMNS, PAGE_SIZE, type TableColumnKey } from "./bagis-havuzu/types";

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
  const [ozellikFilter, setOzellikFilter] = useState("");
  const [fiyatFilter, setFiyatFilter] = useState("");
  const [yerTalebiFilter, setYerTalebiFilter] = useState("");
  const [gunTalebiFilter, setGunTalebiFilter] = useState("");
  const [ilkHayvanFilter, setIlkHayvanFilter] = useState("");
  const [safiFilter, setSafiFilter] = useState("");
  const [notesFilter, setNotesFilter] = useState("");
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

  const [importOpen, setImportOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
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

  const activeFilterCount = [debouncedSearch, statusFilter, donationTypeFilter, birimFilter, temsilciFilter, kesimAlaniFilter, aiCategoryFilter, ozellikFilter, fiyatFilter, yerTalebiFilter, gunTalebiFilter, ilkHayvanFilter, safiFilter, notesFilter].filter(Boolean).length;

  const filters = useMemo(() => ({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    donationType: donationTypeFilter || undefined,
    birim: birimFilter || undefined,
    temsilci: temsilciFilter || undefined,
    kesimAlaniId: kesimAlaniFilter || undefined,
    aiCategory: aiCategoryFilter || undefined,
    ozellik: ozellikFilter || undefined,
    fiyat: fiyatFilter || undefined,
    yerTalebi: yerTalebiFilter || undefined,
    gunTalebi: gunTalebiFilter || undefined,
    ilkHayvan: ilkHayvanFilter || undefined,
    safi: safiFilter || undefined,
    notesFilter: notesFilter || undefined,
    sortBy: sortBy !== "sortOrder" ? sortBy : undefined,
    sortDir: sortDir !== "asc" ? sortDir : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [debouncedSearch, statusFilter, donationTypeFilter, birimFilter, temsilciFilter, kesimAlaniFilter, aiCategoryFilter, ozellikFilter, fiyatFilter, yerTalebiFilter, gunTalebiFilter, ilkHayvanFilter, safiFilter, notesFilter, sortBy, sortDir, page]);

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
  const kesimAlanlari = (data?.kesimAlanlari || []).filter(ka => ka.name !== "__havuz__");
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
    setOzellikFilter("");
    setFiyatFilter("");
    setYerTalebiFilter("");
    setGunTalebiFilter("");
    setIlkHayvanFilter("");
    setSafiFilter("");
    setNotesFilter("");
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
  }, [items, selectedIds, toast, invalidatePool]);

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
          <PoolFilters
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            kesimAlaniFilter={kesimAlaniFilter} setKesimAlaniFilter={setKesimAlaniFilter}
            donationTypeFilter={donationTypeFilter} setDonationTypeFilter={setDonationTypeFilter}
            birimFilter={birimFilter} setBirimFilter={setBirimFilter}
            temsilciFilter={temsilciFilter} setTemsilciFilter={setTemsilciFilter}
            aiCategoryFilter={aiCategoryFilter} setAiCategoryFilter={setAiCategoryFilter}
            ozellikFilter={ozellikFilter} setOzellikFilter={setOzellikFilter}
            fiyatFilter={fiyatFilter} setFiyatFilter={setFiyatFilter}
            yerTalebiFilter={yerTalebiFilter} setYerTalebiFilter={setYerTalebiFilter}
            gunTalebiFilter={gunTalebiFilter} setGunTalebiFilter={setGunTalebiFilter}
            ilkHayvanFilter={ilkHayvanFilter} setIlkHayvanFilter={setIlkHayvanFilter}
            safiFilter={safiFilter} setSafiFilter={setSafiFilter}
            notesFilter={notesFilter} setNotesFilter={setNotesFilter}
            sortBy={sortBy} setSortBy={setSortBy}
            sortDir={sortDir} setSortDir={setSortDir}
            setPage={setPage}
            stats={stats}
            kesimAlanlari={kesimAlanlari}
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

        <PoolBulkActions
          selectedCount={selectedIds.size}
          onTransferOpen={() => setTransferOpen(true)}
          onBulkAction={handleBulkAction}
          onClearSelection={() => setSelectedIds(new Set())}
        />

        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          selectedCount={selectedIds.size}
          transferTarget={transferTarget}
          setTransferTarget={setTransferTarget}
          newListName={newListName}
          setNewListName={setNewListName}
          creatingNewList={creatingNewList}
          setCreatingNewList={setCreatingNewList}
          transferring={transferring}
          onTransfer={handleTransfer}
          kesimAlanlari={kesimAlanlari}
        />

        <ImportWizard
          open={importOpen}
          onOpenChange={setImportOpen}
          projectId={projectId}
          onSuccess={invalidatePool}
        />
      </div>
    </div>
  );
}
