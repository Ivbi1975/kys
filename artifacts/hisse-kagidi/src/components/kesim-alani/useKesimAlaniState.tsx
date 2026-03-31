import React, { useState, useEffect, useCallback, useRef, useMemo, forwardRef } from "react";
import { turkishNormalize } from "@/lib/utils";
import type { VirtuosoHandle } from "react-virtuoso";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Donation, AnimalGroup, KesimAlani, ColorTag, CustomTag } from "@/lib/types";
import { fetchKesimAlani, fetchKesimAlanlari, fetchProjects, fetchTags, fetchPhotoCountsAdmin, fetchGroupPhotosAdmin, fetchNotificationLogs, fetchNotificationTemplate, updateNotificationTemplate, generateTrackingToken, fetchKesimAlaniTrackingNotes, updateTrackingNoteStatus } from "@/lib/api";
import type { TrackingNote, GroupPhoto, NotificationLog } from "@/lib/api";
import { getTotalShares, getRequiredAnimals, computeEffectiveShares, trCollator } from "@/lib/grouping";
import { useGroupingWorker } from "@/lib/useGroupingWorker";
import { useWorkspacePreferences, ALL_GROUP_COLUMNS, type ColumnKey } from "@/lib/useWorkspacePreferences";
import { useTheme } from "@/lib/useTheme";
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
import { loadBasketFromStorage, generateId } from "./hooks/types";
import type { SortField } from "./hooks/types";

const emptyDonations: Donation[] = [];
const emptyGroups: AnimalGroup[] = [];

const VirtuosoTable = forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>((props, ref) => (
  <table {...props} ref={ref} className="w-full text-sm" />
));
const VirtuosoTableHead = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>((props, ref) => (
  <thead {...props} ref={ref} className="bg-background sticky top-0 z-10" />
));

