import React, { Profiler, useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { AnimalGroupCard } from "@/components/AnimalGroupCard";
import { ALL_GROUP_COLUMNS } from "@/lib/useWorkspacePreferences";
import type { ColorTag } from "@/lib/types";
import {
  AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown,
  ChevronsDownUp, ChevronsUpDown,
  Eye, EyeOff, Filter, GripVertical, LayoutGrid, Lock, MapIcon, Maximize2,
  Merge, Minimize2, MoreHorizontal, MoveRight, PanelLeftClose, PanelLeftOpen, Plus,
  Search, SearchX, Settings2, Trash2, Wand2, X,
} from "lucide-react";
import { useKesimAlaniContext } from "../KesimAlaniContext";
import { GroupMinimap } from "./GroupMinimap";
import { GroupConflictPanel } from "./GroupConflictPanel";
import { GroupFindDeleteDialog } from "../dialogs/GroupFindDeleteDialog";
import { GroupBulkLockPopover } from "./GroupBulkLockPopover";

const COLOR_TAGS: { key: ColorTag | "all"; label: string; bg?: string }[] = [
  { key: "all",    label: "Tümü" },
  { key: "green",  label: "Yeşil",    bg: "#22c55e" },
  { key: "orange", label: "Turuncu",  bg: "#f97316" },
  { key: "red",    label: "Kırmızı",  bg: "#ef4444" },
  { key: "",       label: "Renksiz" },
];

function ColorDot({ bg }: { bg?: string }) {
  if (!bg) return <span className="inline-block w-3 h-3 rounded-full border border-dashed border-muted-foreground/50" />;
  return <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: bg }} />;
}

