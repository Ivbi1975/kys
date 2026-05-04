import React, { Profiler, useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AnimalGroupCard } from "@/components/AnimalGroupCard";
import type { ConflictInfo } from "@/lib/grouping";
import { ALL_GROUP_COLUMNS, type ColumnKey } from "@/lib/useWorkspacePreferences";
import {
  AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown,
  ChevronsDownUp, ChevronsUpDown,
  Eye, EyeOff, Filter, GripVertical, LayoutGrid, Lock, MapIcon, Maximize2,
  Merge, Minimize2, MoveRight, PanelLeftClose, PanelLeftOpen, Plus,
  Search, Settings2, ShoppingBag, Trash2, Unlock, Wand2, X,
} from "lucide-react";
import { useKesimAlaniContext } from "../KesimAlaniContext";
import { GroupMinimap } from "./GroupMinimap";
import { GroupConflictPanel } from "./GroupConflictPanel";
import { GroupFindDeleteDialog } from "../dialogs/GroupFindDeleteDialog";
import { GroupBulkLockPopover } from "./GroupBulkLockPopover";
import type { ColorTag } from "@/lib/types";

export function GroupListPanel() {
  const ctx = useKesimAlaniContext();
  const groupsListBottomRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);

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
    handleSetGroupColorTag, handleSwapSelect, handleToggleBasketItem,
    handleViewPhotos, highlightIncomplete, isMobile, jumpInputRef,
    mergeSelectedGroups, moveGroupDown, moveGroupUp,
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
  } = ctx;

  const [groupSearchInput, setGroupSearchInput] = useState("");
  const PAGE_SIZE = 5;
  const [visibleGroupCount, setVisibleGroupCount] = useState(PAGE_SIZE);
  const [allShown, setAllShown] = useState(false);
  const prevFilteredLengthRef = useRef(filteredGroupItems.length);

  useEffect(() => {
    if (prevFilteredLengthRef.current !== filteredGroupItems.length) {
      setVisibleGroupCount(PAGE_SIZE);
      setAllShown(false);
      prevFilteredLengthRef.current = filteredGroupItems.length;
    }
  }, [filteredGroupItems.length]);

  useEffect(() => {
    if (!allShown || !groupsListBottomRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setAtBottom(entry.isIntersecting),
      { threshold: 0, rootMargin: "80px 0px" }
    );
    observer.observe(groupsListBottomRef.current);
    return () => observer.disconnect();
  }, [allShown]);

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
        onSetColorTag={handleSetGroupColorTag} onMoveUp={moveGroupUp} onMoveDown={moveGroupDown}
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
        columnHeaderLabel={columnHeaderLabel} columnHeaderWidth={columnHeaderWidth}
      />
    );
  }, [
    kesim, collapsedGroups, selectedGroupIds, workspace.prefs.compactMode, workspace.visibleColumns,
    photoCounts, basketItemIds, selectedGroupDonations, swapSelection, highlightIncomplete,
    dragItem, dragOverGroup, dragOverItem, groupSearchQuery,
    toggleGroupCollapse, toggleGroupSelect, handleSetGroupColorTag, moveGroupUp, moveGroupDown,
    openSplitGroupDialog, addGroupToBasket, addWholeAnimalToBasket, basketAnimalGroupIds, toggleGroupLock, deleteAnimalGroup,
    handleAssignTeam, handleViewPhotos, updateGroupDonation, handleGroupCellTab,
    handleToggleBasketItem, handleSwapSelect, enhancedRemoveFromGroup, updateGroupNotes,
    handleDragStart, handleDragOver, handleDrop, handleDragEnd, handleDragOverCard, handleDragLeave,
    toggleGroupDonationSelect, handleSelectAllGroupDonations, placeBasketItemInGroup, handleFlagDonation, handleUnflagDonation, columnHeaderLabel, columnHeaderWidth,
  ]);

  if (!kesim) return null;

  const gridClassName = `grid gap-4 ${
    effectiveColumnCount === 3 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" :
    effectiveColumnCount === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
  }`;

  const hasGroups = kesim.animalGroups.length > 0;

  return (
    <Profiler id="GroupListPanel" onRender={onRenderCallback}>
      {/* ── Main Header ── */}
      <div
        ref={groupsHeaderRef}
        className="sticky top-0 z-20 bg-background/95 -mt-2 pt-2 pb-3 border-b border-border/60"
        style={{ backdropFilter: "blur(8px)" }}
      >
        {/* Row 1: title + primary controls */}
        <div className="flex items-center gap-2 mb-2">
          {!fullscreenMode && !isMobile && (
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground flex-shrink-0"
              onClick={() => setDonorListVisible(!donorListVisible)}
              title={donorListVisible ? "Bağışçı Listesini Gizle" : "Bağışçı Listesini Göster"}
              aria-label={donorListVisible ? "Bağışçı Listesini Gizle" : "Bağışçı Listesini Göster"}
            >
              {donorListVisible ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
            </Button>
          )}

          <h2 className="text-sm font-semibold text-foreground whitespace-nowrap">
            Hayvan Grupları
            <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-normal tabular-nums">
              {kesim.animalGroups.length}
            </span>
          </h2>

          {hasGroups && (
            <>
              {/* View controls group */}
              <div className="flex items-center gap-0.5 ml-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={addEmptyGroup} title="Boş Grup Ekle" aria-label="Boş Grup Ekle">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
                <Button variant={ctx.minimapOpen ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => ctx.setMinimapOpen(!ctx.minimapOpen)} title="Genel Bakış" aria-label="Genel Bakış">
                  <MapIcon className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Separator */}
              <div className="w-px h-4 bg-border mx-0.5 flex-shrink-0" />

              {/* Layout controls group */}
              <div className="flex items-center gap-0.5">
                <Select value={String(workspace.prefs.columnCount)} onValueChange={(v) => workspace.setColumnCount(Number(v) as 1 | 2 | 3)}>
                  <SelectTrigger className="h-7 w-[68px] text-xs gap-1 px-2" aria-label="Sütun sayısı">
                    <LayoutGrid className="w-3 h-3 flex-shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Sütun</SelectItem>
                    <SelectItem value="2">2 Sütun</SelectItem>
                    <SelectItem value="3">3 Sütun</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={workspace.prefs.compactMode ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => workspace.setCompactMode(!workspace.prefs.compactMode)}
                  title="Kompakt Mod" aria-label="Kompakt Mod" aria-pressed={workspace.prefs.compactMode}
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant={fullscreenMode ? "secondary" : "ghost"}
                  size="sm" className="h-7 w-7 p-0"
                  onClick={() => setFullscreenMode(!fullscreenMode)}
                  title={fullscreenMode ? "Tam Ekrandan Çık (ESC)" : "Tam Ekran"}
                  aria-label={fullscreenMode ? "Tam Ekrandan Çık" : "Tam Ekran"}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Sütun Ayarları" aria-label="Sütun Ayarları">
                      <Settings2 className="w-3.5 h-3.5" />
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
                          <div key={key} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted cursor-grab text-sm" draggable onDragStart={() => handleColumnDragStart(key)} onDragOver={(e) => handleColumnDragOver(e, key)} onDrop={() => handleColumnDrop(key)} onDragEnd={handleColumnDragEnd}>
                            <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <button className="flex items-center gap-2 flex-1 text-left" onClick={() => workspace.toggleColumn(key)} disabled={col.alwaysVisible}>
                              {col.alwaysVisible ? <Lock className="w-3 h-3 text-muted-foreground" /> : visible ? <Eye className="w-3 h-3 text-primary" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                              <span className={!visible && !col.alwaysVisible ? "text-muted-foreground" : ""}>{col.label}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Separator */}
              <div className="w-px h-4 bg-border mx-0.5 flex-shrink-0" />

              {/* Collapse/Expand */}
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={collapseAll} title="Tümünü Daralt" aria-label="Tümünü Daralt">
                  <ChevronsDownUp className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={expandAll} title="Tümünü Genişlet" aria-label="Tümünü Genişlet">
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Right-side actions */}
              <div className="flex items-center gap-1.5 ml-auto">
                <Input
                  ref={jumpInputRef}
                  className="h-7 w-24 text-xs text-center cursor-pointer"
                  placeholder="No (Ctrl+G)"
                  readOnly
                  onClick={() => setJumpDialogOpen(true)}
                />
                <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setJumpDialogOpen(true)}>
                  Git
                </Button>

                <div className="w-px h-4 bg-border mx-0.5 flex-shrink-0" />

                <Button
                  variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { ctx.runCheckConflicts(kesim.animalGroups).then(found => { setConflicts(found); setShowConflicts(true); }).catch(() => {}); }}
                  title="Çakışma Kontrol"
                >
                  <Search className="w-3.5 h-3.5 mr-1" />
                  Çakışma
                </Button>
                <GroupFindDeleteDialog />
                <GroupBulkLockPopover />
                {kesim.animalGroups.some(g => !g.donations.some(d => d.name.trim())) && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={cleanEmptyGroups} title="Boş Grupları Temizle">
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Temizle
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Row 2: filter bar */}
        {hasGroups && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            {/* Search */}
            <div className="flex items-center gap-1 flex-1 min-w-[160px] max-w-xs">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  className="h-7 text-xs pl-7 pr-14"
                  placeholder="Gruplarda ara…"
                  value={groupSearchInput}
                  onChange={(e) => setGroupSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGroupSearch(); } }}
                />
                {(groupSearchInput || groupSearchQuery) && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {groupSearchQuery.trim() && (
                      <>
                        <span className="text-[10px] text-muted-foreground tabular-nums mr-0.5">
                          {currentGroupMatches.length > 0 ? `${(groupSearchMatchIdx % currentGroupMatches.length) + 1}/${currentGroupMatches.length}` : "0"}
                        </span>
                        <button className="p-0.5 hover:bg-muted rounded" onClick={() => setGroupSearchMatchIdx(prev => Math.max(0, prev - 1))} disabled={currentGroupMatches.length === 0}><ArrowUp className="w-3 h-3" /></button>
                        <button className="p-0.5 hover:bg-muted rounded" onClick={() => setGroupSearchMatchIdx(prev => prev + 1)} disabled={currentGroupMatches.length === 0}><ArrowDown className="w-3 h-3" /></button>
                      </>
                    )}
                    <button className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" onClick={handleGroupSearchClear}><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-shrink-0" onClick={handleGroupSearch}>Ara</Button>
            </div>

            {/* Color tag filters */}
            <div className="flex items-center gap-1 bg-muted/40 rounded-md px-2 py-1">
              <button
                onClick={() => startFilterTransition(() => setColorTagFilter("all"))}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${colorTagFilter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >Tümü</button>
              {(
                [
                  { key: "green"  as ColorTag, color: "#22c55e", label: "Yeşil" },
                  { key: "orange" as ColorTag, color: "#f97316", label: "Turuncu" },
                  { key: "red"    as ColorTag, color: "#ef4444", label: "Kırmızı" },
                  { key: ""       as ColorTag, color: "",        label: "Renksiz" },
                ] as { key: ColorTag; color: string; label: string }[]
              ).map(({ key, color, label }) => (
                <button
                  key={key === "" ? "__none__" : key}
                  onClick={() => startFilterTransition(() => setColorTagFilter(key))}
                  className={`rounded-full border transition-all ${colorTagFilter === key ? "ring-2 ring-offset-1 ring-primary scale-110" : "opacity-70 hover:opacity-100 hover:scale-105"} ${!color ? "border-dashed bg-muted" : "border-transparent"}`}
                  style={{ backgroundColor: color || undefined, width: 18, height: 18 }}
                  title={label}
                  aria-label={label}
                  aria-pressed={colorTagFilter === key}
                />
              ))}
            </div>

            {/* Separator */}
            <div className="w-px h-4 bg-border flex-shrink-0" />

            {/* Filter toggles */}
            <div className="flex items-center gap-1">
              <Button
                variant={showOnlyIncomplete ? "secondary" : "ghost"}
                size="sm" className="h-7 px-2.5 text-xs"
                onClick={() => startFilterTransition(() => setShowOnlyIncomplete(!showOnlyIncomplete))}
                title="Sadece eksik grupları göster"
              >
                <Filter className="w-3 h-3 mr-1" />Eksik
              </Button>
              <Button
                variant={highlightIncomplete ? "secondary" : "ghost"}
                size="sm" className="h-7 px-2.5 text-xs"
                onClick={() => startFilterTransition(() => setHighlightIncomplete(!highlightIncomplete))}
                title="Eksik grupları vurgula"
              >
                <AlertTriangle className="w-3 h-3 mr-1" />Vurgula
              </Button>
            </div>

            {/* Cins (type) filters */}
            {uniqueGroupDonationTypes.length > 0 && (
              <>
                <div className="w-px h-4 bg-border flex-shrink-0" />
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[11px] text-muted-foreground font-medium">Cins:</span>
                  <button
                    onClick={() => startFilterTransition(() => setGroupCinsFilter(new Set()))}
                    className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${groupCinsFilter.size === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >Tümü</button>
                  {uniqueGroupDonationTypes.map(t => {
                    const isActive = groupCinsFilter.has(t);
                    return (
                      <button
                        key={t}
                        onClick={() => startFilterTransition(() => {
                          setGroupCinsFilter(prev => {
                            const next = new Set(prev);
                            if (next.has(t)) next.delete(t);
                            else next.add(t);
                            return next;
                          });
                        })}
                        className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${isActive ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      >{t}</button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <GroupMinimap />

      {/* Selected group actions */}
      {selectedGroupIds.size > 0 && (
        <div className="my-3 flex items-center gap-2 px-3 py-2 bg-primary/8 border border-primary/20 rounded-lg flex-wrap">
          <span className="text-xs font-semibold text-primary">{selectedGroupIds.size} grup seçildi</span>
          <div className="w-px h-3.5 bg-border" />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={mergeSelectedGroups} disabled={selectedGroupIds.size < 2}>
            <Merge className="w-3 h-3 mr-1" />Birleştir
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={bulkRemoveFromGroups}>
            <Trash2 className="w-3 h-3 mr-1" />Bağışçıları Çıkar
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto text-muted-foreground" onClick={() => setSelectedGroupIds(new Set())}>
            <X className="w-3 h-3 mr-1" />Seçimi Kaldır
          </Button>
        </div>
      )}

      {/* Selected group donations actions */}
      {selectedGroupDonations.size > 0 && (
        <div className="my-3 flex items-center gap-2 px-3 py-2 bg-primary/8 border border-primary/20 rounded-lg flex-wrap">
          <span className="text-xs font-semibold text-primary">{selectedGroupDonations.size} bağışçı seçildi</span>
          <div className="w-px h-3.5 bg-border" />
          <div className="flex items-center gap-1">
            <Select value={bulkMoveTargetGroup < 0 ? "" : String(bulkMoveTargetGroup)} onValueChange={(v) => setBulkMoveTargetGroup(parseInt(v))}>
              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Hedef grup…" /></SelectTrigger>
              <SelectContent>{kesim.animalGroups.map((g, gi) => (<SelectItem key={g.id} value={String(gi)}>Hayvan {g.animalNo}</SelectItem>))}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => bulkMoveToGroup(bulkMoveTargetGroup)} disabled={bulkMoveTargetGroup < 0}>
              <MoveRight className="w-3 h-3 mr-1" />Taşı
            </Button>
          </div>
          <Dialog open={bulkGroupEditOpen} onOpenChange={setBulkGroupEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Settings2 className="w-3 h-3 mr-1" />Toplu Düzenle
              </Button>
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
          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto text-muted-foreground" onClick={() => setSelectedGroupDonations(new Set())}>
            <X className="w-3 h-3 mr-1" />Seçimi Kaldır
          </Button>
        </div>
      )}

      {/* Swap mode banner */}
      {swapSelection && (() => {
        const selDonor = kesim.animalGroups[swapSelection.groupIdx]?.donations[swapSelection.donationIdx];
        return (
          <div className="flex items-center gap-3 px-3 py-2 my-3 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 rounded-lg">
            <ArrowLeftRight className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <p className="text-xs text-purple-800 dark:text-purple-200 flex-1">
              <strong>Takas modu:</strong> Hayvan {kesim.animalGroups[swapSelection.groupIdx]?.animalNo}, Sıra {swapSelection.donationIdx + 1}
              {selDonor ? ` — ${selDonor.description || selDonor.name} (${selDonor.shareCount || 1} hisse)` : ""} seçildi. Başka bir gruptaki bağışçıya tıklayın.
            </p>
            <Button variant="ghost" size="sm" className="h-7 text-xs flex-shrink-0" onClick={cancelSwap}>İptal</Button>
          </div>
        );
      })()}

      <GroupConflictPanel />

      {/* Group list */}
      {kesim.animalGroups.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Wand2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Bağışçı listesini doldurup "Otomatik Grupla" butonuna tıklayın</p>
        </Card>
      ) : (() => {
        const visibleItems = filteredGroupItems.slice(0, visibleGroupCount);
        const visibleRows: { group: NonNullable<typeof kesim>["animalGroups"][0]; groupIdx: number }[][] = [];
        for (let i = 0; i < visibleItems.length; i += effectiveColumnCount) {
          visibleRows.push(visibleItems.slice(i, i + effectiveColumnCount));
        }
        const hasMore = filteredGroupItems.length > visibleGroupCount;
        const remaining = filteredGroupItems.length - visibleGroupCount;
        return (
          <>
            {visibleRows.map((row, rowIdx) => (
              <div key={rowIdx} className={`${gridClassName} pb-4`}>
                {row.map(renderGroupCard)}
              </div>
            ))}
            {hasMore && (
              <div className="flex justify-center mt-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setVisibleGroupCount(filteredGroupItems.length);
                    setAllShown(true);
                  }}
                >
                  <ChevronDown className="w-4 h-4 mr-1" />
                  {remaining} grup daha göster
                </Button>
              </div>
            )}
            <div ref={groupsListBottomRef} />
          </>
        );
      })()}
    </Profiler>
  );
}
