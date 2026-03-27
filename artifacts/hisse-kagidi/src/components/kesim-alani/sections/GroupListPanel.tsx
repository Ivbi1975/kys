import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Virtuoso } from "react-virtuoso";
import { AnimalGroupCard } from "@/components/AnimalGroupCard";
import { checkGroupConflicts } from "@/lib/grouping";
import { ALL_GROUP_COLUMNS, type ColumnKey } from "@/lib/useWorkspacePreferences";
import {
  AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUp, ChevronsDownUp, ChevronsUpDown,
  Eye, EyeOff, Filter, GripVertical, LayoutGrid, Lock, MapIcon, Maximize2,
  Merge, Minimize2, MoveRight, PanelLeftClose, PanelLeftOpen, Plus,
  Search, SearchX, Settings2, ShoppingBag, Sparkles, Trash2, Unlock, UserCog,
  Wand2, X,
} from "lucide-react";
import { useKesimAlaniContext } from "../KesimAlaniContext";

export function GroupListPanel() {
  const ctx = useKesimAlaniContext();
  const {
    kesim, addEmptyGroup, basketItemIds, bulkChangeGroupDonationType, bulkGroupEditField,
    bulkGroupEditOpen, bulkGroupEditValue, bulkMoveTargetGroup, bulkMoveToGroup,
    bulkRemoveFromGroups, cancelSwap, cleanEmptyGroups, collapseAll, collapsedGroups,
    colorTagFilter, columnHeaderLabel, columnHeaderWidth, conflicts,
    currentGroupMatches, deleteAnimalGroup, donorListVisible,
    dragItem, dragOverGroup, dragOverItem, effectiveColumnCount, enhancedRemoveFromGroup,
    executeGroupFindDelete, expandAll, filteredGroupItems, findDeleteColumnLabel,
    fullscreenMode, getGroupFindDeleteMatches, groupFindDeleteColumn,
    groupFindDeleteConfirm, groupFindDeleteOpen, groupFindDeleteValue, groupRows,
    groupSearchMatchIdx, groupSearchQuery, groupsHeaderRef, groupsScrollTopRef,
    groupsVirtuosoRef, handleAssignTeam, handleAutoGroup, handleColumnDragEnd,
    handleColumnDragOver, handleColumnDragStart, handleColumnDrop,
    handleDragEnd, handleDragLeave, handleDragOver, handleDragOverCard,
    handleDragStart, handleDrop, handleGroupCellTab, handleSelectAllGroupDonations,
    handleSetGroupColorTag, handleSwapSelect, handleToggleBasketItem,
    handleViewPhotos, highlightIncomplete, isMobile, jumpInputRef, lockAllGroups,
    mergeSelectedGroups, minimapOpen, moveGroupDown, moveGroupUp,
    openAutoResolve, openSplitGroupDialog, photoCounts, rangeLockInput, applyRangeLock,
    requiredAnimals, scrollContainerRef, scrollToAnimalGroup, selectedGroupDonations,
    selectedGroupIds, setAddDialogOpen, setBulkGroupEditField, setBulkGroupEditOpen,
    setBulkGroupEditValue, setBulkMoveTargetGroup, setColorTagFilter, setConflicts,
    setDonorListVisible, setFullscreenMode, setGroupFindDeleteColumn,
    setGroupFindDeleteConfirm, setGroupFindDeleteOpen, setGroupFindDeleteValue,
    setGroupSearchMatchIdx, setGroupSearchQuery, setHighlightIncomplete,
    setJumpDialogOpen, setMinimapOpen, setPersonEditDesc, setRangeLockInput,
    setSelectedGroupDonations, setSelectedGroupIds, setShowConflicts, setShowOnlyIncomplete,
    showConflicts, showOnlyIncomplete, startFilterTransition, swapSelection,
    toggleGroupCollapse, toggleGroupDonationSelect, toggleGroupLock, toggleGroupSelect,
    unlockAllGroups, updateGroupDonation, updateGroupNotes, workspace, addGroupToBasket,
    groupingInProgress,
  } = ctx;

  const [groupSearchInput, setGroupSearchInput] = useState("");

  const handleGroupSearch = useCallback(() => {
    setGroupSearchQuery(groupSearchInput);
    setGroupSearchMatchIdx(0);
  }, [groupSearchInput, setGroupSearchQuery, setGroupSearchMatchIdx]);

  const handleGroupSearchClear = useCallback(() => {
    setGroupSearchInput("");
    setGroupSearchQuery("");
    setGroupSearchMatchIdx(0);
  }, [setGroupSearchQuery, setGroupSearchMatchIdx]);

  if (!kesim) return null;

  return (
    <>
      <div ref={groupsHeaderRef} className="flex items-center justify-between mb-4 flex-wrap gap-2 sticky top-0 z-20 bg-background py-2 -mt-2 border-b border-transparent" style={{ backdropFilter: "blur(8px)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          {!fullscreenMode && !isMobile && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setDonorListVisible(!donorListVisible)}
              title={donorListVisible ? "Bağışçı Listesini Gizle" : "Bağışçı Listesini Göster"}
              aria-label={donorListVisible ? "Bağışçı Listesini Gizle" : "Bağışçı Listesini Göster"}
            >
              {donorListVisible ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
            </Button>
          )}
          <h2 className="text-lg font-semibold whitespace-nowrap">
            Hayvan Grupları ({kesim.animalGroups.length})
          </h2>
          {kesim.animalGroups.length > 0 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={addEmptyGroup}
                title="Boş Grup Ekle"
                aria-label="Boş Grup Ekle"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant={minimapOpen ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setMinimapOpen(!minimapOpen)}
                title="Genel Bakış"
                aria-label="Genel Bakış"
              >
                <MapIcon className="w-3.5 h-3.5" />
              </Button>

              <Select value={String(workspace.prefs.columnCount)} onValueChange={(v) => workspace.setColumnCount(Number(v) as 1 | 2 | 3)}>
                <SelectTrigger className="h-7 w-16 text-xs" aria-label="Sütun sayısı">
                  <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={workspace.prefs.compactMode ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => workspace.setCompactMode(!workspace.prefs.compactMode)}
                title="Kompakt Mod"
                aria-label="Kompakt Mod"
                aria-pressed={workspace.prefs.compactMode}
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant={fullscreenMode ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setFullscreenMode(!fullscreenMode)}
                title={fullscreenMode ? "Tam Ekrandan Çık (ESC)" : "Tam Ekran"}
                aria-label={fullscreenMode ? "Tam Ekrandan Çık" : "Tam Ekran"}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2" title="Sütun Ayarları" aria-label="Sütun Ayarları">
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
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={collapseAll} title="Tümünü Daralt" aria-label="Tümünü Daralt">
                  <ChevronsDownUp className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={expandAll} title="Tümünü Genişlet" aria-label="Tümünü Genişlet">
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
              <Button variant="outline" size="sm" className="h-8" onClick={() => setJumpDialogOpen(true)}>
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                        <span className="text-sm font-medium">
                          {matches.length > 0 ? `${matches.length} kayıt bulundu (gruplarda)` : "Gruplarda eşleşen kayıt bulunamadı"}
                        </span>
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
                              <div className="p-2 text-xs text-muted-foreground text-center bg-muted/20">... ve {matches.length - 50} kayıt daha</div>
                            )}
                          </div>
                        )}
                        {matches.length > 0 && !groupFindDeleteConfirm && (
                          <Button variant="destructive" className="w-full" onClick={() => setGroupFindDeleteConfirm(true)}>
                            <Trash2 className="w-4 h-4 mr-1" />{matches.length} Kaydı Sil
                          </Button>
                        )}
                        {matches.length > 0 && groupFindDeleteConfirm && (
                          <div className="space-y-2 border border-destructive/50 rounded-lg p-3 bg-destructive/5">
                            <p className="text-sm font-medium text-destructive">{matches.length} bağışçı gruplardan ve listeden kalıcı olarak silinecek. Emin misiniz?</p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1" onClick={() => setGroupFindDeleteConfirm(false)}>İptal</Button>
                              <Button variant="destructive" size="sm" className="flex-1" onClick={executeGroupFindDelete}>Evet, Sil</Button>
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
                      <Lock className="w-3 h-3 mr-1" />Tümünü Kilitle
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={unlockAllGroups}>
                      <Unlock className="w-3 h-3 mr-1" />Tümünü Aç
                    </Button>
                  </div>
                  <div className="border-t pt-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      Hayvan numarası aralığı veya çoklu seçim girin (örn: 1-5 veya 3, 7, 12)
                    </p>
                    <div className="flex gap-2">
                      <Input className="h-8 text-sm flex-1" placeholder="1-5 veya 3, 7, 12" value={rangeLockInput} onChange={(e) => setRangeLockInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyRangeLock(true); }} />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button variant="default" size="sm" className="flex-1" onClick={() => applyRangeLock(true)} disabled={!rangeLockInput.trim()}>
                        <Lock className="w-3 h-3 mr-1" />Kilitle
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => applyRangeLock(false)} disabled={!rangeLockInput.trim()}>
                        <Unlock className="w-3 h-3 mr-1" />Kilidi Aç
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
                      <button className="p-0.5 hover:bg-muted rounded" onClick={() => setGroupSearchMatchIdx(prev => Math.max(0, prev - 1))} disabled={currentGroupMatches.length === 0}>
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button className="p-0.5 hover:bg-muted rounded" onClick={() => setGroupSearchMatchIdx(prev => prev + 1)} disabled={currentGroupMatches.length === 0}>
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  <button className="p-0.5 hover:bg-muted rounded" onClick={handleGroupSearchClear}>
                    <X className="w-3 h-3" />
                  </button>
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
            <Button variant={showOnlyIncomplete ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => startFilterTransition(() => setShowOnlyIncomplete(!showOnlyIncomplete))} title="Sadece eksik grupları göster">
              <Filter className="w-3 h-3 mr-1" />Eksik
            </Button>
            <Button variant={highlightIncomplete ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => startFilterTransition(() => setHighlightIncomplete(!highlightIncomplete))} title="Eksik grupları vurgula">
              <AlertTriangle className="w-3 h-3 mr-1" />Vurgula
            </Button>
          </div>
        </div>
      )}

      {minimapOpen && kesim.animalGroups.length > 0 && (
        <Card className="p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <MapIcon className="w-4 h-4" />Genel Bakış
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
                <button key={group.id} className="w-7 h-7 rounded text-[10px] font-bold text-white flex items-center justify-center transition-transform hover:scale-110 hover:shadow-md" style={{ backgroundColor: bg }} title={`Hayvan ${group.animalNo}: ${filled}/7 dolu`} onClick={() => scrollToAnimalGroup(group.animalNo)}>
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
        <div className="mb-3 flex items-center gap-3 p-2 bg-primary/10 rounded-lg flex-wrap">
          <span className="text-sm font-medium">{selectedGroupIds.size} grup seçildi</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={mergeSelectedGroups} disabled={selectedGroupIds.size < 2}>
            <Merge className="w-3 h-3 mr-1" />Birleştir
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={bulkRemoveFromGroups}>
            <Trash2 className="w-3 h-3 mr-1" />Bağışçıları Çıkar
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedGroupIds(new Set())}>
            Seçimi Kaldır
          </Button>
        </div>
      )}

      {selectedGroupDonations.size > 0 && (
        <div className="mb-3 flex items-center gap-3 p-2 bg-primary/10 rounded-lg flex-wrap">
          <span className="text-sm font-medium">{selectedGroupDonations.size} bağışçı seçildi (gruplarda)</span>
          <div className="flex items-center gap-1">
            <Select value={bulkMoveTargetGroup < 0 ? "" : String(bulkMoveTargetGroup)} onValueChange={(v) => setBulkMoveTargetGroup(parseInt(v))}>
              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Hedef grup..." /></SelectTrigger>
              <SelectContent>
                {kesim.animalGroups.map((g, gi) => (
                  <SelectItem key={g.id} value={String(gi)}>Hayvan {g.animalNo}</SelectItem>
                ))}
              </SelectContent>
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
              <DialogHeader>
                <DialogTitle>{selectedGroupDonations.size} Bağışçıyı Toplu Düzenle</DialogTitle>
              </DialogHeader>
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
              {selDonor ? ` — ${selDonor.description || selDonor.name} (${selDonor.shareCount || 1} hisse)` : ""} seçildi.
              Başka bir gruptaki bağışçıya tıklayın.
            </span>
            <Button variant="ghost" size="sm" onClick={cancelSwap}>İptal</Button>
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
                              <button className="underline font-semibold hover:text-amber-900 cursor-pointer" onClick={(e) => { e.stopPropagation(); scrollToAnimalGroup(no); }}>{no}</button>
                            </span>
                          ))}</span>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setPersonEditDesc(c.description)}>
                            <UserCog className="w-3 h-3 mr-1" />Düzenle
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
                                  <button className="underline font-semibold hover:text-amber-700 cursor-pointer" onClick={(e) => { e.stopPropagation(); scrollToAnimalGroup(no); }}>{no}</button>
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
                <Button variant="outline" size="sm" className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100" onClick={openAutoResolve}>
                  <Sparkles className="w-3 h-3 mr-1" />Otomatik Çöz
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
    </>
  );
}