export function useKesimAlaniState() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const { toggle: toggleTheme, mode: themeMode } = useTheme();
  const workspace = useWorkspacePreferences();
  const { runGrouping, runIncrementalGrouping, cancelGrouping } = useGroupingWorker();

  const [colorTagFilter, setColorTagFilter] = useState<ColorTag | "all">("all");
  const [groupCinsFilter, setGroupCinsFilter] = useState<Set<string>>(new Set());
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false);
  const [jumpToAnimal, setJumpToAnimal] = useState("");
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [donorListVisible, setDonorListVisible] = useState(true);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileTab, setMobileTab] = useState<"donors" | "groups">("donors");
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [globalTags, setGlobalTags] = useState<CustomTag[]>([]);
  const [tagPopoverDonorId, setTagPopoverDonorId] = useState<string | null>(null);
  const [smartPlacePopover, setSmartPlacePopover] = useState<string | null>(null);
  const [splitShareDialog, setSplitShareDialog] = useState<{ donationId: string; totalShares: number } | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [siblingKesimAlanlari, setSiblingKesimAlanlari] = useState<{ id: string; name: string }[]>([]);
  const [projectName, setProjectName] = useState<string | null>(null);

  const [trackingNotesOpen, setTrackingNotesOpen] = useState(false);
  const [trackingNotes, setTrackingNotes] = useState<TrackingNote[]>([]);
  const [trackingNotesLoading, setTrackingNotesLoading] = useState(false);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [photoViewGroup, setPhotoViewGroup] = useState<{ id: string; animalNo: number } | null>(null);
  const [photoViewPhotos, setPhotoViewPhotos] = useState<GroupPhoto[]>([]);
  const [photoViewLoading, setPhotoViewLoading] = useState(false);
  const [notificationLogsOpen, setNotificationLogsOpen] = useState(false);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [notificationLogsLoading, setNotificationLogsLoading] = useState(false);
  const [notificationTemplateOpen, setNotificationTemplateOpen] = useState(false);
  const [notificationTemplate, setNotificationTemplate] = useState("Hayvan {animalNo} kesildi. Hayırlı olsun!");
  const [notificationTemplateSaving, setNotificationTemplateSaving] = useState(false);

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const groupsScrollTopRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const groupsHeaderRef = useRef<HTMLDivElement>(null);
  const groupsVirtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollToAnimalGroupRef = useRef<((animalNo: number) => void) | undefined>(undefined);

  const saveManager = useSaveManager({ toast, scrollToAnimalGroupRef });
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
    csvExporting, setCsvExporting, donorListReportOpen, setDonorListReportOpen,
    bulkReviewTransferTarget, setBulkReviewTransferTarget, bulkReviewTransferring,
    fileInputRef,
    handleFileUpload, handlePasteData, processRawData, applyBulkImport,
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

  const effectiveShareMap = useMemo(() => computeEffectiveShares(donations), [donations]);

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

  const groupCompositions = useMemo(() => {
    const compositions = new Map<string, number>();
    for (const g of animalGroups) {
      const filled = g.donations.filter((d) => d.name.trim());
      const shareMap = new Map<string, number>();
      for (const d of filled) {
        const key = d.description.trim().toLocaleLowerCase("tr") || d.id;
        shareMap.set(key, (shareMap.get(key) || 0) + 1);
      }
      const parts = Array.from(shareMap.values()).sort((a, b) => a - b);
      const emptySlots = MAX_SHARES_PER_ANIMAL - filled.length;
      const label =
        parts.length > 0
          ? emptySlots > 0
            ? [...parts, `${emptySlots}boş`].join("+")
            : parts.join("+")
          : "Boş";
      compositions.set(label, (compositions.get(label) || 0) + 1);
    }
    return compositions;
  }, [animalGroups]);

  const setConflictsRef = useRef<React.Dispatch<React.SetStateAction<import("@/lib/grouping").ConflictInfo[]>>>(() => {});

  const animalGroupsHook = useAnimalGroups({
    kesim,
    setKesim,
    save,
    history,
    toast,
    workspace,
    setConflicts: (val) => setConflictsRef.current(val),
  });

  const { removedFromGroupIds, isGroupLocked, saveSingleGroupField, ...animalGroupsRest } = animalGroupsHook;

  const filters = useKesimAlaniFilters({ donations, groupedDonorIds, removedFromGroupIds });
  const {
    sortField, setSortField, sortDir, setSortDir,
    personSearchQuery, setPersonSearchQuery, debouncedSearchQuery, setDebouncedSearchQuery,
    filterUngrouped, setFilterUngrouped, showOnlyIncomplete, setShowOnlyIncomplete,
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
    siblingKesimAlanlari,
  });

  addSelectedToBasketRef.current = basket.addSelectedToBasket;

  const teams = useTeams({ kesim, setKesim, toast, setFilterTeam });
  const trash = useTrash({ kesim, setKesim, toast, history });

  const dragAndDrop = useDragAndDrop({ kesim, save, toast, isGroupLocked, scrollContainerRef });
  const {
    dragItem, setDragItem, dragOverItem, setDragOverItem, dragOverGroup, setDragOverGroup,
    moveGroupDonation, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd, handleDragOverCard,
  } = dragAndDrop;

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useKeyboardShortcuts({
    kesim,
    saveToApi,
    handleUndo,
    handleRedo,
    editingCell,
    cancelEdit,
    shortcutHelpOpen,
    setShortcutHelpOpen,
    minimapOpen,
    setMinimapOpen,
    fullscreenMode,
    setFullscreenMode,
    jumpDialogOpen,
    setJumpDialogOpen,
    searchInputRef,
    toggleFullscreen,
  });

  useEffect(() => {
    async function loadData() {
      if (params.id) {
        const data = await fetchKesimAlani(params.id);
        if (data) {
          setKesim(data);
          history.initialize(data);
          const stored = loadBasketFromStorage(data.projectId);
          basket.setBasketItems(stored);
          fetchPhotoCountsAdmin(data.id).then(setPhotoCounts).catch(() => {});
          if (data.projectId) {
            try {
              const [allKA, projects] = await Promise.all([fetchKesimAlanlari(), fetchProjects()]);
              const siblings = allKA
                .filter((ka) => ka.projectId === data.projectId && ka.id !== data.id && !ka.deletedAt)
                .map((ka) => ({ id: ka.id, name: ka.name }));
              setSiblingKesimAlanlari(siblings);
              const proj = projects.find((p) => p.id === data.projectId);
              if (proj) setProjectName(proj.name);
            } catch {}
          }
        } else {
          setLocation("/");
        }
      }
      try {
        const tags = await fetchTags();
        setGlobalTags(tags);
      } catch {}
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
      const container = scrollContainerRef.current;
      const scrollY = container ? container.scrollTop : window.scrollY;
      setShowScrollTop(scrollY > 150);
    };
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [fullscreenMode]);

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
      if (!isDraggingSplit || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const ratio = ((e.clientX - rect.left) / rect.width) * 100;
      workspace.setSplitRatio(ratio);
    };
    const handleMouseUp = () => setIsDraggingSplit(false);
    if (isDraggingSplit) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSplit]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const currentGroupMatches = useMemo(() => animalGroupsHook.groupSearchMatches(), [animalGroupsHook.groupSearchMatches]);

  const uniqueGroupDonationTypes = useMemo(() => {
    if (!kesim) return [];
    const types = new Set<string>();
    for (const group of kesim.animalGroups) {
      for (const d of group.donations) {
        const t = d.donationType?.trim();
        if (t) types.add(t);
      }
    }
    return Array.from(types).sort((a, b) => trCollator.compare(a, b));
  }, [kesim?.animalGroups]);

  const filteredGroupItems = useMemo(() => {
    if (!kesim) return [];
    return kesim.animalGroups
      .map((group, groupIdx) => ({ group, groupIdx }))
      .filter(({ group }) => {
        if (colorTagFilter !== "all" && (group.colorTag || "") !== colorTagFilter) return false;
        if (filterTeam !== "all") {
          if (filterTeam === "none" && group.teamId) return false;
          if (filterTeam !== "none" && group.teamId !== filterTeam) return false;
        }
        if (showOnlyIncomplete) {
          const filled = group.donations.filter((d) => d.name.trim() !== "").length;
          if (filled >= MAX_SHARES_PER_ANIMAL) return false;
        }
        if (groupCinsFilter.size > 0) {
          const hasMatchingType = group.donations.some(d => {
            const t = d.donationType?.trim();
            return t && groupCinsFilter.has(t);
          });
          if (!hasMatchingType) return false;
        }
        return true;
      });
  }, [kesim?.animalGroups, colorTagFilter, filterTeam, showOnlyIncomplete, groupCinsFilter]);

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
      if (idx >= 0 && groupsVirtuosoRef.current && filteredGroupItems.length > 20) {
        const rowIdx = Math.floor(idx / effectiveColumnCount);
        groupsVirtuosoRef.current.scrollToIndex({ index: rowIdx, align: "center", behavior: "smooth" });
      } else {
        const el = document.getElementById(`animal-group-${animalNo}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [filteredGroupItems, effectiveColumnCount]
  );

  scrollToAnimalGroupRef.current = scrollToAnimalGroup;

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
      setPhotoViewGroup({ id: groupId, animalNo });
      setPhotoViewLoading(true);
      fetchGroupPhotosAdmin(kesim.id, groupId)
        .then(setPhotoViewPhotos)
        .catch(() => setPhotoViewPhotos([]))
        .finally(() => setPhotoViewLoading(false));
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
      TableRow: ({ item: d, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { item?: Donation }) => (
        <tr
          {...props}
          data-donation-id={d?.id}
          className={`border-b hover:bg-muted/30 transition-colors ${d && selectedIds.has(d.id) ? "bg-primary/5" : ""} ${d?.excluded ? "opacity-40 line-through" : ""} ${d && donationsHook.highlightDonationId === d.id ? "ring-2 ring-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 animate-pulse" : ""}`}
        />
      ),
    }),
    [selectedIds, donationsHook.highlightDonationId]
  );

  const columnHeaderLabel = useCallback((key: ColumnKey): string => {
    const col = ALL_GROUP_COLUMNS.find((c) => c.key === key);
    return col?.label || "";
  }, []);

  const columnHeaderWidth = useCallback((key: ColumnKey): string => {
    switch (key) {
      case "drag": return "w-6";
      case "index": return "w-6";
      case "vekalet": return "w-16";
      case "donationType": return "w-16";
      case "notes": return "w-20";
      case "actions": return "w-8";
      default: return "";
    }
  }, []);

  const smartPlacement = useSmartPlacement({ kesim, save, isGroupLocked, setSmartPlacePopover });
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
    addSelectedToBasket: () => basket.addSelectedToBasket(selectedIds),
    addReviewRowsToBasket,
    applyBulkImport,
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
    colorTagFilter,
    columnHeaderLabel,
    columnHeaderWidth,
    columnMappings,
    csvExporting,
    currentGroupMatches,
    debouncedSearchQuery,
    descCountMap,
    displayPreviewRows,
    donorListReportOpen,
    donorListVisible,
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
    filterUngrouped,
    filteredDonations,
    filteredGroupItems,
    fullscreenMode,
    groupCinsFilter,
    getAvailableGroupsForDonor,
    getSwapSuggestions,
    globalTags,
    groupCompositions,
    groupRows,
    groupedDonorIds,
    groupsHeaderRef,
    groupsScrollTopRef,
    groupsVirtuosoRef,
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
    isDraggingSplit,
    isFullscreen,
    isMobile,
    jumpDialogOpen,
    jumpInputRef,
    jumpToAnimal,
    kesim,
    lastSavedTime: saveManagerRest.lastSavedTime,
    minimapOpen,
    mobileTab,
    moveGroupDonation,
    notificationLogs,
    notificationLogsLoading,
    notificationLogsOpen,
    notificationTemplate,
    notificationTemplateOpen,
    notificationTemplateSaving,
    pasteText,
    pendingSaveRef: saveManagerRest.pendingSaveRef,
    pendingSaveTypeRef: saveManagerRest.pendingSaveTypeRef,
    personSearchQuery,
    photoCounts,
    photoViewGroup,
    photoViewLoading,
    photoViewPhotos,
    previewData,
    processRawData,
    projectName,
    qrModalOpen,
    qrUrl,
    remainingSlots,
    requiredAnimals,
    resetBulkDialog,
    runGrouping,
    runIncrementalGrouping,
    save,
    saveStatus: saveManagerRest.saveStatus,
    saveTimeoutRef: saveManagerRest.saveTimeoutRef,
    scrollContainerRef,
    scrollToAnimalGroup,
    searchIndex,
    searchInputRef,
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
    setColorTagFilter,
    setGroupCinsFilter,
    setColumnMappings,
    setCsvExporting,
    setDebouncedSearchQuery,
    setDonorListReportOpen,
    setDonorListVisible,
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
    setFilterUngrouped,
    setFullscreenMode,
    setGlobalTags,
    setHasHeaderRow,
    setHighlightIncomplete,
    setHistoryPanelOpen,
    setIsDraggingSplit,
    setIsFullscreen,
    setJumpDialogOpen,
    setJumpToAnimal,
    setKesim,
    setLastSavedTime: saveManagerRest.setLastSavedTime,
    setLocation,
    setMinimapOpen,
    setMobileTab,
    setNotificationLogs,
    setNotificationLogsLoading,
    setNotificationLogsOpen,
    setNotificationTemplate,
    setNotificationTemplateOpen,
    setNotificationTemplateSaving,
    setPasteText,
    setPersonSearchQuery,
    setPhotoCounts,
    setPhotoViewGroup,
    setPhotoViewLoading,
    setPhotoViewPhotos,
    setPreviewData,
    setProjectName,
    setQrModalOpen,
    setQrUrl,
    setSaveStatus: saveManagerRest.setSaveStatus,
    setShortcutHelpOpen,
    setShowAdvancedFilter,
    setShowOnlyIncomplete,
    setShowRemovedFilter,
    setShowScrollTop,
    setSiblingKesimAlanlari,
    setSmartPlacePopover,
    setSortDir,
    setSortField,
    setSplitShareDialog,
    setTagPopoverDonorId,
    setTrackingNotes,
    setTrackingNotesLoading,
    setTrackingNotesOpen,
    shareDistribution,
    shortcutHelpOpen,
    showAdvancedFilter,
    showOnlyIncomplete,
    showRemovedFilter,
    showScrollTop,
    siblingKesimAlanlari,
    smartPlaceDonor,
    smartPlacePopover,
    sortDir,
    sortField,
    sortKeyMap,
    sortedDonorList,
    splitContainerRef,
    splitShareDialog,
    startFilterTransition,
    tagPopoverDonorId,
    themeMode,
    toast,
    toggleFullscreen,
    toggleTheme,
    totalShares,
    transferReviewRowsToKesimAlani,
    trackingNotes,
    trackingNotesLoading,
    trackingNotesOpen,
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
