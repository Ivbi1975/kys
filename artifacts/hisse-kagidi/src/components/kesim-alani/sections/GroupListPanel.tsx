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
    if (!allShown) return;
    const onScroll = () => {
      if (!groupsListBottomRef.current) return;
      const rect = groupsListBottomRef.current.getBoundingClientRect();
      setAtBottom(rect.top <= window.innerHeight + 80);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
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

  return (
    <Profiler id="GroupListPanel" onRender={onRenderCallback}>
      <div ref={groupsHeaderRef} className="flex items-center justify-between mb-4 flex-wrap gap-2 sticky top-0 z-20 bg-background py-2 -mt-2 border-b border-transparent" style={{ backdropFilter: "blur(8px)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          {!fullscreenMode && !isMobile && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDonorListVisible(!donorListVisible)} title={donorListVisible ? "Bağışçı Listesini Gizle" : "Bağışçı Listesini Göster"} aria-label={donorListVisible ? "Bağışçı Listesini Gizle" : "Bağışçı Listesini Göster"}>
              {donorListVisible ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
            </Button>
          )}
          <h2 className="text-lg font-semibold whitespace-nowrap">Hayvan Grupları ({kesim.animalGroups.length})</h2>
          {kesim.animalGroups.length > 0 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2" onClick={addEmptyGroup} title="Boş Grup Ekle" aria-label="Boş Grup Ekle"><Plus className="w-3.5 h-3.5" /></Button>
              <Button variant={ctx.minimapOpen ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => ctx.setMinimapOpen(!ctx.minimapOpen)} title="Genel Bakış" aria-label="Genel Bakış"><MapIcon className="w-3.5 h-3.5" /></Button>
              <Select value={String(workspace.prefs.columnCount)} onValueChange={(v) => workspace.setColumnCount(Number(v) as 1 | 2 | 3)}>
                <SelectTrigger className="h-7 w-16 text-xs" aria-label="Sütun sayısı"><LayoutGrid className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem></SelectContent>
              </Select>
              <Button variant={workspace.prefs.compactMode ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => workspace.setCompactMode(!workspace.prefs.compactMode)} title="Kompakt Mod" aria-label="Kompakt Mod" aria-pressed={workspace.prefs.compactMode}><Minimize2 className="w-3.5 h-3.5" /></Button>
              <Button variant={fullscreenMode ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setFullscreenMode(!fullscreenMode)} title={fullscreenMode ? "Tam Ekrandan Çık (ESC)" : "Tam Ekran"} aria-label={fullscreenMode ? "Tam Ekrandan Çık" : "Tam Ekran"}><Maximize2 className="w-3.5 h-3.5" /></Button>
              <Popover>
                <PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-7 px-2" title="Sütun Ayarları" aria-label="Sütun Ayarları"><Settings2 className="w-3.5 h-3.5" /></Button></PopoverTrigger>
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
              <div className="flex items-center gap-1 ml-1">
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={collapseAll} title="Tümünü Daralt" aria-label="Tümünü Daralt"><ChevronsDownUp className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={expandAll} title="Tümünü Genişlet" aria-label="Tümünü Genişlet"><ChevronsUpDown className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          )}
        </div>
        {kesim.animalGroups.length > 0 && (
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1">
              <Input ref={jumpInputRef} className="h-8 w-20 text-sm text-center cursor-pointer" placeholder="No (Ctrl+G)" readOnly onClick={() => setJumpDialogOpen(true)} />
              <Button variant="outline" size="sm" className="h-8" onClick={() => setJumpDialogOpen(true)}>Git</Button>
            </div>
            {kesim.animalGroups.some(g => !g.donations.some(d => d.name.trim())) && (
              <Button variant="outline" size="sm" onClick={cleanEmptyGroups} title="Boş Grupları Temizle"><Trash2 className="w-4 h-4 mr-1" />Boşları Temizle</Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { ctx.runCheckConflicts(kesim.animalGroups).then(found => { setConflicts(found); setShowConflicts(true); }).catch(() => {}); }}><Search className="w-4 h-4 mr-1" />Çakışma Kontrol</Button>
            <GroupFindDeleteDialog />
            <GroupBulkLockPopover />
          </div>
        )}
      </div>

      {kesim.animalGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-1 flex-1 min-w-[180px] max-w-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 text-sm pl-8 pr-16" placeholder="Gruplarda ara..." value={groupSearchInput} onChange={(e) => setGroupSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGroupSearch(); } }} />
              {(groupSearchInput || groupSearchQuery) && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  {groupSearchQuery.trim() && (
                    <>
                      <span className="text-xs text-muted-foreground mr-1">{currentGroupMatches.length > 0 ? `${(groupSearchMatchIdx % currentGroupMatches.length) + 1}/${currentGroupMatches.length}` : "0"}</span>
                      <button className="p-0.5 hover:bg-muted rounded" onClick={() => setGroupSearchMatchIdx(prev => Math.max(0, prev - 1))} disabled={currentGroupMatches.length === 0}><ArrowUp className="w-3 h-3" /></button>
                      <button className="p-0.5 hover:bg-muted rounded" onClick={() => setGroupSearchMatchIdx(prev => prev + 1)} disabled={currentGroupMatches.length === 0}><ArrowDown className="w-3 h-3" /></button>
                    </>
                  )}
                  <button className="p-0.5 hover:bg-muted rounded" onClick={handleGroupSearchClear}><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={handleGroupSearch} title="Ara">Ara</Button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => startFilterTransition(() => setColorTagFilter("all"))} className={`text-xs px-2 py-0.5 rounded border ${colorTagFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>Tümü</button>
            <button onClick={() => startFilterTransition(() => setColorTagFilter("green"))} className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "green" ? "ring-2 ring-offset-1 ring-green-500" : ""}`} style={{ backgroundColor: "#22c55e" }} title="Yeşil" aria-label="Yeşil filtre" aria-pressed={colorTagFilter === "green"} />
            <button onClick={() => startFilterTransition(() => setColorTagFilter("orange"))} className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "orange" ? "ring-2 ring-offset-1 ring-orange-500" : ""}`} style={{ backgroundColor: "#f97316" }} title="Turuncu" aria-label="Turuncu filtre" aria-pressed={colorTagFilter === "orange"} />
            <button onClick={() => startFilterTransition(() => setColorTagFilter("red"))} className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "red" ? "ring-2 ring-offset-1 ring-red-500" : ""}`} style={{ backgroundColor: "#ef4444" }} title="Kırmızı" aria-label="Kırmızı filtre" aria-pressed={colorTagFilter === "red"} />
            <button onClick={() => startFilterTransition(() => setColorTagFilter(""))} className={`w-5 h-5 rounded-full border-2 border-dashed ${colorTagFilter === "" ? "ring-2 ring-offset-1 ring-gray-400" : ""}`} title="Renksiz" aria-label="Renksiz filtre" aria-pressed={colorTagFilter === ""} />
          </div>
          <div className="flex items-center gap-1 border-l pl-2 ml-1">
            <Button variant={showOnlyIncomplete ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => startFilterTransition(() => setShowOnlyIncomplete(!showOnlyIncomplete))} title="Sadece eksik grupları göster"><Filter className="w-3 h-3 mr-1" />Eksik</Button>
            <Button variant={highlightIncomplete ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => startFilterTransition(() => setHighlightIncomplete(!highlightIncomplete))} title="Eksik grupları vurgula"><AlertTriangle className="w-3 h-3 mr-1" />Vurgula</Button>
          </div>
          {uniqueGroupDonationTypes.length > 0 && (
            <div className="flex items-center gap-1 border-l pl-2 ml-1 flex-wrap">
              <span className="text-xs text-muted-foreground mr-0.5">Cins:</span>
              <button
                onClick={() => startFilterTransition(() => setGroupCinsFilter(new Set()))}
                className={`text-xs px-2 py-0.5 rounded border ${groupCinsFilter.size === 0 ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
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
                    className={`text-xs px-2 py-0.5 rounded border ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >{t}</button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <GroupMinimap />

      {selectedGroupIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 p-2 bg-primary/10 rounded-lg flex-wrap">
          <span className="text-sm font-medium">{selectedGroupIds.size} grup seçildi</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={mergeSelectedGroups} disabled={selectedGroupIds.size < 2}><Merge className="w-3 h-3 mr-1" />Birleştir</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={bulkRemoveFromGroups}><Trash2 className="w-3 h-3 mr-1" />Bağışçıları Çıkar</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedGroupIds(new Set())}>Seçimi Kaldır</Button>
        </div>
      )}

      {selectedGroupDonations.size > 0 && (
        <div className="mb-3 flex items-center gap-3 p-2 bg-primary/10 rounded-lg flex-wrap">
          <span className="text-sm font-medium">{selectedGroupDonations.size} bağışçı seçildi (gruplarda)</span>
          <div className="flex items-center gap-1">
            <Select value={bulkMoveTargetGroup < 0 ? "" : String(bulkMoveTargetGroup)} onValueChange={(v) => setBulkMoveTargetGroup(parseInt(v))}>
              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Hedef grup..." /></SelectTrigger>
              <SelectContent>{kesim.animalGroups.map((g, gi) => (<SelectItem key={g.id} value={String(gi)}>Hayvan {g.animalNo}</SelectItem>))}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => bulkMoveToGroup(bulkMoveTargetGroup)} disabled={bulkMoveTargetGroup < 0}><MoveRight className="w-3 h-3 mr-1" />Taşı</Button>
          </div>
          <Dialog open={bulkGroupEditOpen} onOpenChange={setBulkGroupEditOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="h-7 text-xs"><Settings2 className="w-3 h-3 mr-1" />Toplu Düzenle</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{selectedGroupDonations.size} Bağışçıyı Toplu Düzenle</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <Select value={bulkGroupEditField} onValueChange={(v: "donationType" | "notes") => setBulkGroupEditField(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="donationType">Cinsi</SelectItem><SelectItem value="notes">Notlar</SelectItem></SelectContent></Select>
                <Input placeholder="Yeni değer" value={bulkGroupEditValue} onChange={(e) => setBulkGroupEditValue(e.target.value)} />
                <Button onClick={bulkChangeGroupDonationType} className="w-full">Uygula</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedGroupDonations(new Set())}>Seçimi Kaldır</Button>
        </div>
      )}

      {swapSelection && (() => {
        const selDonor = kesim.animalGroups[swapSelection.groupIdx]?.donations[swapSelection.donationIdx];
        return (
          <div className="flex items-center gap-3 p-2 mb-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
            <ArrowLeftRight className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-purple-800 dark:text-purple-200">
              <strong>Takas modu:</strong> Hayvan {kesim.animalGroups[swapSelection.groupIdx]?.animalNo}, Sıra {swapSelection.donationIdx + 1}
              {selDonor ? ` — ${selDonor.description || selDonor.name} (${selDonor.shareCount || 1} hisse)` : ""} seçildi. Başka bir gruptaki bağışçıya tıklayın.
            </span>
            <Button variant="ghost" size="sm" onClick={cancelSwap}>İptal</Button>
          </div>
        );
      })()}

      <GroupConflictPanel />

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
              <div className="flex justify-center gap-2 py-4">
                <Button variant="outline" onClick={() => { setVisibleGroupCount(filteredGroupItems.length); setAllShown(true); }}>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Tüm Grupları Göster ({remaining} kaldı)
                </Button>
              </div>
            )}
            <div ref={groupsListBottomRef} />
            {allShown && (
              <button
                onClick={() => {
                  if (atBottom) {
                    groupsHeaderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  } else {
                    groupsListBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                  }
                }}
                className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-200"
                title={atBottom ? "En yukarıya git" : "En aşağıya git"}
              >
                {atBottom
                  ? <ArrowUp className="w-5 h-5" />
                  : <ArrowDown className="w-5 h-5" />
                }
              </button>
            )}
          </>
        );
      })()}
    </Profiler>
  );
}
