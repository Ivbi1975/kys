import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Donation, AnimalGroup, KesimAlani, ColorTag } from "@/lib/types";
import { fetchKesimAlani, fetchKesimAlanlari, fetchProjects, fetchTags, fetchTagCategories, fetchPhotoCountsAdmin, fetchGroupPhotosAdmin, fetchKesimAlaniMeta, fetchAllDonations, fetchAllGroupsCompact, syncAiTagsToKesim } from "@/lib/api";
import { sortTagsTr } from "@/lib/formatting";
import { normalizeDonationType } from "@/lib/utils";
import type { CompactGroupItem } from "@/lib/api/kesim-alanlari";
import { getTotalShares, getRequiredAnimals, computeEffectiveShares, trCollator } from "@/lib/grouping";
import { useGroupingWorker } from "@/lib/useGroupingWorker";
import { useWorkspacePreferences, ALL_GROUP_COLUMNS, type ColumnKey } from "@/lib/useWorkspacePreferences";
import { MAX_SHARES_PER_ANIMAL } from "@/lib/constants";

import { useUndoRedo } from "./hooks/useUndoRedo";
import { useDragAndDrop } from "./hooks/useDragAndDrop";
import { useImportExport } from "./hooks/useImportExport";
import { useKesimAlaniFilters } from "./hooks/useKesimAlaniFilters";
import { useSaveManager } from "./hooks/useSaveManager";
import { useDonations } from "./hooks/useDonations";
import { useAnimalGroups } from "./hooks/useAnimalGroups";
import { useGroupingEngine } from "./hooks/useGroupingEngine";
import { useBasket } from "./hooks/useBasket";
import { useTeams } from "./hooks/useTeams";
import { useTrash } from "./hooks/useTrash";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSmartPlacement } from "./hooks/useSmartPlacement";
import { useUIState } from "./hooks/useUIState";
import { useNotifications } from "./hooks/useNotifications";
import { loadBasketFromStorage, generateId } from "./hooks/types";
import type { SortField } from "./hooks/types";
import { VirtuosoRowContext } from "./VirtuosoRowContext";
import { VirtuosoTable, VirtuosoTableHead } from "./VirtuosoComponents";

const emptyDonations: Donation[] = [];
const emptyGroups: AnimalGroup[] = [];

