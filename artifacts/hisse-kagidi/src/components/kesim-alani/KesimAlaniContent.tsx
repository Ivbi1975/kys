import React, { Suspense, forwardRef, useState, useCallback } from "react";
import type { KesimAlani, Donation, AnimalGroup, ColorTag } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";
import { AnimalGroupCard } from "@/components/AnimalGroupCard";
import { AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, Brain, ChevronDown, ChevronRight, ChevronUp, ChevronsDownUp, ChevronsUpDown, ClipboardPaste, Columns, Columns3, Download, Eye, EyeOff, FileSpreadsheet, FileText, Filter, GripVertical, History, Home, Keyboard, LayoutGrid, Link2, Loader2, Lock, MapIcon, Maximize, Maximize2, Merge, MessageSquarePlus, Minimize, Minimize2, Monitor, Moon, MoveRight, PanelLeftClose, PanelLeftOpen, Plus, Printer, QrCode, Redo2, RotateCcw, Save, Scissors, Search, SearchX, Send, Settings2, ShoppingBag, SlidersHorizontal, Sparkles, Sun, Tag, Trash2, Undo2, Unlock, Upload, UserCog, Wand2, X } from "lucide-react";
import { generateTrackingToken, fetchKesimAlaniTrackingNotes, fetchNotificationLogs } from "@/lib/api";
  import { checkGroupConflicts } from "@/lib/grouping";
  import { ALL_GROUP_COLUMNS, type ColumnKey } from "@/lib/useWorkspacePreferences";
  import type { useKesimAlaniState, ColumnMapping } from "./useKesimAlaniState";

  type KesimAlaniStateReturn = ReturnType<typeof useKesimAlaniState>;

  export function KesimAlaniContent(props: KesimAlaniStateReturn) {
  const {
    activeFilterCount,
    addDialogOpen,
    addDonation,
    addDonorToBasket,
    addEmptyGroup,
    addGroupToBasket,
    addSelectedToBasket,
    applyBulkEdit,
    applyBulkImport,
    applyRangeLock,
    availableAiCategories,
    basketItemIds,
    basketItems,
    bulkChangeGroupDonationType,
    bulkDialogOpen,
    bulkEditField,
    bulkEditOpen,
    bulkEditValue,
    bulkGroupEditField,
    bulkGroupEditOpen,
    bulkGroupEditValue,
    bulkMode,
    bulkMoveTargetGroup,
    bulkMoveToGroup,
    bulkRemoveFromGroups,
    bulkReviewExpanded,
    bulkReviewRows,
    bulkStep,
    cancelGrouping,
    cancelSwap,
    cleanEmptyGroups,
    clearAdvancedFilters,
    COLUMN_OPTIONS,
    collapseAll,
    collapsedGroups,
    colorTagFilter,
    columnHeaderLabel,
    columnHeaderWidth,
    columnMappings,
    commitEdit,
    conflicts,
    csvExporting,
    currentGroupMatches,
    debouncedSearchQuery,
    deleteAnimalGroup,
    deleteDonation,
    deleteSelected,
    descCountMap,
    displayPreviewRows,
    donorListVisible,
    dragItem,
    dragOverGroup,
    dragOverItem,
    editDraft,
    editingCell,
    effectiveColumnCount,
    effectiveShareMap,
    enhancedRemoveFromGroup,
    executeFindDelete,
    executeGroupFindDelete,
    expandAll,
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
    findDeleteColumnLabel,
    filterUngrouped,
    filteredDonations,
    filteredGroupItems,
    findDeleteColumn,
    findDeleteConfirm,
    findDeleteOpen,
    findDeleteValue,
    fullscreenMode,
    getFindDeleteMatches,
    getGroupFindDeleteMatches,
    globalTags,
    groupCompositions,
    groupFindDeleteColumn,
    groupFindDeleteConfirm,
    groupFindDeleteOpen,
    groupFindDeleteValue,
    groupRows,
    groupSearchMatchIdx,
    groupSearchQuery,
    groupedDonorIds,
    groupingInProgress,
    groupingProgress,
    groupsHeaderRef,
    groupsScrollTopRef,
    groupsVirtuosoRef,
    handleAssignTeam,
    handleAutoGroup,
    handleAutoGroupSelected,
    handleColumnDragEnd,
    handleColumnDragOver,
    handleColumnDragStart,
    handleColumnDrop,
    handleDonorCellKeyDown,
    handleDragEnd,
    handleDragLeave,
    handleDragOver,
    handleDragOverCard,
    handleDragStart,
    handleDrop,
    handleExportKaCsv,
    handleFileUpload,
    handleGoToStep,
    handleGroupCellTab,
    handlePasteData,
    handleRedo,
    handleSelectAllGroupDonations,
    handleSetGroupColorTag,
    handleSort,
    handleSwapSelect,
    handleToggleBasketItem,
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
    jumpInputRef,
    kesim,
    lastSavedTime,
    lockAllGroups,
    mergeSelectedGroups,
    minimapOpen,
    mobileTab,
    moveGroupDown,
    moveGroupUp,
    openAutoResolve,
    openSplitGroupDialog,
    openTrash,
    pasteText,
    photoCounts,
    projectName,
    rangeLockInput,
    remainingSlots,
    removeFromBasket,
    removedFromGroupIds,
    requiredAnimals,
    resetBulkDialog,
    save,
    saveStatus,
    saveToApi,
    scrollContainerRef,
    scrollToAnimalGroup,
    searchInputRef,
    selectedGroupDonations,
    selectedGroupIds,
    selectedIds,
    setAddDialogOpen,
    setBulkDialogOpen,
    setBulkEditField,
    setBulkEditOpen,
    setBulkEditValue,
    setBulkGroupEditField,
    setBulkGroupEditOpen,
    setBulkGroupEditValue,
    setBulkMode,
    setBulkMoveTargetGroup,
    setBulkReviewExpanded,
    setBulkReviewRows,
    setBulkStep,
    setColorTagFilter,
    setColumnMappings,
    setConflicts,
    setDonorListReportOpen,
    setDonorListVisible,
    setEditDraft,
    setFilterAiCategories,
    setFilterAiWarnings,
    setFilterCinsi,
    setFilterHisseMax,
    setFilterHisseMin,
    setFilterStatus,
    setFilterTags,
    setFilterUngrouped,
    setFindDeleteColumn,
    setFindDeleteConfirm,
    setFindDeleteOpen,
    setFindDeleteValue,
    setFullscreenMode,
    setGroupFindDeleteColumn,
    setGroupFindDeleteConfirm,
    setGroupFindDeleteOpen,
    setGroupFindDeleteValue,
    setGroupSearchMatchIdx,
    setGroupSearchQuery,
    setHasHeaderRow,
    setHighlightIncomplete,
    setHistoryPanelOpen,
    setIsDraggingSplit,
    setJumpDialogOpen,
    setKesim,
    setLocation,
    setMinimapOpen,
    setMobileTab,
    setNotificationLogs,
    setNotificationLogsLoading,
    setNotificationLogsOpen,
    setPasteText,
    setPersonEditDesc,
    setQrModalOpen,
    setQrUrl,
    setRangeLockInput,
    setDebouncedSearchQuery,
    setSelectedGroupDonations,
    setSelectedGroupIds,
    setSelectedIds,
    setShortcutHelpOpen,
    setShowAdvancedFilter,
    setShowConflicts,
    setShowOnlyIncomplete,
    setShowRemovedFilter,
    setSmartPlacePopover,
    setSplitShareDialog,
    setTagPopoverDonorId,
    setTeamDialogOpen,
    setTrackingNotes,
    setTrackingNotesLoading,
    setTrackingNotesOpen,
    shareDistribution,
    showAdvancedFilter,
    showConflicts,
    showOnlyIncomplete,
    showRemovedFilter,
    sortDir,
    sortField,
    splitContainerRef,
    startEditing,
    startFilterTransition,
    swapSelection,
    tagPopoverDonorId,
    themeMode,
    toast,
    toggleDonationTag,
    toggleFullscreen,
    toggleGroupCollapse,
    toggleGroupDonationSelect,
    toggleGroupLock,
    toggleGroupSelect,
    toggleSelect,
    toggleSelectAll,
    toggleTheme,
    totalShares,
    ungroupedDonors,
    ungroupedShareCount,
    uniqueDonationTypes,
    unlockAllGroups,
    updateDonationField,
    updateGroupDonation,
    updateGroupNotes,
    virtuosoTableComponents,
    workspace,
  } = props;

  const [searchQuery, setSearchQuery] = useState("");
  const [groupSearchInput, setGroupSearchInput] = useState("");
  const [newDonation, setNewDonation] = useState({
    name: "",
    description: "",
    donationType: "",
    shareCount: 1,
    vekalet: "",
    notes: "",
    phone: "",
  });

  const handleDonorSearch = useCallback(() => {
    setDebouncedSearchQuery(searchQuery);
  }, [searchQuery, setDebouncedSearchQuery]);

  const handleDonorSearchClear = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
  }, [setDebouncedSearchQuery]);

  const handleGroupSearch = useCallback(() => {
    setGroupSearchQuery(groupSearchInput);
    setGroupSearchMatchIdx(0);
  }, [groupSearchInput, setGroupSearchQuery, setGroupSearchMatchIdx]);

  const handleGroupSearchClear = useCallback(() => {
    setGroupSearchInput("");
    setGroupSearchQuery("");
    setGroupSearchMatchIdx(0);
  }, [setGroupSearchQuery, setGroupSearchMatchIdx]);

  const handleAddDonation = useCallback(() => {
    addDonation(newDonation);
    setNewDonation({ name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "", phone: "" });
  }, [addDonation, newDonation]);

  if (!kesim) return null;

    return (
      <div className={`mx-auto p-4 ${fullscreenMode ? "max-w-full" : "max-w-7xl"} ${basketItems.length > 0 ? "pb-24" : ""}`}>
      {!fullscreenMode && (
      <div className="mb-4">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
          <button onClick={() => setLocation("/")} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Home className="w-3 h-3" />
            <span>Ana Sayfa</span>
          </button>
          {kesim.projectId && projectName && (
            <>
              <ChevronRight className="w-3 h-3" />
              <button onClick={() => setLocation(`/proje/${kesim.projectId}`)} className="hover:text-foreground transition-colors truncate max-w-[120px]">
                {projectName}
              </button>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{kesim.name}</span>
        </nav>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">{kesim.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs md:text-sm text-muted-foreground truncate">
                {kesim.donations.length} bağışçı • {totalShares} hisse • {requiredAnimals} hayvan
              </p>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">ID:</span>
                <Input
                  className="h-6 text-xs w-28 px-1.5"
                  placeholder="Liste ID"
                  value={kesim.kesimListeId || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...kesim, kesimListeId: val || null };
                    save(updated, undefined, false);
                  }}
                  onBlur={() => {
                    save(kesim, undefined, true);
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  let token = kesim.trackingToken;
                  if (!token) {
                    token = await generateTrackingToken(kesim.id);
                    setKesim(prev => prev ? { ...prev, trackingToken: token } : prev);
                  }
                  const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/takip/${token}`;
                  await navigator.clipboard.writeText(url);
                  toast({ title: "Takip linki kopyalandı", description: "Link panoya kopyalandı" });
                } catch {
                  toast({ title: "Hata", description: "Link oluşturulamadı", variant: "destructive" });
                }
              }}
            >
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Takip Linki</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  let token = kesim.trackingToken;
                  if (!token) {
                    token = await generateTrackingToken(kesim.id);
                    setKesim(prev => prev ? { ...prev, trackingToken: token } : prev);
                  }
                  const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/takip/${token}`;
                  setQrUrl(url);
                  setQrModalOpen(true);
                } catch {
                  toast({ title: "Hata", description: "QR kod oluşturulamadı", variant: "destructive" });
                }
              }}
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">QR Kod</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                setTrackingNotesOpen(true);
                setTrackingNotesLoading(true);
                try {
                  const notes = await fetchKesimAlaniTrackingNotes(kesim.id);
                  setTrackingNotes(notes);
                } catch {} finally {
                  setTrackingNotesLoading(false);
                }
              }}
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Saha Notları</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTeamDialogOpen(true)}
            >
              <UserCog className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Ekipler</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                setNotificationLogsOpen(true);
                setNotificationLogsLoading(true);
                try {
                  const logs = await fetchNotificationLogs(kesim.id);
                  setNotificationLogs(logs);
                } catch {
                  toast({ title: "Hata", description: "Bildirim kayıtları yüklenemedi", variant: "destructive" });
                } finally {
                  setNotificationLogsLoading(false);
                }
              }}
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Bildirimler</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={toggleTheme} title={themeMode === "light" ? "Koyu Mod" : themeMode === "dark" ? "Sistem" : "Açık Mod"}>
              {themeMode === "light" ? <Sun className="w-4 h-4" /> : themeMode === "dark" ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => saveToApi(kesim)}
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saving" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="hidden sm:inline ml-1">Kaydet</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Kaydediliyor...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Save className="w-3 h-3" />
                Kaydedildi
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="w-3 h-3" />
                Kaydetme hatası
              </span>
            )}
            {(saveStatus === "idle" || saveStatus === "saved") && lastSavedTime && (
              <span className="flex items-center gap-1">
                <Save className="w-3 h-3" />
                Son kayıt: {lastSavedTime.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })} {lastSavedTime.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 flex-wrap justify-end">
            <div className="flex items-center gap-0.5 border rounded-md px-0.5">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleUndo} disabled={!history.canUndo} title="Geri Al (Ctrl+Z)">
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleRedo} disabled={!history.canRedo} title="İleri Al (Ctrl+Y)">
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setHistoryPanelOpen(!historyPanelOpen)} title="Geçmiş">
                <History className="w-3.5 h-3.5" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hidden sm:flex" onClick={() => setShortcutHelpOpen(true)} title="Klavye Kısayolları (?)">
              <Keyboard className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hidden sm:flex" onClick={toggleFullscreen} title="Tam Ekran (F11)">
              {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={exportDonorsExcel} title="Bağışçı Listesi Excel">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </Button>
            {kesim.animalGroups.length > 0 && (
              <>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={exportGroupsExcel} title="Kesim Kağıdı Excel">
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Excel</span>
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setLocation(`/not-duzenleme/${kesim.id}`)}>
                  <Search className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Notlar</span>
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setLocation(`/print/${kesim.id}`)}>
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Yazdır</span>
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleExportKaCsv} disabled={csvExporting}>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">{csvExporting ? "..." : "CSV"}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {!fullscreenMode && (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3 mb-4">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">{kesim.donations.filter(d => !d.excluded).length}</div>
          <div className="text-xs text-muted-foreground">Aktif Bağışçı</div>
        </Card>
        {kesim.donations.filter(d => d.excluded).length > 0 && (
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-destructive">{kesim.donations.filter(d => d.excluded).length}</div>
            <div className="text-xs text-muted-foreground">Hariç Tutulan</div>
          </Card>
        )}
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">{totalShares}</div>
          <div className="text-xs text-muted-foreground">Toplam Hisse</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">{requiredAnimals}</div>
          <div className="text-xs text-muted-foreground">Gereken Hayvan</div>
          {remainingSlots > 0 && (
            <div className="text-[10px] text-orange-500 mt-0.5">({remainingSlots} boş slot)</div>
          )}
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">
            {kesim.animalGroups.length > 0
              ? kesim.animalGroups.reduce((sum, g) => sum + g.donations.filter(d => d.name.trim() === "").length, 0)
              : 0}
          </div>
          <div className="text-xs text-muted-foreground">Boş Slot</div>
        </Card>
        {kesim.animalGroups.length > 0 && (
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">
              %{Math.round((kesim.animalGroups.reduce((s, g) => s + g.donations.filter(d => d.name.trim() !== "").length, 0) / (kesim.animalGroups.length * 7)) * 100)}
            </div>
            <div className="text-xs text-muted-foreground">Doluluk</div>
          </Card>
        )}
        {kesim.animalGroups.length > 0 && (() => {
          const kesildiCount = kesim.animalGroups.filter(g => g.kesildi).length;
          const lastAt = kesim.animalGroups
            .filter(g => g.kesildiAt)
            .map(g => g.kesildiAt!)
            .sort()
            .pop();
          return (
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {kesildiCount}/{kesim.animalGroups.length}
              </div>
              <div className="text-xs text-muted-foreground">Kesildi</div>
              {lastAt && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Son: {new Date(lastAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </Card>
          );
        })()}
        {Object.values(photoCounts).reduce((a, b) => a + b, 0) > 0 && (
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Object.values(photoCounts).reduce((a, b) => a + b, 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              Fotoğraf ({Object.keys(photoCounts).length} grup)
            </div>
          </Card>
        )}
        {ungroupedDonors.length > 0 && (
          <Card
            className={`p-3 text-center cursor-pointer transition-colors ${filterUngrouped ? "ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950" : "hover:bg-muted"}`}
            onClick={() => {
              setFilterUngrouped(!filterUngrouped);
              if (!donorListVisible) setDonorListVisible(true);
            }}
          >
            <div className="text-2xl font-bold text-orange-600">{ungroupedDonors.length}</div>
            <div className="text-xs text-muted-foreground">{ungroupedShareCount} hisse gruplanmamış</div>
          </Card>
        )}
      </div>
      )}

      {!fullscreenMode && (kesim.donations.filter(d => !d.excluded).length > 0 || kesim.animalGroups.length > 0) && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {kesim.donations.filter(d => !d.excluded).length > 0 && (
        <Card className="p-3">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Hisse Dağılımı</h4>
          <div className="space-y-1">
            {[1, 2, 3, 4, 5, 6, 7].map(sc => {
              const count = shareDistribution[sc] || 0;
              if (count === 0) return null;
              const totalUnique = Object.values(shareDistribution).reduce((s, c) => s + c, 0);
              const pct = totalUnique > 0 ? (count / totalUnique) * 100 : 0;
              return (
                <div key={sc} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-right text-muted-foreground">{sc} hisse:</span>
                  <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
        )}

        {kesim.animalGroups.length > 0 && (
        <Card className="p-3">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Grup Kompozisyonları</h4>
          <div className="space-y-1">
            {Array.from(groupCompositions.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => (
                <div key={label} className="flex items-center justify-between text-xs px-1 py-0.5 rounded hover:bg-muted">
                  <span className="font-mono text-muted-foreground">{label}</span>
                  <span className="font-medium">{count} grup</span>
                </div>
              ))}
          </div>
        </Card>
        )}
      </div>
      )}

      {!fullscreenMode && kesim.donations.length > 0 && (
        <div className="mb-4 flex gap-2">
          <Button onClick={() => handleAutoGroup()} className="flex-1" disabled={groupingInProgress}>
            {groupingInProgress ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {groupingProgress
                  ? `Gruplama: ${groupingProgress.current}/${groupingProgress.total} hayvan`
                  : "Gruplama başlıyor..."}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                {kesim.animalGroups.length > 0 ? "Artımlı Grupla" : "Otomatik Grupla"} ({requiredAnimals} Hayvan)
              </>
            )}
          </Button>
          {!groupingInProgress && kesim.animalGroups.length > 0 && (
            <Button variant="outline" onClick={() => handleAutoGroup(true)} disabled={groupingInProgress} title="Tüm grupları sıfırdan yeniden oluştur">
              <RotateCcw className="w-4 h-4 mr-1" />
              Tam Grupla
            </Button>
          )}
          {groupingInProgress && (
            <Button variant="destructive" size="icon" onClick={cancelGrouping} title="İptal">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {historyPanelOpen && !fullscreenMode && (
        <Card className="mb-4 p-3 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">İşlem Geçmişi</h3>
            <Button variant="ghost" size="sm" onClick={() => setHistoryPanelOpen(false)}>✕</Button>
          </div>
          <div className="space-y-1">
            {history.historyList.map((item, i) => (
              <button
                key={i}
                onClick={() => handleGoToStep(i)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                  item.isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <span className="font-medium">{item.description}</span>
                <span className="ml-2 opacity-60">
                  {new Date(item.timestamp).toLocaleTimeString("tr-TR")}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {!fullscreenMode && (
        <div className="flex md:hidden border-b mb-4">
          <button
            className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${mobileTab === "donors" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => startFilterTransition(() => setMobileTab("donors"))}
          >
            Bağışçı Listesi ({kesim.donations.filter(d => !d.excluded).length})
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${mobileTab === "groups" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => startFilterTransition(() => setMobileTab("groups"))}
          >
            Hayvan Grupları ({kesim.animalGroups.length})
          </button>
        </div>
      )}

      <div
        ref={splitContainerRef}
        className="flex gap-0"
        style={{ position: "relative" }}
      >
        {(isMobile || donorListVisible) && !fullscreenMode && <div className={`${isMobile && mobileTab !== "donors" ? "hidden" : ""}`} style={isMobile ? { width: "100%", minWidth: 0 } : { width: `${workspace.prefs.splitRatio}%`, minWidth: 0, flexShrink: 0, paddingRight: "12px" }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold whitespace-nowrap">Bağışçı Listesi</h2>
              {filterUngrouped && (
                <button
                  onClick={() => setFilterUngrouped(false)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
                >
                  Gruplanmamış
                  <span className="text-[10px]">✕</span>
                </button>
              )}
              {removedFromGroupIds.size > 0 && (
                <button
                  onClick={() => {
                    setShowRemovedFilter(!showRemovedFilter);
                    if (!donorListVisible) setDonorListVisible(true);
                  }}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                    showRemovedFilter
                      ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 ring-1 ring-red-500"
                      : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900"
                  }`}
                >
                  Gruptan Çıkarılanlar ({removedFromGroupIds.size})
                  {showRemovedFilter && <span className="text-[10px]">✕</span>}
                </button>
              )}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex items-center gap-1">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    className="h-8 text-sm pl-8 pr-7 w-32 sm:w-48"
                    placeholder="Ara... (Ctrl+F)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleDonorSearch(); } }}
                  />
                  {(searchQuery || debouncedSearchQuery) && (
                    <button
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
                      onClick={handleDonorSearchClear}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <Button variant="outline" size="sm" className="h-8 px-2" onClick={handleDonorSearch} title="Ara">
                  Ara
                </Button>
              </div>
              <Button
                variant={showAdvancedFilter ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                title="Gelişmiş Filtre"
              >
                <Filter className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDonorListReportOpen(true)} title="Bağışçı Listesi Raporu">
                <FileText className="w-4 h-4" />
              </Button>
              <Dialog open={bulkDialogOpen} onOpenChange={(open) => { if (!open) resetBulkDialog(); else setBulkDialogOpen(true); }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="w-4 h-4 mr-1" />
                    Toplu Ekle
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>
                      {bulkStep === "input" ? "Toplu Bağışçı Ekle" : bulkStep === "review" ? "Yüksek Hisse Sayılı Satırlar" : "Sütun Eşleştirme"}
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

                  {bulkStep === "review" && (() => {
                    const groupKeys = [...new Set(bulkReviewRows.map(r => r.groupKey))];
                    const selectedGroupCount = groupKeys.filter(gk => bulkReviewRows.filter(r => r.groupKey === gk).every(r => r.selected)).length;
                    return (
                    <div className="flex flex-col min-h-0 flex-1 pt-4">
                      <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg mb-4 flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                        <p className="text-sm">
                          Aşağıdaki vekaleti verenlerin toplam hisse sayısı 50'den fazla. Dahil etmek istemediklerinizi işaretli bırakın.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBulkReviewRows(prev => prev.map(r => ({ ...r, selected: true })))}
                        >
                          Tümünü Seç
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBulkReviewRows(prev => prev.map(r => ({ ...r, selected: false })))}
                        >
                          Tümünü Kaldır
                        </Button>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {selectedGroupCount} / {groupKeys.length} grup dahil edilmeyecek
                        </span>
                      </div>

                      <div className="border rounded-lg overflow-hidden min-h-0 flex-1">
                        <div className="overflow-auto max-h-full divide-y">
                          {groupKeys.map((gk) => {
                            const groupRows = bulkReviewRows.filter(r => r.groupKey === gk);
                            const groupTotal = groupRows[0]?.groupTotal ?? 0;
                            const descColIdx = columnMappings.indexOf("description");
                            const displayName = descColIdx >= 0 ? String(groupRows[0]?.row[descColIdx] ?? "").trim() : gk;
                            const allSelected = groupRows.every(r => r.selected);
                            const isExpanded = bulkReviewExpanded.has(gk);
                            return (
                              <div key={gk}>
                                <div className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${allSelected ? "bg-red-500/5" : ""}`}>
                                  <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const newVal = !allSelected;
                                      setBulkReviewRows(prev => prev.map(r => r.groupKey === gk ? { ...r, selected: newVal } : r));
                                    }}
                                    className="rounded flex-shrink-0"
                                  />
                                  <button
                                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                    onClick={() => {
                                      setBulkReviewExpanded(prev => {
                                        const next = new Set(prev);
                                        if (next.has(gk)) next.delete(gk); else next.add(gk);
                                        return next;
                                      });
                                    }}
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                                    <span className="text-sm font-medium truncate flex-1">{displayName}</span>
                                  </button>
                                  <span className={`text-xs font-mono font-bold flex-shrink-0 ${allSelected ? "text-red-600" : "text-muted-foreground"}`}>
                                    {groupTotal} hisse
                                  </span>
                                  <span className="text-xs text-muted-foreground flex-shrink-0">
                                    ({groupRows.length} satır)
                                  </span>
                                </div>
                                {isExpanded && (
                                  <div className="bg-muted/20 border-t">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b bg-muted/30">
                                          <th className="p-1.5 pl-10 w-10 text-center text-xs font-medium text-muted-foreground">Dahil</th>
                                          <th className="p-1.5 text-left text-xs font-medium text-muted-foreground">Adına Kesilen</th>
                                          <th className="p-1.5 text-left text-xs font-medium text-muted-foreground">Cinsi</th>
                                          <th className="p-1.5 text-right text-xs font-medium text-muted-foreground">Hisse</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {groupRows.map((item) => {
                                          const globalIdx = bulkReviewRows.indexOf(item);
                                          const nameColIdx = columnMappings.indexOf("name");
                                          const typeColIdx = columnMappings.indexOf("donationType");
                                          const name = nameColIdx >= 0 ? String(item.row[nameColIdx] ?? "").trim() : "";
                                          const dtype = typeColIdx >= 0 ? String(item.row[typeColIdx] ?? "").trim() : "";
                                          return (
                                            <tr key={item.idx} className={`border-b last:border-0 ${item.selected ? "bg-red-500/5 text-muted-foreground line-through" : ""}`}>
                                              <td className="p-1.5 pl-10 text-center">
                                                <input
                                                  type="checkbox"
                                                  checked={!item.selected}
                                                  onChange={() => {
                                                    setBulkReviewRows(prev => prev.map((r, ri) => ri === globalIdx ? { ...r, selected: !r.selected } : r));
                                                  }}
                                                  className="rounded"
                                                />
                                              </td>
                                              <td className="p-1.5 text-sm">{name || "—"}</td>
                                              <td className="p-1.5 text-sm">{dtype || "—"}</td>
                                              <td className="p-1.5 text-sm text-right font-mono">{item.rawShareCount}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 flex-shrink-0">
                        <Button variant="outline" onClick={() => setBulkStep("mapping")} className="flex-1">
                          Geri
                        </Button>
                        <Button onClick={applyBulkImport} className="flex-1">
                          {bulkReviewRows.filter(r => r.selected).length > 0
                            ? `${bulkReviewRows.filter(r => r.selected).length} Satırı Çıkar ve Devam Et`
                            : "Tümünü Dahil Et ve Devam Et"}
                        </Button>
                      </div>
                    </div>
                    );
                  })()}

                  {bulkStep === "mapping" && (
                    <div className="flex flex-col min-h-0 flex-1 pt-4">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4 flex-shrink-0">
                        <Settings2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">
                          Her sütunun hangi bilgiye karşılık geldiğini aşağıdan seçin. Kullanmak istemediğiniz sütunları "Atla" olarak ayarlayın.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
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

                      <div className="border rounded-lg overflow-hidden min-h-0 flex-1">
                        <div className="overflow-auto max-h-full">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10">
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

                      <div className="flex gap-2 pt-4 flex-shrink-0">
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

              <Dialog open={findDeleteOpen} onOpenChange={(open) => { setFindDeleteOpen(open); if (!open) { setFindDeleteValue(""); setFindDeleteConfirm(false); } }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" title="Sütuna Göre Bul ve Sil">
                    <SearchX className="w-4 h-4 mr-1" />
                    Bul ve Sil
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Sütuna Göre Bul ve Sil</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Sütun Seç</label>
                      <Select value={findDeleteColumn} onValueChange={(v: "name" | "description" | "donationType" | "vekalet" | "notes") => { setFindDeleteColumn(v); setFindDeleteValue(""); setFindDeleteConfirm(false); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="description">Vekaleti Veren</SelectItem>
                          <SelectItem value="name">Adına Kesilen</SelectItem>
                          <SelectItem value="donationType">Cinsi</SelectItem>
                          <SelectItem value="vekalet">Vekalet No</SelectItem>
                          <SelectItem value="notes">Notlar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Aranacak Değer</label>
                      <Input
                        placeholder={`${findDeleteColumnLabel[findDeleteColumn]} içinde ara...`}
                        value={findDeleteValue}
                        onChange={(e) => { setFindDeleteValue(e.target.value); setFindDeleteConfirm(false); }}
                      />
                    </div>
                    {findDeleteValue.trim() && (() => {
                      const matches = getFindDeleteMatches();
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {matches.length > 0
                                ? `${matches.length} kayıt bulundu`
                                : "Eşleşen kayıt bulunamadı"}
                            </span>
                          </div>
                          {matches.length > 0 && (
                            <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-muted/50 border-b">
                                    <th className="p-2 text-left font-medium">Vekaleti Veren</th>
                                    <th className="p-2 text-left font-medium">Adına Kesilen</th>
                                    <th className="p-2 text-left font-medium">Cinsi</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {matches.slice(0, 50).map((d) => (
                                    <tr key={d.id} className="border-b last:border-0">
                                      <td className="p-2">{d.description || "—"}</td>
                                      <td className="p-2">{d.name || "—"}</td>
                                      <td className="p-2">{d.donationType || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {matches.length > 50 && (
                                <div className="p-2 text-xs text-muted-foreground text-center bg-muted/20">
                                  ... ve {matches.length - 50} kayıt daha
                                </div>
                              )}
                            </div>
                          )}
                          {matches.length > 0 && !findDeleteConfirm && (
                            <Button
                              variant="destructive"
                              className="w-full"
                              onClick={() => setFindDeleteConfirm(true)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              {matches.length} Kaydı Sil
                            </Button>
                          )}
                          {matches.length > 0 && findDeleteConfirm && (
                            <div className="space-y-2 border border-destructive/50 rounded-lg p-3 bg-destructive/5">
                              <p className="text-sm font-medium text-destructive">
                                {matches.length} bağışçı kalıcı olarak silinecek. Emin misiniz?
                              </p>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => setFindDeleteConfirm(false)}>
                                  İptal
                                </Button>
                                <Button variant="destructive" size="sm" className="flex-1" onClick={executeFindDelete}>
                                  Evet, Sil
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" onClick={openTrash} title="Bağış Çöp Kutusu">
                <Trash2 className="w-4 h-4 mr-1" />
                Çöp Kutusu
              </Button>

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
                      placeholder="Vekalet No"
                      value={newDonation.vekalet}
                      onChange={(e) =>
                        setNewDonation({ ...newDonation, vekalet: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Vekaleti Veren"
                      value={newDonation.description}
                      onChange={(e) =>
                        setNewDonation({
                          ...newDonation,
                          description: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="Adına Kesilen"
                      value={newDonation.name}
                      onChange={(e) =>
                        setNewDonation({ ...newDonation, name: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Cinsi (Vacip, Akika, Adak...)"
                      value={newDonation.donationType}
                      onChange={(e) =>
                        setNewDonation({
                          ...newDonation,
                          donationType: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="Notlar"
                      value={newDonation.notes}
                      onChange={(e) =>
                        setNewDonation({
                          ...newDonation,
                          notes: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="Telefon (opsiyonel)"
                      value={newDonation.phone}
                      onChange={(e) =>
                        setNewDonation({
                          ...newDonation,
                          phone: e.target.value,
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
                    <Button onClick={handleAddDonation} className="w-full">
                      Ekle
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {showAdvancedFilter && (
            <Card className="mb-3 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-1">
                  <SlidersHorizontal className="w-4 h-4" />
                  Gelişmiş Filtre
                </span>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAdvancedFilters}>
                    <X className="w-3 h-3 mr-1" />
                    Temizle
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Cinsi</label>
                  <Select value={filterCinsi} onValueChange={setFilterCinsi}>
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tümü</SelectItem>
                      {uniqueDonationTypes.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Hisse (min)</label>
                  <Select value={String(filterHisseMin)} onValueChange={v => setFilterHisseMin(parseInt(v))}>
                    <SelectTrigger className="h-7 text-xs w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">-</SelectItem>
                      {[1,2,3,4,5,6,7].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Hisse (max)</label>
                  <Select value={String(filterHisseMax)} onValueChange={v => setFilterHisseMax(parseInt(v))}>
                    <SelectTrigger className="h-7 text-xs w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">-</SelectItem>
                      {[1,2,3,4,5,6,7].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Durum</label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "active" | "excluded")}>
                    <SelectTrigger className="h-7 text-xs w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tümü</SelectItem>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="excluded">Hariç</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {globalTags.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Etiketler</label>
                    <div className="flex gap-1 flex-wrap">
                      {globalTags.map(tag => {
                        const isActive = filterTags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${isActive ? "ring-2 ring-offset-1 ring-primary text-white" : "opacity-60 hover:opacity-100 text-white"}`}
                            style={{ backgroundColor: tag.color }}
                            onClick={() => setFilterTags(
                              isActive ? filterTags.filter(t => t !== tag.id) : [...filterTags, tag.id]
                            )}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {availableAiCategories.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Brain className="w-3 h-3" /> AI Kategorileri
                    </label>
                    <div className="flex gap-1 flex-wrap">
                      {availableAiCategories.map(cat => {
                        const isActive = filterAiCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${isActive ? "bg-violet-600 text-white border-violet-600 ring-2 ring-offset-1 ring-violet-400" : "bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 opacity-70 hover:opacity-100"}`}
                            onClick={() => setFilterAiCategories(
                              isActive ? filterAiCategories.filter(c => c !== cat) : [...filterAiCategories, cat]
                            )}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={filterAiWarnings}
                        onChange={(e) => setFilterAiWarnings(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> Uyarılı bağışçılar
                      </span>
                    </label>
                  </div>
                )}
              </div>
              {(activeFilterCount > 0 || searchQuery.trim() || filterUngrouped || showRemovedFilter) && (
                <div className="text-xs text-muted-foreground">
                  {filteredDonations.length} / {kesim.donations.length} bağışçı gösteriliyor
                </div>
              )}
            </Card>
          )}

          {!showAdvancedFilter && (searchQuery.trim() || filterUngrouped || showRemovedFilter) && (
            <div className="text-xs text-muted-foreground mb-2 px-1">
              {filteredDonations.length} / {kesim.donations.length} bağışçı gösteriliyor
            </div>
          )}

          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center gap-3 p-2 bg-primary/10 rounded-lg flex-wrap">
              <span className="text-sm font-medium">
                {selectedIds.size} satır seçildi
              </span>
              <Button variant="destructive" size="sm" onClick={deleteSelected}>
                <Trash2 className="w-3 h-3 mr-1" />
                Sil
              </Button>
              <Button variant="outline" size="sm" onClick={addSelectedToBasket}>
                <ShoppingBag className="w-3 h-3 mr-1" />
                Sepete Ekle
              </Button>
              <Button variant="outline" size="sm" onClick={handleAutoGroupSelected} disabled={groupingInProgress}>
                <Wand2 className="w-3 h-3 mr-1" />
                Seçilenleri Grupla
              </Button>
              <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="w-3 h-3 mr-1" />
                    Toplu Düzenle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{selectedIds.size} Bağışçıyı Toplu Düzenle</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Select value={bulkEditField} onValueChange={(v: "donationType" | "shareCount" | "notes" | "vekalet") => setBulkEditField(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="donationType">Cinsi</SelectItem>
                        <SelectItem value="shareCount">Hisse Sayısı</SelectItem>
                        <SelectItem value="vekalet">Vekalet No</SelectItem>
                        <SelectItem value="notes">Notlar</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={bulkEditField === "shareCount" ? "1-7" : "Yeni değer"}
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                      type={bulkEditField === "shareCount" ? "number" : "text"}
                    />
                    <Button onClick={applyBulkEdit} className="w-full">
                      Uygula
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Seçimi Kaldır
              </Button>
            </div>
          )}

          <Card className="overflow-hidden">
            {filteredDonations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {searchQuery.trim() ? `"${searchQuery}" için sonuç bulunamadı` : filterUngrouped ? "Tüm bağışçılar gruplara atanmış" : 'Henüz bağışçı eklenmedi. "Toplu Ekle" ile Excel yükleyin veya yapıştırın.'}
              </div>
            ) : (
              <TableVirtuoso
                style={{ height: `min(calc(100vh - 150px), ${filteredDonations.length * 45 + 50}px)`, minHeight: 200 }}
                data={filteredDonations}
                overscan={30}
                computeItemKey={(_idx: number, d: Donation) => d.id}
                components={virtuosoTableComponents as any}
                fixedHeaderContent={() => (
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
                    <th className="p-2 text-left w-20">Vekalet</th>
                    <th
                      className="p-2 text-left cursor-pointer hover:bg-muted"
                      onClick={() => handleSort("description")}
                    >
                      <span className="flex items-center gap-1">
                        Vekaleti Veren
                        {sortField === "description" && (
                          sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                        {sortField !== "description" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                      </span>
                    </th>
                    <th
                      className="p-2 text-left cursor-pointer hover:bg-muted"
                      onClick={() => handleSort("name")}
                    >
                      <span className="flex items-center gap-1">
                        Adına Kesilen
                        {sortField === "name" && (
                          sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                        {sortField !== "name" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                      </span>
                    </th>
                    <th
                      className="p-2 text-left cursor-pointer hover:bg-muted w-20"
                      onClick={() => handleSort("donationType")}
                    >
                      <span className="flex items-center gap-1">
                        Cinsi
                        {sortField === "donationType" && (
                          sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                        {sortField !== "donationType" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                      </span>
                    </th>
                    <th className="p-2 text-left w-24">Notlar</th>
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
                )}
                itemContent={(idx, d) => {
                  const descCount = d.excluded ? 0 : (descCountMap.get(d.description.trim().toLowerCase()) || 1);
                  const effectiveShare = descCount > 1 ? descCount : d.shareCount;
                  return (<>
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
                          editingCell?.field === "vekalet" ? (
                            <Input
                              className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5"
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onBlur={() => commitEdit()}
                              onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "vekalet")}
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                              onClick={() => startEditing(d.id, "vekalet")}
                            >
                              {d.vekalet || "—"}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {editingCell?.donationId === d.id &&
                          editingCell?.field === "description" ? (
                            <Input
                              className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5"
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onBlur={() => commitEdit()}
                              onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "description")}
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-1">
                              <span
                                className="cursor-text flex-1 block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                                onClick={() => startEditing(d.id, "description")}
                              >
                                {d.description || "—"}
                              </span>
                              {d.description && descCount > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 shrink-0"
                                  title="Bu kişinin tüm kayıtlarını düzenle"
                                  onClick={() => setPersonEditDesc(d.description)}
                                >
                                  <UserCog className="w-3 h-3 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          {editingCell?.donationId === d.id &&
                          editingCell?.field === "name" ? (
                            <Input
                              className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5"
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onBlur={() => commitEdit()}
                              onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "name")}
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                              onClick={() => startEditing(d.id, "name")}
                            >
                              {d.name || "—"}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {editingCell?.donationId === d.id &&
                          editingCell?.field === "donationType" ? (
                            <Input
                              className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5"
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onBlur={() => commitEdit()}
                              onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "donationType")}
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                              onClick={() => startEditing(d.id, "donationType")}
                            >
                              {d.donationType || "—"}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {editingCell?.donationId === d.id &&
                          editingCell?.field === "notes" ? (
                            <Input
                              className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5"
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onBlur={() => commitEdit()}
                              onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "notes")}
                              autoFocus
                            />
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span
                                className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                                onClick={() => startEditing(d.id, "notes")}
                              >
                                {d.notes || "—"}
                              </span>
                              {((d.aiCategories && d.aiCategories.length > 0) || (d.aiWarnings && d.aiWarnings.trim())) && (
                                <div className="flex gap-0.5 flex-wrap px-1">
                                  {(d.aiCategories || []).map(cat => (
                                    <span key={cat} className="px-1.5 py-0 rounded-full text-[9px] font-medium bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                                      {cat}
                                    </span>
                                  ))}
                                  {d.aiWarnings && d.aiWarnings.trim() && (
                                    <span className="px-1.5 py-0 rounded-full text-[9px] font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-0.5" title={d.aiWarnings}>
                                      <AlertTriangle className="w-2.5 h-2.5" /> uyarı
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {descCount > 1 ? (
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
                          <div className="flex items-center gap-1 flex-wrap">
                            {(d.tags || []).length > 0 && globalTags.length > 0 && (
                              <div className="flex gap-0.5 flex-wrap mr-1">
                                {(d.tags || []).map(tagId => {
                                  const tag = globalTags.find(t => t.id === tagId);
                                  if (!tag) return null;
                                  return (
                                    <span
                                      key={tagId}
                                      className="px-1.5 py-0 rounded-full text-[9px] font-medium text-white leading-4"
                                      style={{ backgroundColor: tag.color }}
                                    >
                                      {tag.name}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {globalTags.length > 0 && (
                              <Popover open={tagPopoverDonorId === d.id} onOpenChange={(open) => setTagPopoverDonorId(open ? d.id : null)}>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Etiket ata">
                                    <Tag className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2" align="end">
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Etiket Ata</p>
                                    {globalTags.map(tag => {
                                      const isActive = (d.tags || []).includes(tag.id);
                                      return (
                                        <button
                                          key={tag.id}
                                          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted transition-colors ${isActive ? "bg-muted" : ""}`}
                                          onClick={() => toggleDonationTag(d.id, tag.id)}
                                        >
                                          <span
                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: tag.color }}
                                          />
                                          <span className="flex-1 text-left">{tag.name}</span>
                                          {isActive && <span className="text-primary">✓</span>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {!d.excluded && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 w-7 p-0 ${basketItemIds.has(d.id) ? "bg-emerald-100 dark:bg-emerald-900" : ""}`}
                                title={basketItemIds.has(d.id) ? "Sepetten Çıkar" : "Sepete Ekle"}
                                onClick={() => basketItemIds.has(d.id) ? removeFromBasket(d.id) : addDonorToBasket(d.id)}
                              >
                                <ShoppingBag className={`w-3 h-3 ${basketItemIds.has(d.id) ? "text-emerald-600" : "text-muted-foreground"}`} />
                              </Button>
                            )}
                            {!d.excluded && !groupedDonorIds.has(d.id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Akıllı Yerleştir"
                                onClick={() => setSmartPlacePopover(d.id)}
                              >
                                <Wand2 className="w-3 h-3 text-primary" />
                              </Button>
                            )}
                            {(effectiveShareMap.get(d.id) || d.shareCount) > 7 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Hisse Böl"
                                onClick={() => setSplitShareDialog({ donationId: d.id, totalShares: effectiveShareMap.get(d.id) || d.shareCount })}
                              >
                                <Scissors className="w-3 h-3 text-amber-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title={d.excluded ? "Dahil et" : "Hariç tut"}
                              onClick={() => updateDonationField(d.id, "excluded", !d.excluded)}
                            >
                              {d.excluded ? <Eye className="w-3 h-3 text-green-600" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => deleteDonation(d.id)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        </td>
                  </>);
                }}
              />
            )}
          </Card>

        </div>}

        {donorListVisible && !fullscreenMode && !isMobile && (
          <div
            className="w-2 cursor-col-resize flex-shrink-0 group relative"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingSplit(true);
            }}
          >
            <div className={`absolute inset-y-0 left-0 right-0 rounded transition-colors ${isDraggingSplit ? "bg-primary" : "bg-border group-hover:bg-primary/50"}`} />
          </div>
        )}

        <div className={`${isMobile && mobileTab !== "groups" ? "hidden" : ""}`} style={{ flex: 1, minWidth: 0 }}>
          <div ref={groupsHeaderRef} className="flex items-center justify-between mb-4 flex-wrap gap-2 sticky top-0 z-20 bg-background py-2 -mt-2 border-b border-transparent" style={{ backdropFilter: "blur(8px)" }}>
            <div className="flex items-center gap-2 flex-wrap">
              {!fullscreenMode && !isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => startFilterTransition(() => setDonorListVisible(!donorListVisible))}
                  title={donorListVisible ? "Bağışçı Listesini Gizle" : "Bağışçı Listesini Göster"}
                >
                  {donorListVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                </Button>
              )}
              {kesim.animalGroups.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setMinimapOpen(!minimapOpen)}
                  title="Mini Harita"
                >
                  <MapIcon className="w-4 h-4" />
                </Button>
              )}
              <h2 className="text-lg font-semibold">
                Hayvan Grupları
                {kesim.animalGroups.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({colorTagFilter === "all" && !showOnlyIncomplete
                      ? kesim.animalGroups.length
                      : kesim.animalGroups.filter(g => {
                          if (colorTagFilter !== "all" && (g.colorTag || "") !== colorTagFilter) return false;
                          if (showOnlyIncomplete && g.donations.filter(d => d.name.trim() !== "").length >= 7) return false;
                          return true;
                        }).length
                    }/{kesim.animalGroups.length} hayvan)
                  </span>
                )}
              </h2>
              <Button variant="outline" size="sm" onClick={addEmptyGroup} title="Boş Hayvan Ekle">
                <Plus className="w-4 h-4 mr-1" />
                Boş Hayvan
              </Button>
              {kesim.animalGroups.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1 border rounded-md px-1">
                    {([1, 2, 3] as const).map(n => (
                      <Button
                        key={n}
                        variant={workspace.prefs.columnCount === n ? "default" : "ghost"}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => workspace.setColumnCount(n)}
                        title={`${n} Sütun`}
                      >
                        {n === 1 ? <Columns className="w-3.5 h-3.5" /> : n === 2 ? <Columns3 className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                      </Button>
                    ))}
                  </div>

                  <Button
                    variant={workspace.prefs.compactMode ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => workspace.setCompactMode(!workspace.prefs.compactMode)}
                    title="Kompakt Mod"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant={fullscreenMode ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setFullscreenMode(!fullscreenMode)}
                    title={fullscreenMode ? "Tam Ekrandan Çık (ESC)" : "Tam Ekran"}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </Button>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2" title="Sütun Ayarları">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3" align="start">
                      <p className="text-xs font-semibold mb-2">Görünür Sütunlar</p>
                      <div className="space-y-1">
                        {workspace.prefs.columnOrder.map(key => {
                          const col = ALL_GROUP_COLUMNS.find(c => c.key === key);
                          if (!col) return null;
                          const visible = !workspace.prefs.hiddenColumns.includes(key);
                          return (
                            <div
                              key={key}
                              className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted cursor-grab text-sm"
                              draggable
                              onDragStart={() => handleColumnDragStart(key)}
                              onDragOver={(e) => handleColumnDragOver(e, key)}
                              onDrop={() => handleColumnDrop(key)}
                              onDragEnd={handleColumnDragEnd}
                            >
                              <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <button
                                className="flex items-center gap-2 flex-1 text-left"
                                onClick={() => workspace.toggleColumn(key)}
                                disabled={col.alwaysVisible}
                              >
                                {col.alwaysVisible ? (
                                  <Lock className="w-3 h-3 text-muted-foreground" />
                                ) : visible ? (
                                  <Eye className="w-3 h-3 text-primary" />
                                ) : (
                                  <EyeOff className="w-3 h-3 text-muted-foreground" />
                                )}
                                <span className={!visible && !col.alwaysVisible ? "text-muted-foreground" : ""}>
                                  {col.label}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <div className="flex items-center gap-1 ml-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={collapseAll}
                      title="Tümünü Daralt"
                    >
                      <ChevronsDownUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={expandAll}
                      title="Tümünü Genişlet"
                    >
                      <ChevronsUpDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {kesim.animalGroups.length > 0 && (
              <div className="flex gap-2 items-center">
                <div className="flex items-center gap-1">
                  <Input
                    ref={jumpInputRef}
                    className="h-8 w-20 text-sm text-center cursor-pointer"
                    placeholder="No (Ctrl+G)"
                    readOnly
                    onClick={() => setJumpDialogOpen(true)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setJumpDialogOpen(true)}
                  >
                    Git
                  </Button>
                </div>
                {kesim.animalGroups.some(g => !g.donations.some(d => d.name.trim())) && (
                  <Button variant="outline" size="sm" onClick={cleanEmptyGroups} title="Boş Grupları Temizle">
                    <Trash2 className="w-4 h-4 mr-1" />
                    Boşları Temizle
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const found = checkGroupConflicts(kesim.animalGroups);
                    setConflicts(found);
                    setShowConflicts(true);
                  }}
                >
                  <Search className="w-4 h-4 mr-1" />
                  Çakışma Kontrol
                </Button>
                <Dialog open={groupFindDeleteOpen} onOpenChange={(open) => { setGroupFindDeleteOpen(open); if (!open) { setGroupFindDeleteValue(""); setGroupFindDeleteConfirm(false); } }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" title="Gruplarda Bul ve Sil">
                      <SearchX className="w-4 h-4 mr-1" />
                      Bul ve Sil
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Gruplarda Bul ve Sil</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Sütun Seç</label>
                        <Select value={groupFindDeleteColumn} onValueChange={(v: "name" | "description" | "donationType" | "vekalet" | "notes") => { setGroupFindDeleteColumn(v); setGroupFindDeleteValue(""); setGroupFindDeleteConfirm(false); }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="description">Vekaleti Veren</SelectItem>
                            <SelectItem value="name">Adına Kesilen</SelectItem>
                            <SelectItem value="donationType">Cinsi</SelectItem>
                            <SelectItem value="vekalet">Vekalet No</SelectItem>
                            <SelectItem value="notes">Notlar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Aranacak Değer</label>
                        <Input
                          placeholder={`${findDeleteColumnLabel[groupFindDeleteColumn]} içinde ara...`}
                          value={groupFindDeleteValue}
                          onChange={(e) => { setGroupFindDeleteValue(e.target.value); setGroupFindDeleteConfirm(false); }}
                        />
                      </div>
                      {groupFindDeleteValue.trim() && (() => {
                        const matches = getGroupFindDeleteMatches();
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {matches.length > 0
                                  ? `${matches.length} kayıt bulundu (gruplarda)`
                                  : "Gruplarda eşleşen kayıt bulunamadı"}
                              </span>
                            </div>
                            {matches.length > 0 && (
                              <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-muted/50 border-b">
                                      <th className="p-2 text-left font-medium">Vekaleti Veren</th>
                                      <th className="p-2 text-left font-medium">Adına Kesilen</th>
                                      <th className="p-2 text-left font-medium">Cinsi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {matches.slice(0, 50).map((d) => (
                                      <tr key={d.id} className="border-b last:border-0">
                                        <td className="p-2">{d.description || "—"}</td>
                                        <td className="p-2">{d.name || "—"}</td>
                                        <td className="p-2">{d.donationType || "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {matches.length > 50 && (
                                  <div className="p-2 text-xs text-muted-foreground text-center bg-muted/20">
                                    ... ve {matches.length - 50} kayıt daha
                                  </div>
                                )}
                              </div>
                            )}
                            {matches.length > 0 && !groupFindDeleteConfirm && (
                              <Button
                                variant="destructive"
                                className="w-full"
                                onClick={() => setGroupFindDeleteConfirm(true)}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                {matches.length} Kaydı Sil
                              </Button>
                            )}
                            {matches.length > 0 && groupFindDeleteConfirm && (
                              <div className="space-y-2 border border-destructive/50 rounded-lg p-3 bg-destructive/5">
                                <p className="text-sm font-medium text-destructive">
                                  {matches.length} bağışçı gruplardan ve listeden kalıcı olarak silinecek. Emin misiniz?
                                </p>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setGroupFindDeleteConfirm(false)}>
                                    İptal
                                  </Button>
                                  <Button variant="destructive" size="sm" className="flex-1" onClick={executeGroupFindDelete}>
                                    Evet, Sil
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </DialogContent>
                </Dialog>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" title="Toplu Kilitleme">
                      <Lock className="w-4 h-4 mr-1" />
                      Kilit
                      {kesim.animalGroups.filter(g => g.locked).length > 0 && (
                        <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                          {kesim.animalGroups.filter(g => g.locked).length}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="end">
                    <p className="text-xs font-semibold mb-2">Toplu Kilitleme</p>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={lockAllGroups}>
                          <Lock className="w-3 h-3 mr-1" />
                          Tümünü Kilitle
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={unlockAllGroups}>
                          <Unlock className="w-3 h-3 mr-1" />
                          Tümünü Aç
                        </Button>
                      </div>
                      <div className="border-t pt-2">
                        <p className="text-xs text-muted-foreground mb-2">
                          Hayvan numarası aralığı veya çoklu seçim girin (örn: 1-5 veya 3, 7, 12)
                        </p>
                        <div className="flex gap-2">
                          <Input
                            className="h-8 text-sm flex-1"
                            placeholder="1-5 veya 3, 7, 12"
                            value={rangeLockInput}
                            onChange={(e) => setRangeLockInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") applyRangeLock(true);
                            }}
                          />
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button variant="default" size="sm" className="flex-1" onClick={() => applyRangeLock(true)} disabled={!rangeLockInput.trim()}>
                            <Lock className="w-3 h-3 mr-1" />
                            Kilitle
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => applyRangeLock(false)} disabled={!rangeLockInput.trim()}>
                            <Unlock className="w-3 h-3 mr-1" />
                            Kilidi Aç
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {kesim.animalGroups.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-1 flex-1 min-w-[180px] max-w-xs">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 text-sm pl-8 pr-16"
                    placeholder="Gruplarda ara..."
                    value={groupSearchInput}
                    onChange={(e) => setGroupSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGroupSearch(); } }}
                  />
                  {(groupSearchInput || groupSearchQuery) && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      {groupSearchQuery.trim() && (
                        <>
                          <span className="text-xs text-muted-foreground mr-1">
                            {currentGroupMatches.length > 0
                              ? `${(groupSearchMatchIdx % currentGroupMatches.length) + 1}/${currentGroupMatches.length}`
                              : "0"}
                          </span>
                          <button
                            className="p-0.5 hover:bg-muted rounded"
                            onClick={() => setGroupSearchMatchIdx(prev => Math.max(0, prev - 1))}
                            disabled={currentGroupMatches.length === 0}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            className="p-0.5 hover:bg-muted rounded"
                            onClick={() => setGroupSearchMatchIdx(prev => prev + 1)}
                            disabled={currentGroupMatches.length === 0}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      <button
                        className="p-0.5 hover:bg-muted rounded"
                        onClick={handleGroupSearchClear}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" className="h-8 px-2" onClick={handleGroupSearch} title="Ara">
                  Ara
                </Button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => startFilterTransition(() => setColorTagFilter("all"))}
                  className={`text-xs px-2 py-0.5 rounded border ${colorTagFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >Tümü</button>
                <button
                  onClick={() => startFilterTransition(() => setColorTagFilter("green"))}
                  className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "green" ? "ring-2 ring-offset-1 ring-green-500" : ""}`}
                  style={{ backgroundColor: "#22c55e" }}
                  title="Yeşil"
                />
                <button
                  onClick={() => startFilterTransition(() => setColorTagFilter("orange"))}
                  className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "orange" ? "ring-2 ring-offset-1 ring-orange-500" : ""}`}
                  style={{ backgroundColor: "#f97316" }}
                  title="Turuncu"
                />
                <button
                  onClick={() => startFilterTransition(() => setColorTagFilter("red"))}
                  className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "red" ? "ring-2 ring-offset-1 ring-red-500" : ""}`}
                  style={{ backgroundColor: "#ef4444" }}
                  title="Kırmızı"
                />
                <button
                  onClick={() => startFilterTransition(() => setColorTagFilter(""))}
                  className={`w-5 h-5 rounded-full border-2 border-dashed ${colorTagFilter === "" ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                  title="Renksiz"
                />
              </div>

              <div className="flex items-center gap-1 border-l pl-2 ml-1">
                <Button
                  variant={showOnlyIncomplete ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => startFilterTransition(() => setShowOnlyIncomplete(!showOnlyIncomplete))}
                  title="Sadece eksik grupları göster"
                >
                  <Filter className="w-3 h-3 mr-1" />
                  Eksik
                </Button>
                <Button
                  variant={highlightIncomplete ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => startFilterTransition(() => setHighlightIncomplete(!highlightIncomplete))}
                  title="Eksik grupları vurgula"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Vurgula
                </Button>
              </div>
            </div>
          )}

          {minimapOpen && kesim.animalGroups.length > 0 && (
            <Card className="p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <MapIcon className="w-4 h-4" />
                  Genel Bakış
                </h3>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setMinimapOpen(false)}>✕</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {kesim.animalGroups.map((group) => {
                  const filled = group.donations.filter(d => d.name.trim() !== "").length;
                  const ratio = filled / 7;
                  let bg = "#ef4444";
                  if (ratio >= 1) bg = "#22c55e";
                  else if (ratio >= 0.5) bg = "#eab308";
                  else if (ratio > 0) bg = "#f97316";
                  return (
                    <button
                      key={group.id}
                      className="w-7 h-7 rounded text-[10px] font-bold text-white flex items-center justify-center transition-transform hover:scale-110 hover:shadow-md"
                      style={{ backgroundColor: bg }}
                      title={`Hayvan ${group.animalNo}: ${filled}/7 dolu`}
                      onClick={() => {
                        scrollToAnimalGroup(group.animalNo);
                      }}
                    >
                      {group.animalNo}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#22c55e"}} /> Dolu (7/7)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#eab308"}} /> Yarı dolu</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#f97316"}} /> Az dolu</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#ef4444"}} /> Boş</span>
              </div>
            </Card>
          )}

          {selectedGroupIds.size > 0 && (
            <div className="flex items-center gap-3 p-2 mb-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg flex-wrap">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {selectedGroupIds.size} grup seçildi
              </span>
              {selectedGroupIds.size >= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={mergeSelectedGroups}
                  disabled={kesim.animalGroups.filter(g => selectedGroupIds.has(g.id)).some(g => g.locked)}
                >
                  <Merge className="w-3 h-3 mr-1" />
                  Birleştir
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedGroupIds(new Set())}>
                Seçimi Kaldır
              </Button>
            </div>
          )}

          {selectedGroupDonations.size > 0 && (
            <div className="flex items-center gap-3 p-2 mb-3 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-lg flex-wrap">
              <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                {selectedGroupDonations.size} bağışçı seçildi
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={bulkRemoveFromGroups}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Gruptan Çıkar
              </Button>
              <div className="flex items-center gap-1">
                <Select
                  value={String(bulkMoveTargetGroup)}
                  onValueChange={(v) => setBulkMoveTargetGroup(parseInt(v))}
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue placeholder="Hedef grup..." />
                  </SelectTrigger>
                  <SelectContent>
                    {kesim.animalGroups.map((g, i) => (
                      <SelectItem key={g.id} value={String(i)}>
                        Hayvan {g.animalNo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => bulkMoveToGroup(bulkMoveTargetGroup)}
                  disabled={bulkMoveTargetGroup < 0}
                >
                  <MoveRight className="w-3 h-3 mr-1" />
                  Taşı
                </Button>
              </div>
              <Dialog open={bulkGroupEditOpen} onOpenChange={setBulkGroupEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Settings2 className="w-3 h-3 mr-1" />
                    Toplu Düzenle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{selectedGroupDonations.size} Bağışçıyı Toplu Düzenle</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Select value={bulkGroupEditField} onValueChange={(v: any) => setBulkGroupEditField(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="donationType">Cinsi</SelectItem>
                        <SelectItem value="notes">Notlar</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Yeni değer"
                      value={bulkGroupEditValue}
                      onChange={(e) => setBulkGroupEditValue(e.target.value)}
                    />
                    <Button onClick={bulkChangeGroupDonationType} className="w-full">
                      Uygula
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedGroupDonations(new Set())}>
                Seçimi Kaldır
              </Button>
            </div>
          )}

          {swapSelection && (() => {
            const selDonor = kesim.animalGroups[swapSelection.groupIdx]?.donations[swapSelection.donationIdx];
            return (
              <div className="flex items-center gap-3 p-2 mb-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
                <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-purple-800 dark:text-purple-200">
                  <strong>Takas modu:</strong> Hayvan {kesim.animalGroups[swapSelection.groupIdx]?.animalNo}, Sıra {swapSelection.donationIdx + 1}
                  {selDonor ? ` — ${selDonor.description || selDonor.name} (${selDonor.shareCount || 1} hisse)` : ""} seçildi.
                  Başka bir gruptaki bağışçıya tıklayın.
                </span>
                <Button variant="ghost" size="sm" onClick={cancelSwap}>
                  İptal
                </Button>
              </div>
            );
          })()}

          {showConflicts && (
            <Card className={`p-4 mb-4 ${conflicts.length > 0 ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${conflicts.length > 0 ? "text-amber-600" : "text-green-600"}`} />
                  <div>
                    {conflicts.length === 0 ? (
                      <p className="text-sm text-green-800 font-medium">Çakışma bulunamadı. Tüm vekaleti veren kişiler aynı hayvanda.</p>
                    ) : (
                      <>
                        <p className="text-sm text-amber-800 font-medium mb-2">
                          {conflicts.filter(c => !c.isExpected).length} kişi beklenmeyen şekilde farklı hayvanlara dağılmış:
                        </p>
                        <ul className="space-y-1">
                          {conflicts.filter(c => !c.isExpected).map((c, i) => (
                            <li key={i} className="text-sm text-amber-700 flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{c.description}</span>
                              <span className="text-xs">({c.totalShares} hisse) → Hayvan No: {c.animalNos.map((no, idx) => (
                                <span key={no}>
                                  {idx > 0 && ", "}
                                  <button
                                    className="underline font-semibold hover:text-amber-900 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      scrollToAnimalGroup(no);
                                    }}
                                  >
                                    {no}
                                  </button>
                                </span>
                              ))}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setPersonEditDesc(c.description)}
                              >
                                <UserCog className="w-3 h-3 mr-1" />
                                Düzenle
                              </Button>
                            </li>
                          ))}
                        </ul>
                        {conflicts.some(c => c.isExpected) && (
                          <div className="mt-3 pt-2 border-t border-amber-200">
                            <p className="text-xs text-amber-600 mb-1">7+ hisseli (normal dağılım):</p>
                            <ul className="space-y-0.5">
                              {conflicts.filter(c => c.isExpected).map((c, i) => (
                                <li key={i} className="text-xs text-amber-500 flex items-center gap-2">
                                  <span>{c.description}</span>
                                  <span>({c.totalShares} hisse) → Hayvan No: {c.animalNos.map((no, idx) => (
                                    <span key={no}>
                                      {idx > 0 && ", "}
                                      <button
                                        className="underline font-semibold hover:text-amber-700 cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          scrollToAnimalGroup(no);
                                        }}
                                      >
                                        {no}
                                      </button>
                                    </span>
                                  ))}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {conflicts.filter(c => !c.isExpected).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100"
                      onClick={openAutoResolve}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Otomatik Çöz
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowConflicts(false)}>×</Button>
                </div>
              </div>
            </Card>
          )}

          {kesim.animalGroups.length === 0 ? (
            <Card className="p-8 text-center">
              <Wand2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Bağışçı listesini doldurup "Otomatik Grupla" butonuna tıklayın
              </p>
            </Card>
          ) : (() => {
            const renderGroupCard = ({ group, groupIdx }: { group: typeof kesim.animalGroups[0]; groupIdx: number }) => (
              <AnimalGroupCard
                key={group.id}
                group={group}
                groupIdx={groupIdx}
                kesimName={kesim.name}
                kesimId={kesim.id}
                isCollapsed={collapsedGroups.has(group.id)}
                isSelected={selectedGroupIds.has(group.id)}
                compact={workspace.prefs.compactMode}
                visibleColumns={workspace.visibleColumns}
                totalGroupCount={kesim.animalGroups.length}
                photoCounts={photoCounts}
                teams={kesim.teams || []}
                basketItemIds={basketItemIds}
                selectedGroupDonations={selectedGroupDonations}
                swapSelection={swapSelection}
                highlightIncomplete={highlightIncomplete}
                dragItem={dragItem}
                dragOverGroup={dragOverGroup}
                dragOverItem={dragOverItem}
                groupSearchQuery={groupSearchQuery}
                onToggleCollapse={toggleGroupCollapse}
                onToggleSelect={toggleGroupSelect}
                onSetColorTag={handleSetGroupColorTag}
                onMoveUp={moveGroupUp}
                onMoveDown={moveGroupDown}
                onSplit={openSplitGroupDialog}
                onAddGroupToBasket={addGroupToBasket}
                onToggleLock={toggleGroupLock}
                onDelete={deleteAnimalGroup}
                onAssignTeam={handleAssignTeam}
                onViewPhotos={handleViewPhotos}
                onUpdateGroupDonation={updateGroupDonation}
                onHandleGroupCellTab={handleGroupCellTab}
                onToggleBasketItem={handleToggleBasketItem}
                onSwapSelect={handleSwapSelect}
                onRemoveFromGroup={enhancedRemoveFromGroup}
                onUpdateGroupNotes={updateGroupNotes}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onDragOverCard={handleDragOverCard}
                onDragLeaveCard={handleDragLeave}
                onToggleGroupDonationSelect={toggleGroupDonationSelect}
                onSelectAllGroupDonations={handleSelectAllGroupDonations}
                columnHeaderLabel={columnHeaderLabel}
                columnHeaderWidth={columnHeaderWidth}
              />
            );

            const gridClassName = `grid gap-4 ${
              effectiveColumnCount === 3 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" :
              effectiveColumnCount === 2 ? "grid-cols-1 md:grid-cols-2" :
              "grid-cols-1"
            }`;

            if (filteredGroupItems.length > 20) {
              const virtuosoProps = fullscreenMode && scrollContainerRef.current
                ? { customScrollParent: scrollContainerRef.current }
                : { useWindowScroll: true as const };
              return (
                <Virtuoso
                  ref={groupsVirtuosoRef}
                  {...virtuosoProps}
                  data={groupRows}
                  overscan={5}
                  defaultItemHeight={collapsedGroups.size > 0 ? 60 : 350}
                  initialScrollTop={groupsScrollTopRef.current}
                  onScroll={(e) => {
                    if (e && typeof (e as any).scrollTop === "number") {
                      groupsScrollTopRef.current = (e as any).scrollTop;
                    }
                  }}
                  itemContent={(_index, row) => (
                    <div className={`${gridClassName} pb-4`}>
                      {row.map(renderGroupCard)}
                    </div>
                  )}
                />
              );
            }

            return (
              <div className={gridClassName}>
                {filteredGroupItems.map(renderGroupCard)}
              </div>
            );
          })()}
        </div>
      </div>
    </div>

    );
  }
  