export function GroupListPanel() {
  const ctx = useKesimAlaniContext();
  const groupsListBottomRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  const {
    kesim, addEmptyGroup, basketItemIds, bulkChangeGroupDonationType, bulkGroupEditField,
    bulkGroupEditOpen, bulkGroupEditValue, bulkMoveTargetGroup, bulkMoveToGroup,
    bulkRemoveFromGroups, cancelSwap, cleanEmptyGroups, collapseAll, collapsedGroups,
    colorTagFilter, columnHeaderLabel, columnHeaderWidth,
    currentGroupMatches, deleteAnimalGroup, donorListVisible, handleFlagDonation, handleUnflagDonation,
    dragItem, dragOverGroup, dragOverItem, effectiveColumnCount, enhancedRemoveFromGroup,
    expandAll, filteredGroupItems,
    fullscreenMode, groupCinsFilter,
    groupSearchMatchIdx, groupSearchQuery, groupsHeaderRef,
    handleAssignTeam, handleColumnDragEnd,
    handleColumnDragOver, handleColumnDragStart, handleColumnDrop,
    handleDragEnd, handleDragLeave, handleDragOver, handleDragOverCard,
    handleDragStart, handleDrop, handleGroupCellTab, handleSelectAllGroupDonations,
    groupCardDragState, handleGroupCardDragStart, handleGroupCardDragOver, handleGroupCardDrop, handleGroupCardDragEnd,
    handleSetGroupColorTag, handleSwapSelect, handleToggleBasketItem,
    handleViewPhotos, highlightIncomplete, isMobile, jumpInputRef,
    mergeSelectedGroups,
    openSplitGroupDialog, photoCounts,
    scrollToAnimalGroup, selectedGroupDonations,
    selectedGroupIds, setBulkGroupEditField, setBulkGroupEditOpen,
    setBulkGroupEditValue, setBulkMoveTargetGroup, setColorTagFilter, setConflicts,
    setDonorListVisible, setFullscreenMode, setGroupCinsFilter,
    setGroupSearchMatchIdx, setGroupSearchQuery, setHighlightIncomplete,
    setJumpDialogOpen, setPersonEditDesc,
    setSelectedGroupDonations, setSelectedGroupIds, setShowConflicts, setShowOnlyIncomplete,
    showOnlyIncomplete, startFilterTransition, swapSelection,
    uniqueGroupDonationTypes,
    toggleGroupCollapse, toggleGroupDonationSelect, toggleGroupLock, toggleGroupSelect,
    updateGroupDonation, updateGroupNotes, workspace, addGroupToBasket,
    addWholeAnimalToBasket, basketAnimalGroupIds,
    placeBasketItemInGroup,
    setGroupFindDeleteOpen,
    saveSingleGroupField,
    swapLabels,
  } = ctx;

  const [groupSearchInput, setGroupSearchInput] = useState("");
  const PAGE_SIZE = 50;
  const [visibleGroupCount, setVisibleGroupCount] = useState(PAGE_SIZE);
  const prevFilteredLengthRef = useRef(filteredGroupItems.length);

  useEffect(() => {
    if (prevFilteredLengthRef.current !== filteredGroupItems.length) {
      setVisibleGroupCount(PAGE_SIZE);
      prevFilteredLengthRef.current = filteredGroupItems.length;
    }
  }, [filteredGroupItems.length]);

  useEffect(() => {
    if (!groupsListBottomRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setAtBottom(entry.isIntersecting);
        if (entry.isIntersecting) {
          setVisibleGroupCount(prev => prev + PAGE_SIZE);
        }
      },
      { threshold: 0, rootMargin: "200px 0px" }
    );
    observer.observe(groupsListBottomRef.current);
    return () => observer.disconnect();
  }, []);

  const handleGroupSearch = useCallback(() => {
    setGroupSearchQuery(groupSearchInput);
    setGroupSearchMatchIdx(0);
  }, [groupSearchInput, setGroupSearchQuery, setGroupSearchMatchIdx]);

  const handleGroupSearchClear = useCallback(() => {
    setGroupSearchInput("");
    setGroupSearchQuery("");
    setGroupSearchMatchIdx(0);
  }, [setGroupSearchQuery, setGroupSearchMatchIdx]);

  const onRenderCallback: React.ProfilerOnRenderCallback = useCallback(
    (id, phase, actualDuration, baseDuration) => {
      if (import.meta.env.DEV && actualDuration > 16) {
        console.debug(`[Profiler] ${id} ${phase}: actual=${actualDuration.toFixed(1)}ms base=${baseDuration.toFixed(1)}ms`);
      }
    }, []
  );

  const renderGroupCard = useCallback(({ group, groupIdx }: { group: (typeof kesim)extends null ? never : NonNullable<typeof kesim>["animalGroups"][0]; groupIdx: number }) => {
    if (!kesim) return null;
    return (
      <AnimalGroupCard
        key={group.id} group={group} groupIdx={groupIdx} kesimName={kesim.name} kesimId={kesim.id}
        isCollapsed={collapsedGroups.has(group.id)} isSelected={selectedGroupIds.has(group.id)}
        compact={workspace.prefs.compactMode} visibleColumns={workspace.visibleColumns}
        totalGroupCount={kesim.animalGroups.length} photoCounts={photoCounts}
        teams={kesim.teams || []} basketItemIds={basketItemIds}
        selectedGroupDonations={selectedGroupDonations} swapSelection={swapSelection}
        highlightIncomplete={highlightIncomplete} dragItem={dragItem}
        dragOverGroup={dragOverGroup} dragOverItem={dragOverItem}
        groupSearchQuery={groupSearchQuery}
        onToggleCollapse={toggleGroupCollapse} onToggleSelect={toggleGroupSelect}
        onSetColorTag={handleSetGroupColorTag}
        onSplit={openSplitGroupDialog} onAddGroupToBasket={addGroupToBasket}
        onAddWholeAnimalToBasket={addWholeAnimalToBasket} basketAnimalGroupIds={basketAnimalGroupIds}
        onToggleLock={toggleGroupLock} onDelete={deleteAnimalGroup}
        onAssignTeam={handleAssignTeam} onViewPhotos={handleViewPhotos}
        onUpdateGroupDonation={updateGroupDonation} onHandleGroupCellTab={handleGroupCellTab}
        onToggleBasketItem={handleToggleBasketItem} onSwapSelect={handleSwapSelect}
        onRemoveFromGroup={enhancedRemoveFromGroup} onUpdateGroupNotes={updateGroupNotes}
        onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop}
        onDragEnd={handleDragEnd} onDragOverCard={handleDragOverCard} onDragLeaveCard={handleDragLeave}
        onToggleGroupDonationSelect={toggleGroupDonationSelect}
        onSelectAllGroupDonations={handleSelectAllGroupDonations}
        onBasketDrop={placeBasketItemInGroup}
        onFlagDonation={handleFlagDonation} onUnflagDonation={handleUnflagDonation}
        groupCardDragState={groupCardDragState}
        onGroupCardDragStart={handleGroupCardDragStart}
        onGroupCardDragOver={handleGroupCardDragOver}
        onGroupCardDrop={handleGroupCardDrop}
        onGroupCardDragEnd={handleGroupCardDragEnd}
        columnHeaderLabel={columnHeaderLabel} columnHeaderWidth={columnHeaderWidth}
        projectId={kesim.projectId ?? undefined}
        swapLabel={swapLabels?.get(group.id) ?? ""}
        onUpdateGroupFiyat={(gIdx, fiyat) => saveSingleGroupField(kesim.animalGroups[gIdx]?.id ?? "", { fiyat })}
      />
    );
  }, [
    kesim, collapsedGroups, selectedGroupIds, workspace.prefs.compactMode, workspace.visibleColumns,
    photoCounts, basketItemIds, selectedGroupDonations, swapSelection, highlightIncomplete,
    dragItem, dragOverGroup, dragOverItem, groupSearchQuery,
    toggleGroupCollapse, toggleGroupSelect, handleSetGroupColorTag,
    openSplitGroupDialog, addGroupToBasket, addWholeAnimalToBasket, basketAnimalGroupIds, toggleGroupLock, deleteAnimalGroup,
    handleAssignTeam, handleViewPhotos, updateGroupDonation, handleGroupCellTab,
    handleToggleBasketItem, handleSwapSelect, enhancedRemoveFromGroup, updateGroupNotes,
    handleDragStart, handleDragOver, handleDrop, handleDragEnd, handleDragOverCard, handleDragLeave,
    toggleGroupDonationSelect, handleSelectAllGroupDonations, placeBasketItemInGroup, handleFlagDonation, handleUnflagDonation,
    groupCardDragState, handleGroupCardDragStart, handleGroupCardDragOver, handleGroupCardDrop, handleGroupCardDragEnd,
    columnHeaderLabel, columnHeaderWidth,
    saveSingleGroupField, swapLabels,
  ]);

  if (!kesim) return null;

  const gridClassName = `grid gap-4 ${
    effectiveColumnCount === 3 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" :
    effectiveColumnCount === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
  }`;

  const hasGroups = kesim.animalGroups.length > 0;
  const lockedCount = kesim.animalGroups.filter(g => g.locked).length;

  const activeColorTag = COLOR_TAGS.find(c => c.key === colorTagFilter) ?? COLOR_TAGS[0];
  const colorTagActive = colorTagFilter !== "all";

  return (
    <Profiler id="GroupListPanel" onRender={onRenderCallback}>

      {/* ── Sticky header ── */}
      <div
        ref={groupsHeaderRef}
        className="sticky top-0 z-20 bg-background/95 -mt-2 pt-2 pb-3 border-b border-border mb-3"
        style={{ backdropFilter: "blur(8px)" }}
      >
        {/* ── ROW 1: Title + primary action + overflow menu ── */}
        <div className="flex items-center justify-between gap-2 mb-2.5">

          {/* Left: panel toggle + title */}
          <div className="flex items-center gap-2 min-w-0">
            {!fullscreenMode && !isMobile && (
              <Button
                variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg flex-shrink-0"
                onClick={() => setDonorListVisible(!donorListVisible)}
                title={donorListVisible ? "Bağışçı Listesini Gizle" : "Bağışçı Listesini Göster"}
              >
                {donorListVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </Button>
            )}
            <h2 className="text-sm font-semibold whitespace-nowrap">
              Hayvan Grupları
              {hasGroups && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">
                  ({kesim.animalGroups.length})
                </span>
              )}
            </h2>
          </div>

          {/* Right: + Yeni Grup + ⋯ menu */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              className="h-9 px-3 rounded-lg text-xs font-medium gap-1.5"
              onClick={addEmptyGroup}
            >
              <Plus className="w-3.5 h-3.5" />
              Yeni Grup
            </Button>

            {hasGroups && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Görünüm</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => ctx.setMinimapOpen(!ctx.minimapOpen)}>
                    <MapIcon className="w-4 h-4" />
                    {ctx.minimapOpen ? "Genel Bakışı Gizle" : "Genel Bakış"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Sütun Sayısı</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={String(workspace.prefs.columnCount)}
                    onValueChange={(v) => workspace.setColumnCount(Number(v) as 1 | 2 | 3)}
                  >
                    <DropdownMenuRadioItem value="1">1 Sütun</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="2">2 Sütun</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="3">3 Sütun</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={workspace.prefs.compactMode}
                    onCheckedChange={() => workspace.setCompactMode(!workspace.prefs.compactMode)}
                  >
                    <Minimize2 className="w-4 h-4" />
                    Kompakt Mod
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={fullscreenMode}
                    onCheckedChange={() => setFullscreenMode(!fullscreenMode)}
                  >
                    <Maximize2 className="w-4 h-4" />
                    Tam Ekran
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuItem onSelect={() => setColumnSettingsOpen(true)}>
                    <Settings2 className="w-4 h-4" />
                    Sütun Ayarları
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={collapseAll}>
                    <ChevronsDownUp className="w-4 h-4" />
                    Tümünü Daralt
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={expandAll}>
                    <ChevronsUpDown className="w-4 h-4" />
                    Tümünü Genişlet
                  </DropdownMenuItem>
                  {kesim.animalGroups.some(g => !g.donations.some(d => d.name.trim())) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={cleanEmptyGroups} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-4 h-4" />
                        Boşları Temizle
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {hasGroups && (
          <>
            {/* ── ROW 2: Search + Araçlar ── */}
            <div className="flex items-center gap-2 mb-2.5">
              {/* Search input */}
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  className="h-9 text-sm pl-8 pr-16 rounded-lg"
                  placeholder="Gruplarda ara..."
                  value={groupSearchInput}
                  onChange={(e) => setGroupSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGroupSearch(); } }}
                />
                {(groupSearchInput || groupSearchQuery) && (
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {groupSearchQuery.trim() && (
                      <>
                        <span className="text-xs text-muted-foreground mr-0.5 tabular-nums">
                          {currentGroupMatches.length > 0
                            ? `${(groupSearchMatchIdx % currentGroupMatches.length) + 1}/${currentGroupMatches.length}`
                            : "0"}
                        </span>
                        <button className="p-0.5 hover:bg-muted rounded" onClick={() => setGroupSearchMatchIdx(prev => Math.max(0, prev - 1))} disabled={currentGroupMatches.length === 0}><ArrowUp className="w-3 h-3" /></button>
                        <button className="p-0.5 hover:bg-muted rounded" onClick={() => setGroupSearchMatchIdx(prev => prev + 1)} disabled={currentGroupMatches.length === 0}><ArrowDown className="w-3 h-3" /></button>
                      </>
                    )}
                    <button className="p-0.5 hover:bg-muted rounded" onClick={handleGroupSearchClear}><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>

              <Button
                variant="outline" size="sm"
                className="h-9 px-3 rounded-lg text-xs flex-shrink-0"
                onClick={handleGroupSearch}
              >
                Ara
              </Button>

              {/* Araçlar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline" size="sm"
                    className="h-9 px-3 rounded-lg text-xs flex-shrink-0 gap-1"
                  >
                    Araçlar <ChevronDown className="w-3 h-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setJumpDialogOpen(true)}>
                    <MoveRight className="w-4 h-4" />
                    Git
                    <span className="ml-auto text-xs text-muted-foreground">Ctrl+G</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    ctx.runCheckConflicts(kesim.animalGroups)
                      .then(found => { setConflicts(found); setShowConflicts(true); })
                      .catch(() => {});
                  }}>
                    <Search className="w-4 h-4" />
                    Çakışma Kontrol
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setGroupFindDeleteOpen(true)}>
                    <SearchX className="w-4 h-4" />
                    Bul ve Sil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLockDialogOpen(true)}>
                    <Lock className="w-4 h-4" />
                    Kilitle
                    {lockedCount > 0 && (
                      <span className="ml-auto bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                        {lockedCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* ── ROW 3: Filters ── */}
            <div className="flex items-center gap-2 flex-wrap">

              {/* Cins segmented control */}
              {uniqueGroupDonationTypes.length > 0 && (
                <div className="flex items-center rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => startFilterTransition(() => setGroupCinsFilter(new Set()))}
                    className={`h-9 px-3 text-xs font-medium transition-colors ${
                      groupCinsFilter.size === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >Tümü</button>
                  {uniqueGroupDonationTypes.map((t, i) => {
                    const isActive = groupCinsFilter.has(t);
                    return (
                      <button
                        key={t}
                        onClick={() => startFilterTransition(() => {
                          setGroupCinsFilter(prev => {
                            const next = new Set(prev);
                            if (next.has(t)) next.delete(t); else next.add(t);
                            return next;
                          });
                        })}
                        className={`h-9 px-3 text-xs font-medium border-l border-border transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >{t}</button>
                    );
                  })}
                </div>
              )}

              {/* Durum (color tag) dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={colorTagActive ? "default" : "outline"}
                    size="sm"
                    className="h-9 px-3 rounded-lg text-xs gap-1.5"
                  >
                    {activeColorTag.bg
                      ? <ColorDot bg={activeColorTag.bg} />
                      : <Filter className="w-3 h-3" />}
                    Durum: {activeColorTag.label}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Renk Etiketi</DropdownMenuLabel>
                  {COLOR_TAGS.map(tag => (
                    <DropdownMenuItem
                      key={tag.key === "" ? "__none" : tag.key}
                      onClick={() => startFilterTransition(() => setColorTagFilter(tag.key === "all" ? "all" : tag.key as ColorTag))}
                      className={colorTagFilter === tag.key ? "bg-accent" : ""}
                    >
                      <ColorDot bg={tag.bg} />
                      {tag.label}
                      {colorTagFilter === tag.key && <span className="ml-auto">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Eksik chip toggle */}
              <button
                onClick={() => startFilterTransition(() => setShowOnlyIncomplete(!showOnlyIncomplete))}
                className={`h-9 px-3 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  showOnlyIncomplete
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                title="Sadece eksik grupları göster"
              >
                <Filter className="w-3 h-3" />
                Eksik
              </button>

              {/* Vurgula chip toggle */}
              <button
                onClick={() => startFilterTransition(() => setHighlightIncomplete(!highlightIncomplete))}
                className={`h-9 px-3 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  highlightIncomplete
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                title="Eksik grupları vurgula"
              >
                <AlertTriangle className="w-3 h-3" />
                Vurgula
              </button>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      <GroupFindDeleteDialog />
      <GroupBulkLockPopover open={lockDialogOpen} onOpenChange={setLockDialogOpen} />

      {/* Column settings popover (opened from ⋯ menu) */}
      <Dialog open={columnSettingsOpen} onOpenChange={setColumnSettingsOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Görünür Sütunlar</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 pt-1">
            {workspace.prefs.columnOrder.map(key => {
              const col = ALL_GROUP_COLUMNS.find(c => c.key === key);
              if (!col) return null;
              const visible = !workspace.prefs.hiddenColumns.includes(key);
              return (
                <div key={key} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-grab text-sm" draggable onDragStart={() => handleColumnDragStart(key)} onDragOver={(e) => handleColumnDragOver(e, key)} onDrop={() => handleColumnDrop(key)} onDragEnd={handleColumnDragEnd}>
                  <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <button className="flex items-center gap-2 flex-1 text-left" onClick={() => workspace.toggleColumn(key)} disabled={col.alwaysVisible}>
                    {col.alwaysVisible ? <Lock className="w-3 h-3 text-muted-foreground" /> : visible ? <Eye className="w-3 h-3 text-primary" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                    <span className={!visible && !col.alwaysVisible ? "text-muted-foreground" : ""}>{col.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <GroupMinimap />

      {/* Selected groups action bar */}
      {selectedGroupIds.size > 0 && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 flex-wrap">
          <span className="text-sm font-medium">{selectedGroupIds.size} grup seçildi</span>
          <div className="h-3.5 w-px bg-border/60" />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={mergeSelectedGroups} disabled={selectedGroupIds.size < 2}>
            <Merge className="w-3 h-3 mr-1" />Birleştir
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={bulkRemoveFromGroups}>
            <Trash2 className="w-3 h-3 mr-1" />Bağışçıları Çıkar
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => setSelectedGroupIds(new Set())}>
            <X className="w-3 h-3 mr-1" />Seçimi Kaldır
          </Button>
        </div>
      )}

      {/* Selected group donations action bar */}
      {selectedGroupDonations.size > 0 && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 flex-wrap">
          <span className="text-sm font-medium">{selectedGroupDonations.size} bağışçı seçildi</span>
          <div className="h-3.5 w-px bg-border/60" />
          <div className="flex items-center gap-1">
            <Select value={bulkMoveTargetGroup < 0 ? "" : String(bulkMoveTargetGroup)} onValueChange={(v) => setBulkMoveTargetGroup(parseInt(v))}>
              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Hedef grup..." /></SelectTrigger>
              <SelectContent>{kesim.animalGroups.map((g, gi) => (<SelectItem key={g.id} value={String(gi)}>Hayvan {g.animalNo}</SelectItem>))}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => bulkMoveToGroup(bulkMoveTargetGroup)} disabled={bulkMoveTargetGroup < 0}>
              <MoveRight className="w-3 h-3 mr-1" />Taşı
            </Button>
          </div>
          <Dialog open={bulkGroupEditOpen} onOpenChange={setBulkGroupEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs"><Settings2 className="w-3 h-3 mr-1" />Toplu Düzenle</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{selectedGroupDonations.size} Bağışçıyı Toplu Düzenle</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <Select value={bulkGroupEditField} onValueChange={(v: "donationType" | "notes") => setBulkGroupEditField(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="donationType">Cinsi</SelectItem>
                    <SelectItem value="notes">Notlar</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Yeni değer" value={bulkGroupEditValue} onChange={(e) => setBulkGroupEditValue(e.target.value)} />
                <Button onClick={bulkChangeGroupDonationType} className="w-full">Uygula</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => setSelectedGroupDonations(new Set())}>
            <X className="w-3 h-3 mr-1" />Seçimi Kaldır
          </Button>
        </div>
      )}

      {/* Swap mode banner */}
      {swapSelection && (() => {
        const selDonor = kesim.animalGroups[swapSelection.groupIdx]?.donations[swapSelection.donationIdx];
        return (
          <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 rounded-lg">
            <ArrowLeftRight className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <span className="text-sm text-purple-800 dark:text-purple-200 flex-1">
              <strong>Takas modu:</strong> Hayvan {kesim.animalGroups[swapSelection.groupIdx]?.animalNo}, Sıra {swapSelection.donationIdx + 1}
              {selDonor ? ` — ${selDonor.description || selDonor.name} (${selDonor.shareCount || 1} hisse)` : ""} seçildi. Başka bir gruptaki bağışçıya tıklayın.
            </span>
            <Button variant="ghost" size="sm" onClick={cancelSwap}>İptal</Button>
          </div>
        );
      })()}

      <GroupConflictPanel />

      {/* Group list */}
      {kesim.animalGroups.length === 0 ? (
        <Card className="p-8 text-center">
          <Wand2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Bağışçı listesini doldurup "Otomatik Grupla" butonuna tıklayın</p>
        </Card>
      ) : (() => {
        const visibleItems = filteredGroupItems.slice(0, visibleGroupCount);
        const visibleRows: { group: NonNullable<typeof kesim>["animalGroups"][0]; groupIdx: number }[][] = [];
        for (let i = 0; i < visibleItems.length; i += effectiveColumnCount) {
          visibleRows.push(visibleItems.slice(i, i + effectiveColumnCount));
        }
        return (
          <>
            {visibleRows.map((row, rowIdx) => (
              <div key={rowIdx} className={`${gridClassName} pb-4`}>
                {row.map(renderGroupCard)}
              </div>
            ))}
            <div ref={groupsListBottomRef} />
          </>
        );
      })()}
    </Profiler>
  );
}