export function useKesimAlaniState() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const workspace = useWorkspacePreferences();
  const { runGrouping, runIncrementalGrouping, cancelGrouping, runComputeShares, runCheckConflicts } = useGroupingWorker();

  const ui = useUIState();
  const notifications = useNotifications();

  const [siblingKesimAlanlari, setSiblingKesimAlanlari] = useState<{ id: string; name: string }[]>([]);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [dataFullyLoaded, setDataFullyLoaded] = useState(false);
  const [dataLoadProgress, setDataLoadProgress] = useState<{ donations: number; groups: number; totalDonations: number; totalGroups: number } | null>(null);

  const saveManager = useSaveManager({ toast, scrollToAnimalGroupRef: ui.scrollToAnimalGroupRef });
  const { saveToApi, debouncedSaveToApi, discardPendingSave, buildErrorDescription, ...saveManagerRest } = saveManager;

  const undoRedo = useUndoRedo({ setKesim, saveToApi, discardPendingSave });
  const { history, historyPanelOpen, setHistoryPanelOpen, handleUndo, handleRedo, handleGoToStep } = undoRedo;

  const save = useCallback(
    (updated: KesimAlani, desc?: string, immediate?: boolean, saveType: "full" | "donations" | "groups" = "full") => {
      setKesim(updated);
      if (immediate) {
        discardPendingSave();
        saveToApi(updated, saveType);
      } else {
        debouncedSaveToApi(updated, saveType);
      }
      if (desc) {
        history.push(updated, desc);
      }
    },
    [saveToApi, debouncedSaveToApi, discardPendingSave, history]
  );

  const addSelectedToBasketRef = useRef<((ids: Set<string>) => void) | undefined>(undefined);
  const importExport = useImportExport({ kesim, save, toast, siblingKesimAlanlari, addSelectedToBasket: (...args) => addSelectedToBasketRef.current?.(...args) });
  const {
    bulkDialogOpen, setBulkDialogOpen, bulkMode, setBulkMode, pasteText, setPasteText,
    previewData, setPreviewData, columnMappings, setColumnMappings, hasHeaderRow, setHasHeaderRow,
    bulkStep, setBulkStep, bulkReviewRows, setBulkReviewRows, bulkReviewExpanded, setBulkReviewExpanded,
    csvExporting, setCsvExporting, excelExporting, donorListReportOpen, setDonorListReportOpen,
    bulkReviewTransferTarget, setBulkReviewTransferTarget, bulkReviewTransferring,
    fileInputRef,
    handleFileUpload, handlePasteData, processRawData, applyBulkImport, applyBulkImportChecked,
    addReviewRowsToBasket, transferReviewRowsToKesimAlani,
    resetBulkDialog,
    exportDonorsExcel, exportGroupsExcel, handleExportKaCsv, displayPreviewRows, headerRow,
    COLUMN_OPTIONS,
  } = importExport;

  const donations = kesim ? kesim.donations : emptyDonations;
  const animalGroups = kesim ? kesim.animalGroups : emptyGroups;

  const sortKeyMap = useMemo(() => {
    const map = new Map<string, { nameSurname: string; descSurname: string; name: string; description: string; donationType: string; shareCount: number }>();
    for (const d of donations) {
      const nameStr = (d.name || "").trim();
      const descStr = (d.description || "").trim();
      map.set(d.id, {
        nameSurname: nameStr.split(/\s+/).pop() || nameStr,
        descSurname: descStr.split(/\s+/).pop() || descStr,
        name: nameStr,
        description: descStr,
        donationType: (d.donationType || "").trim(),
        shareCount: d.shareCount,
      });
    }
    return map;
  }, [donations]);

  const descCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of donations) {
      if (d.excluded) continue;
      const normalizedDesc = d.description.trim().toLocaleLowerCase("tr");
      if (normalizedDesc) {
        map.set(normalizedDesc, (map.get(normalizedDesc) || 0) + 1);
      }
    }
    return map;
  }, [donations]);

  const groupedDonorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of animalGroups) {
      for (const d of g.donations) {
        if (d.name.trim()) ids.add(d.id);
      }
    }
    return ids;
  }, [animalGroups]);

  const ungroupedDonors = useMemo(
    () => donations.filter((d) => !d.excluded && !groupedDonorIds.has(d.id)),
    [donations, groupedDonorIds]
  );

  const ungroupedShareCount = useMemo(() => {
    const ungroupedEffective = computeEffectiveShares(ungroupedDonors);
    const processed = new Set<string>();
    let count = 0;
    for (const d of ungroupedDonors) {
      const key = d.description.trim().toLocaleLowerCase("tr");
      if (key && processed.has(key)) continue;
      processed.add(key);
      count += ungroupedEffective.get(d.id) || d.shareCount;
    }
    return count;
  }, [ungroupedDonors]);

  const [effectiveShareMap, setEffectiveShareMap] = useState<Map<string, number>>(() => new Map());

  useEffect(() => {
    if (donations.length === 0) {
      setEffectiveShareMap(new Map());
      return;
    }
    let cancelled = false;
    runComputeShares(donations).then(result => {
      if (!cancelled) setEffectiveShareMap(result);
    }).catch(() => {
      if (!cancelled) setEffectiveShareMap(computeEffectiveShares(donations));
    });
    return () => { cancelled = true; };
  }, [donations, runComputeShares]);

  const shareDistribution = useMemo(() => {
    const dist: Record<number, number> = {};
    for (let i = 1; i <= MAX_SHARES_PER_ANIMAL; i++) dist[i] = 0;
    const processed = new Set<string>();
    for (const d of donations) {
      if (d.excluded) continue;
      const key = d.description.trim().toLocaleLowerCase("tr");
      if (key && processed.has(key)) continue;
      processed.add(key);
      const eff = effectiveShareMap.get(d.id) || d.shareCount;
      const sc = Math.max(1, Math.min(MAX_SHARES_PER_ANIMAL, eff));
      dist[sc] = (dist[sc] || 0) + 1;
    }
    return dist;
  }, [donations, effectiveShareMap]);


  const setConflictsRef = useRef<React.Dispatch<React.SetStateAction<import("@/lib/grouping").ConflictInfo[]>>>(() => {});

  const animalGroupsHook = useAnimalGroups({
    kesim,
    setKesim,
    save,
    history,
    toast,
    workspace,
    setConflicts: (val) => setConflictsRef.current(val),
    runCheckConflicts,
  });

  const { removedFromGroupIds, isGroupLocked, saveSingleGroupField, ...animalGroupsRest } = animalGroupsHook;

  const filters = useKesimAlaniFilters({ donations, groupedDonorIds, removedFromGroupIds });
  const {
    sortField, setSortField, sortDir, setSortDir,
    personSearchQuery, setPersonSearchQuery, debouncedSearchQuery, setDebouncedSearchQuery,
    showOnlyIncomplete, setShowOnlyIncomplete,
    highlightIncomplete, setHighlightIncomplete,
    filterCinsi, setFilterCinsi, filterHisseMin, setFilterHisseMin, filterHisseMax, setFilterHisseMax,
    filterTags, setFilterTags, filterAiCategories, setFilterAiCategories, filterAiWarnings, setFilterAiWarnings,
    filterStatus, setFilterStatus, showAdvancedFilter, setShowAdvancedFilter,
    filterTeam, setFilterTeam, showRemovedFilter, setShowRemovedFilter,
    startFilterTransition, activeFilterCount, clearAdvancedFilters,
    searchIndex, filteredDonations, uniqueDonationTypes, availableAiCategories,
  } = filters;

  const donationsHook = useDonations({
    kesim,
    setKesim,
    save,
    history,
    toast,
    searchIndex,
    debouncedSearchQuery,
    sortKeyMap,
    editableVisibleColumns: animalGroupsHook.editableVisibleColumns,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
  });
  const { saveSingleDonationField, cancelEdit, editingCell, selectedIds, setSelectedIds, ...donationsRest } = donationsHook;

  const groupingEngine = useGroupingEngine({
    kesim,
    setKesim,
    save,
    history,
    toast,
    runGrouping,
    runIncrementalGrouping,
    cancelGrouping,
    runCheckConflicts,
    isGroupLocked,
    selectedIds,
    setSelectedIds,
  });

  setConflictsRef.current = groupingEngine.setConflicts;

  const basket = useBasket({
    kesim,
    setKesim,
    save,
    history,
    toast,
    isGroupLocked,
  });

  addSelectedToBasketRef.current = basket.addSelectedToBasket;

  const teams = useTeams({ kesim, setKesim, toast, setFilterTeam });
  const trash = useTrash({ kesim, setKesim, toast, history });

  const dragAndDrop = useDragAndDrop({ kesim, save, isGroupLocked, scrollContainerRef: ui.scrollContainerRef });
  const {
    dragItem, setDragItem, dragOverItem, setDragOverItem, dragOverGroup, setDragOverGroup,
    moveGroupDonation, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd, handleDragOverCard,
  } = dragAndDrop;

  useKeyboardShortcuts({
    kesim,
    saveToApi,
    handleUndo,
    handleRedo,
    editingCell,
    cancelEdit,
    shortcutHelpOpen: ui.shortcutHelpOpen,
    setShortcutHelpOpen: ui.setShortcutHelpOpen,
    minimapOpen: ui.minimapOpen,
    setMinimapOpen: ui.setMinimapOpen,
    fullscreenMode: ui.fullscreenMode,
    setFullscreenMode: ui.setFullscreenMode,
    jumpDialogOpen: ui.jumpDialogOpen,
    setJumpDialogOpen: ui.setJumpDialogOpen,
    searchInputRef: ui.searchInputRef,
    toggleFullscreen: ui.toggleFullscreen,
  });

  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    async function loadData() {
      if (!params.id) return;
      const requestId = ++loadRequestIdRef.current;
      setDataFullyLoaded(false);
      setDataLoadProgress(null);

      try {
        const meta = await fetchKesimAlaniMeta(params.id);
        if (requestId !== loadRequestIdRef.current) return;

        if (!meta) {
          const fallback = await fetchKesimAlani(params.id);
          if (requestId !== loadRequestIdRef.current) return;
          if (fallback) {
            setKesim(fallback);
            history.initialize(fallback);
            setDataFullyLoaded(true);
            const stored = loadBasketFromStorage(fallback.projectId, true);
            basket.setBasketItems(stored);
            fetchPhotoCountsAdmin(fallback.id).then(notifications.setPhotoCounts).catch(() => {});
            fetchTags().then(tags => ui.setGlobalTags(sortTagsTr(tags))).catch(() => {});
            fetchTagCategories().then(ui.setTagCategories).catch(() => {});
          } else {
            setLocation("/");
          }
          return;
        }

        const shell: KesimAlani = {
          id: meta.id,
          name: meta.name,
          createdAt: meta.createdAt as unknown as string,
          deletedAt: meta.deletedAt,
          projectId: meta.projectId,
          trackingToken: meta.trackingToken,
          kesimListeId: meta.kesimListeId,
          parentKesimAlaniId: meta.parentKesimAlaniId,
          splitStatus: meta.splitStatus,
          teams: meta.teams,
          donations: [],
          animalGroups: [],
        };
        setKesim(shell);
        setDataLoadProgress({ donations: 0, groups: 0, totalDonations: meta.donationCount, totalGroups: meta.groupCount });

        const donationsById = new Map<string, Donation>();
        let allCompactGroups: CompactGroupItem[] = [];
        let donationsComplete = false;
        let groupsComplete = false;

        function hydrateGroups(compactGroups: CompactGroupItem[]): AnimalGroup[] {
          return compactGroups.map(g => ({
            id: g.id,
            animalNo: g.animalNo,
            colorTag: g.colorTag as KesimAlani["animalGroups"][0]["colorTag"],
            locked: g.locked,
            notes: g.notes,
            fiyat: g.fiyat ?? "",
            kesildi: g.kesildi,
            kesildiAt: g.kesildiAt,
            teamId: g.teamId,
            updatedAt: g.updatedAt ?? undefined,
            donations: (g.donationIds || []).map(did => donationsById.get(did)).filter(Boolean) as Donation[],
          }));
        }

        const totalDonations = meta.donationCount;
        const totalGroups = meta.groupCount;

        function updateKesimState() {
          if (requestId !== loadRequestIdRef.current) return;
          const allDonations = Array.from(donationsById.values());
          const animalGroups = hydrateGroups(allCompactGroups);
          const current: KesimAlani = { ...shell, donations: allDonations, animalGroups };
          setKesim(current);
          setDataLoadProgress({
            donations: allDonations.length,
            groups: allCompactGroups.length,
            totalDonations,
            totalGroups,
          });
          if (donationsComplete && groupsComplete) {
            history.initialize(current);
            setDataFullyLoaded(true);
            setDataLoadProgress(null);
          }
        }

        await Promise.all([
          fetchAllDonations(params.id, (accumulated) => {
            if (requestId !== loadRequestIdRef.current) return;
            donationsById.clear();
            for (const d of accumulated) donationsById.set(d.id, d);
            updateKesimState();
          }).then(() => { donationsComplete = true; }),
          fetchAllGroupsCompact(params.id, (accumulated) => {
            if (requestId !== loadRequestIdRef.current) return;
            allCompactGroups = accumulated;
            updateKesimState();
          }).then(() => { groupsComplete = true; }),
        ]);
        if (requestId !== loadRequestIdRef.current) return;

        updateKesimState();

        syncAiTagsToKesim(params.id).then(({ synced }) => {
          if (synced > 0 && requestId === loadRequestIdRef.current) {
            fetchAllDonations(params.id).then((refreshed) => {
              if (requestId !== loadRequestIdRef.current) return;
              donationsById.clear();
              for (const d of refreshed) donationsById.set(d.id, d);
              updateKesimState();
            }).catch(() => {});
          }
        }).catch(() => {});

        const stored = loadBasketFromStorage(meta.projectId, true);
        basket.setBasketItems(stored);

        void (async () => {
          fetchPhotoCountsAdmin(meta.id).then(notifications.setPhotoCounts).catch(() => {});

          if (meta.projectId) {
            try {
              const [projectKAs, projects] = await Promise.all([
                fetchKesimAlanlari(meta.projectId),
                fetchProjects(),
              ]);
              if (requestId !== loadRequestIdRef.current) return;
              const siblings = projectKAs
                .filter((ka) => ka.id !== meta.id && !ka.deletedAt)
                .map((ka) => ({ id: ka.id, name: ka.name }));
              setSiblingKesimAlanlari(siblings);
              const proj = projects.find((p) => p.id === meta.projectId);
              if (proj) setProjectName(proj.name);
            } catch {}
          }

          try { ui.setGlobalTags(sortTagsTr(await fetchTags())); } catch {}
          try { ui.setTagCategories(await fetchTagCategories()); } catch {}
        })();
      } catch (err) {
        if (requestId !== loadRequestIdRef.current) return;
        console.error("[loadData] Failed to load kesim alanı data", err);
        setDataFullyLoaded(true);
        setDataLoadProgress(null);
        const fallback = await fetchKesimAlani(params.id).catch(() => null);
        if (requestId !== loadRequestIdRef.current) return;
        if (fallback) {
          setKesim(fallback);
          history.initialize(fallback);
          const stored = loadBasketFromStorage(fallback.projectId, true);
          basket.setBasketItems(stored);
        }
      }
    }
    loadData();
  }, [params.id, setLocation]);

  useEffect(() => {
    if (!kesim) return;
    const urlParams = new URLSearchParams(window.location.search);
    const highlightId = urlParams.get("highlight");
    if (highlightId) {
      donationsHook.setHighlightDonationId(highlightId);
      const url = new URL(window.location.href);
      url.searchParams.delete("highlight");
      window.history.replaceState({}, "", url.toString());
      setTimeout(() => {
        const el = document.querySelector(`[data-donation-id="${highlightId}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => donationsHook.setHighlightDonationId(null), 4000);
      }, 500);
    }
  }, [kesim?.id]);

  useEffect(() => {
    if (kesim) {
      import("./hooks/types").then(({ saveBasketToStorage }) => {
        saveBasketToStorage(basket.basketItems, kesim.projectId);
      });
    }
  }, [basket.basketItems, kesim?.projectId]);

  useEffect(() => {
    const handleScroll = () => {
      const container = ui.scrollContainerRef.current;
      const scrollY = container ? container.scrollTop : window.scrollY;
      ui.setShowScrollTop(scrollY > 150);
    };
    const container = ui.scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [ui.fullscreenMode]);

  useEffect(() => {
    groupingEngine.setSwapSelection(null);
    groupingEngine.setSwapTarget(null);
    groupingEngine.setSwapPreviewOpen(false);
    animalGroupsHook.setSelectedGroupIds((prev) => {
      if (!kesim || prev.size === 0) return prev;
      const validIds = new Set(kesim.animalGroups.map((g) => g.id));
      const filtered = new Set([...prev].filter((id) => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [kesim?.animalGroups]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!ui.isDraggingSplit || !ui.splitContainerRef.current) return;
      const rect = ui.splitContainerRef.current.getBoundingClientRect();
      const ratio = ((e.clientX - rect.left) / rect.width) * 100;
      workspace.setSplitRatio(ratio);
    };
    const handleMouseUp = () => ui.setIsDraggingSplit(false);
    if (ui.isDraggingSplit) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [ui.isDraggingSplit]);

  const currentGroupMatches = useMemo(() => animalGroupsHook.groupSearchMatches(), [animalGroupsHook.groupSearchMatches]);

  const uniqueGroupDonationTypes = useMemo(() => {
    if (!kesim) return [];
    const types = new Set<string>();
    for (const group of kesim.animalGroups) {
      for (const d of group.donations) {
        const t = d.donationType?.trim();
        if (t) types.add(normalizeDonationType(t));
      }
    }
    return Array.from(types).sort((a, b) => trCollator.compare(a, b));
  }, [kesim?.animalGroups]);

  const filteredGroupItems = useMemo(() => {
    if (!kesim) return [];
    return kesim.animalGroups
      .map((group, groupIdx) => ({ group, groupIdx }))
      .filter(({ group }) => {
        if (ui.colorTagFilter !== "all" && (group.colorTag || "") !== ui.colorTagFilter) return false;
        if (filterTeam !== "all") {
          if (filterTeam === "none" && group.teamId) return false;
          if (filterTeam !== "none" && group.teamId !== filterTeam) return false;
        }
        if (showOnlyIncomplete) {
          const filled = group.donations.filter((d) => d.name.trim() !== "").length;
          if (filled >= MAX_SHARES_PER_ANIMAL) return false;
        }
        if (ui.groupCinsFilter.size > 0) {
          const hasMatchingType = group.donations.some(d => {
            const t = d.donationType?.trim();
            return t && ui.groupCinsFilter.has(normalizeDonationType(t));
          });
          if (!hasMatchingType) return false;
        }
        return true;
      });
  }, [kesim?.animalGroups, ui.colorTagFilter, filterTeam, showOnlyIncomplete, ui.groupCinsFilter]);

  const effectiveColumnCount = workspace?.prefs?.columnCount ?? 1;

  const groupRows = useMemo(() => {
    const rows: (typeof filteredGroupItems)[] = [];
    const cols = effectiveColumnCount;
    for (let i = 0; i < filteredGroupItems.length; i += cols) {
      rows.push(filteredGroupItems.slice(i, i + cols));
    }
    return rows;
  }, [filteredGroupItems, effectiveColumnCount]);

  const scrollToAnimalGroup = useCallback(
    (animalNo: number) => {
      const idx = filteredGroupItems.findIndex((item) => item.group.animalNo === animalNo);
      if (idx >= 0 && ui.groupsVirtuosoRef.current) {
        const rowIdx = Math.floor(idx / effectiveColumnCount);
        ui.groupsVirtuosoRef.current.scrollToIndex({ index: rowIdx, align: "center", behavior: "smooth" });
      } else {
        const el = document.getElementById(`animal-group-${animalNo}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [filteredGroupItems, effectiveColumnCount]
  );

  ui.scrollToAnimalGroupRef.current = scrollToAnimalGroup;

  useEffect(() => {
    if (currentGroupMatches.length > 0 && animalGroupsHook.groupSearchMatchIdx >= 0) {
      const match = currentGroupMatches[animalGroupsHook.groupSearchMatchIdx % currentGroupMatches.length];
      if (match) {
        animalGroupsHook.setCollapsedGroups((prev) => {
          const next = new Set(prev);
          next.delete(match.groupId);
          return next;
        });
        setTimeout(() => scrollToAnimalGroup(match.animalNo), 100);
      }
    }
  }, [animalGroupsHook.groupSearchMatchIdx, animalGroupsHook.groupSearchQuery]);

  const handleViewPhotos = useCallback(
    (groupId: string, animalNo: number) => {
      if (!kesim) return;
      notifications.setPhotoViewGroup({ id: groupId, animalNo });
      notifications.setPhotoViewLoading(true);
      fetchGroupPhotosAdmin(kesim.id, groupId)
        .then(notifications.setPhotoViewPhotos)
        .catch(() => notifications.setPhotoViewPhotos([]))
        .finally(() => notifications.setPhotoViewLoading(false));
    },
    [kesim?.id]
  );

  const sortedDonorList = useMemo(() => {
    const active = donations.filter((d) => !d.excluded);
    const decorated = active.map((d) => {
      const desc = (d.description || "").trim();
      return { d, key: desc.split(/\s+/).pop() || desc };
    });
    decorated.sort((a, b) => trCollator.compare(a.key, b.key));
    return decorated.map((item) => item.d);
  }, [donations]);

  const virtuosoTableComponents = useMemo(
    () => ({
      Table: VirtuosoTable,
      TableHead: VirtuosoTableHead,
      TableRow: ({ item: d, children, ...rowAttrs }: React.HTMLAttributes<HTMLTableRowElement> & { item?: Donation; children?: React.ReactNode }) => {
        const rowClassName = [
          "hover:bg-muted/30 transition-colors",
          d && selectedIds.has(d.id) ? "bg-primary/5" : "",
          d?.excluded ? "opacity-40" : "",
          d && donationsHook.highlightDonationId === d.id
            ? "ring-2 ring-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 animate-pulse"
            : "",
        ].filter(Boolean).join(" ");
        return (
          <VirtuosoRowContext.Provider value={{ rowAttrs: { ...rowAttrs, "data-donation-id": d?.id }, rowClassName }}>
            {children}
          </VirtuosoRowContext.Provider>
        );
      },
    }),
    [selectedIds, donationsHook.highlightDonationId]
  );

  const columnHeaderLabel = useCallback((key: ColumnKey): string => {
    const col = ALL_GROUP_COLUMNS.find((c) => c.key === key);
    return col?.label || "";
  }, []);

  const columnHeaderWidth = useCallback((key: ColumnKey): string => {
    switch (key) {
      case "drag": return "w-5";
      case "index": return "w-5";
      case "vekalet": return "w-14";
      case "description": return "min-w-[90px]";
      case "name": return "min-w-[90px]";
      case "donationType": return "w-14";
      case "fiyat": return "w-14";
      case "yerTalebi": return "w-14";
      case "gunTalebi": return "w-14";
      case "ilkHayvan": return "w-14";
      case "safi": return "w-12";
      case "notes": return "min-w-[70px]";
      case "aiTags": return "min-w-[80px]";
      case "actions": return "w-8";
      default: return "";
    }
  }, []);

  const smartPlacement = useSmartPlacement({ kesim, save, isGroupLocked, setSmartPlacePopover: ui.setSmartPlacePopover });
  const { getAvailableGroupsForDonor, getSwapSuggestions, executeSwapSuggestion, smartPlaceDonor } = smartPlacement;

  const totalShares = kesim ? getTotalShares(kesim.donations) : 0;
  const requiredAnimals = kesim ? getRequiredAnimals(kesim.donations) : 0;
  const remainingSlots = requiredAnimals * MAX_SHARES_PER_ANIMAL - totalShares;

  return {
    activeFilterCount,
    ...donationsHook,
    ...animalGroupsHook,
    ...groupingEngine,
    ...basket,
    ...teams,
    ...trash,
    ...saveManagerRest,
    ...notifications,
    saveToApi,
    debouncedSaveToApi,
    discardPendingSave,
    buildErrorDescription,
    saveSingleDonationField,
    saveSingleGroupField,
    cancelEdit,
    editingCell,
    selectedIds,
    setSelectedIds,
    removedFromGroupIds,
    isGroupLocked,
    addSelectedToBasket: () => {
      basket.addSelectedToBasket(selectedIds);
      setSelectedIds(new Set());
    },
    addReviewRowsToBasket,
    applyBulkImport,
    applyBulkImportChecked,
    availableAiCategories,
    bulkDialogOpen,
    bulkMode,
    bulkReviewExpanded,
    bulkReviewRows,
    bulkReviewTransferTarget,
    bulkReviewTransferring,
    bulkStep,
    cancelGrouping,
    clearAdvancedFilters,
    colorTagFilter: ui.colorTagFilter,
    columnHeaderLabel,
    columnHeaderWidth,
    columnMappings,
    csvExporting,
    excelExporting,
    currentGroupMatches,
    debouncedSearchQuery,
    descCountMap,
    displayPreviewRows,
    donorListReportOpen,
    donorListVisible: ui.donorListVisible,
    dragItem,
    dragOverGroup,
    dragOverItem,
    effectiveColumnCount,
    effectiveShareMap,
    executeSwapSuggestion,
    exportDonorsExcel,
    exportGroupsExcel,
    fileInputRef,
    filterAiCategories,
    filterAiWarnings,
    filterCinsi,
    filterHisseMax,
    filterHisseMin,
    filterStatus,
    filterTags,
    filterTeam,
    filteredDonations,
    filteredGroupItems,
    fullscreenMode: ui.fullscreenMode,
    groupCinsFilter: ui.groupCinsFilter,
    getAvailableGroupsForDonor,
    getSwapSuggestions,
    globalTags: ui.globalTags,
    tagCategories: ui.tagCategories,
    groupRows,
    groupedDonorIds,
    groupsHeaderRef: ui.groupsHeaderRef,
    groupsScrollTopRef: ui.groupsScrollTopRef,
    groupsVirtuosoRef: ui.groupsVirtuosoRef,
    handleColumnDragEnd: animalGroupsHook.handleColumnDragEnd,
    handleColumnDragOver: animalGroupsHook.handleColumnDragOver,
    handleColumnDragStart: animalGroupsHook.handleColumnDragStart,
    handleColumnDrop: animalGroupsHook.handleColumnDrop,
    handleDragEnd,
    handleDragLeave,
    handleDragOver,
    handleDragOverCard,
    handleDragStart,
    handleDrop,
    handleExportKaCsv,
    handleFileUpload,
    handleGoToStep,
    handlePasteData,
    handleRedo,
    handleUndo,
    handleViewPhotos,
    hasHeaderRow,
    headerRow,
    highlightIncomplete,
    history,
    historyPanelOpen,
    isDraggingSplit: ui.isDraggingSplit,
    dataFullyLoaded,
    dataLoadProgress,
    isFullscreen: ui.isFullscreen,
    isMobile: ui.isMobile,
    jumpDialogOpen: ui.jumpDialogOpen,
    jumpInputRef: ui.jumpInputRef,
    jumpToAnimal: ui.jumpToAnimal,
    kesim,
    lastSavedTime: saveManagerRest.lastSavedTime,
    minimapOpen: ui.minimapOpen,
    mobileTab: ui.mobileTab,
    moveGroupDonation,
    pasteText,
    pendingSaveRef: saveManagerRest.pendingSaveRef,
    pendingSaveTypeRef: saveManagerRest.pendingSaveTypeRef,
    personSearchQuery,
    previewData,
    processRawData,
    projectName,
    qrModalOpen: ui.qrModalOpen,
    qrUrl: ui.qrUrl,
    remainingSlots,
    requiredAnimals,
    resetBulkDialog,
    runGrouping,
    runIncrementalGrouping,
    runCheckConflicts,
    save,
    saveProgress: saveManagerRest.saveProgress,
    saveStatus: saveManagerRest.saveStatus,
    saveTimeoutRef: saveManagerRest.saveTimeoutRef,
    scrollContainerRef: ui.scrollContainerRef,
    scrollToAnimalGroup,
    searchIndex,
    searchInputRef: ui.searchInputRef,
    setAddDialogOpen: donationsHook.setAddDialogOpen,
    setBulkDialogOpen,
    setBulkEditField: donationsHook.setBulkEditField,
    setBulkEditOpen: donationsHook.setBulkEditOpen,
    setBulkEditValue: donationsHook.setBulkEditValue,
    setBulkMode,
    setBulkReviewExpanded,
    setBulkReviewRows,
    setBulkReviewTransferTarget,
    setBulkStep,
    setColorTagFilter: ui.setColorTagFilter,
    setGroupCinsFilter: ui.setGroupCinsFilter,
    setColumnMappings,
    setCsvExporting,
    setDebouncedSearchQuery,
    setDonorListReportOpen,
    setDonorListVisible: ui.setDonorListVisible,
    setDragItem,
    setDragOverGroup,
    setDragOverItem,
    setFilterAiCategories,
    setFilterAiWarnings,
    setFilterCinsi,
    setFilterHisseMax,
    setFilterHisseMin,
    setFilterStatus,
    setFilterTags,
    setFilterTeam,
    setFullscreenMode: ui.setFullscreenMode,
    setGlobalTags: ui.setGlobalTags,
    setHasHeaderRow,
    setHighlightIncomplete,
    setHistoryPanelOpen,
    setIsDraggingSplit: ui.setIsDraggingSplit,
    setIsFullscreen: ui.setIsFullscreen,
    setJumpDialogOpen: ui.setJumpDialogOpen,
    setJumpToAnimal: ui.setJumpToAnimal,
    setKesim,
    setLastSavedTime: saveManagerRest.setLastSavedTime,
    setLocation,
    setMinimapOpen: ui.setMinimapOpen,
    setMobileTab: ui.setMobileTab,
    setPasteText,
    setPersonSearchQuery,
    setPreviewData,
    setProjectName,
    setQrModalOpen: ui.setQrModalOpen,
    setQrUrl: ui.setQrUrl,
    setSaveStatus: saveManagerRest.setSaveStatus,
    setShortcutHelpOpen: ui.setShortcutHelpOpen,
    setShowAdvancedFilter,
    setShowOnlyIncomplete,
    setShowRemovedFilter,
    setShowScrollTop: ui.setShowScrollTop,
    setSiblingKesimAlanlari,
    setSmartPlacePopover: ui.setSmartPlacePopover,
    setSortDir,
    setSortField,
    setSplitShareDialog: ui.setSplitShareDialog,
    setTagPopoverDonorId: ui.setTagPopoverDonorId,
    shareDistribution,
    shortcutHelpOpen: ui.shortcutHelpOpen,
    showAdvancedFilter,
    showOnlyIncomplete,
    showRemovedFilter,
    showScrollTop: ui.showScrollTop,
    siblingKesimAlanlari,
    smartPlaceDonor,
    smartPlacePopover: ui.smartPlacePopover,
    sortDir,
    sortField,
    sortKeyMap,
    sortedDonorList,
    splitContainerRef: ui.splitContainerRef,
    splitShareDialog: ui.splitShareDialog,
    startFilterTransition,
    tagPopoverDonorId: ui.tagPopoverDonorId,
    themeMode: ui.themeMode,
    toast,
    toggleFullscreen: ui.toggleFullscreen,
    toggleTheme: ui.toggleTheme,
    totalShares,
    transferReviewRowsToKesimAlani,
    ungroupedDonors,
    ungroupedShareCount,
    uniqueDonationTypes,
    uniqueGroupDonationTypes,
    virtuosoTableComponents,
    workspace,
    COLUMN_OPTIONS,
    debounceTimerRef: saveManagerRest.debounceTimerRef,
  };
}
