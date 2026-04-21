import React, { Profiler, useState, useCallback, useMemo, useEffect } from "react";
import type { Donation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { TableVirtuoso } from "react-virtuoso";
import {
  ArrowDown, ArrowUp, ArrowUpDown,
  FileText, Filter, Search, Trash2, X,
} from "lucide-react";
import { DonorRow } from "./DonorRow";
import { useKesimAlaniContext } from "../KesimAlaniContext";
import { BulkImportDialog } from "../dialogs/BulkImportDialog";
import { FindDeleteDialog } from "../dialogs/FindDeleteDialog";
import { AddDonorDialog } from "../dialogs/AddDonorDialog";
import { DonorAdvancedFilter } from "./DonorAdvancedFilter";
import { DonorBulkActions } from "./DonorBulkActions";

export function DonorListPanel() {
  const ctx = useKesimAlaniContext();
  const {
    kesim, activeFilterCount, addDonorToBasket, basketItemIds, commitEdit,
    debouncedSearchQuery, deleteDonation, handleFlagDonation, handleUnflagDonation, descCountMap, donorListVisible,
    editDraft, editingCell, effectiveShareMap, filteredDonations,
    globalTags, groupedDonorIds, handleDonorCellKeyDown, handleSort,
    openTrash, removeFromBasket, removedFromGroupIds, searchInputRef,
    selectedIds, setDebouncedSearchQuery, setDonorListReportOpen,
    setDonorListVisible, setEditDraft, setPersonEditDesc,
    setSelectedIds, setShowAdvancedFilter, setShowRemovedFilter, setSmartPlacePopover,
    setSplitShareDialog, setTagPopoverDonorId, showAdvancedFilter, showRemovedFilter,
    sortDir, sortField, startEditing, tagPopoverDonorId, toggleDonationTag,
    toggleSelect, toggleSelectAll, updateDonationField, virtuosoTableComponents,
  } = ctx;

  const visibleDonations = useMemo(
    () => filteredDonations.filter(d => !basketItemIds.has(d.id)),
    [filteredDonations, basketItemIds]
  );

  useEffect(() => {
    if (selectedIds.size === 0 || basketItemIds.size === 0) return;
    const hiddenSelected = [...selectedIds].filter(id => basketItemIds.has(id));
    if (hiddenSelected.length > 0) {
      const next = new Set(selectedIds);
      hiddenSelected.forEach(id => next.delete(id));
      setSelectedIds(next);
    }
  }, [basketItemIds, selectedIds, setSelectedIds]);

  const onRenderCallback: React.ProfilerOnRenderCallback = useCallback(
    (id, phase, actualDuration, baseDuration) => {
      if (import.meta.env.DEV && actualDuration > 16) {
        console.debug(`[Profiler] ${id} ${phase}: actual=${actualDuration.toFixed(1)}ms base=${baseDuration.toFixed(1)}ms`);
      }
    }, []
  );

  const [searchQuery, setSearchQuery] = useState("");

  const handleDonorSearch = useCallback(() => {
    setDebouncedSearchQuery(searchQuery);
  }, [searchQuery, setDebouncedSearchQuery]);

  const handleDonorSearchClear = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
  }, [setDebouncedSearchQuery]);

  if (!kesim) return null;

  return (
    <Profiler id="DonorListPanel" onRender={onRenderCallback}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold whitespace-nowrap">Bağışçı Listesi</h2>
          {removedFromGroupIds.size > 0 && (
            <button
              onClick={() => { setShowRemovedFilter(!showRemovedFilter); if (!donorListVisible) setDonorListVisible(true); }}
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${showRemovedFilter ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 ring-1 ring-red-500" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900"}`}
            >
              Gruptan Çıkarılanlar ({removedFromGroupIds.size})
              {showRemovedFilter && <span className="text-[10px]">✕</span>}
            </button>
          )}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex items-center gap-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input ref={searchInputRef} className="h-8 text-sm pl-8 pr-7 w-32 sm:w-48" placeholder="Ara... (Ctrl+F)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleDonorSearch(); } }} aria-label="Bağışçı ara" />
              {(searchQuery || debouncedSearchQuery) && (
                <button className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded" onClick={handleDonorSearchClear} aria-label="Aramayı temizle"><X className="w-3 h-3" aria-hidden="true" /></button>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={handleDonorSearch} title="Ara">Ara</Button>
          </div>
          <Button variant={showAdvancedFilter ? "default" : "outline"} size="sm" onClick={() => setShowAdvancedFilter(!showAdvancedFilter)} title="Gelişmiş Filtre" aria-label={`Gelişmiş filtre${activeFilterCount > 0 ? ` (${activeFilterCount} aktif)` : ""}`} aria-pressed={showAdvancedFilter}>
            <Filter className="w-4 h-4" aria-hidden="true" />
            {activeFilterCount > 0 && (<span className="ml-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">{activeFilterCount}</span>)}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDonorListReportOpen(true)} title="Bağışçı Listesi Raporu" aria-label="Bağışçı listesi raporu"><FileText className="w-4 h-4" aria-hidden="true" /></Button>
          <BulkImportDialog />
          <FindDeleteDialog />
          <Button variant="outline" size="sm" onClick={openTrash} title="Bağış Çöp Kutusu" aria-label="Bağış çöp kutusunu aç"><Trash2 className="w-4 h-4 mr-1" aria-hidden="true" />Çöp Kutusu</Button>
          <AddDonorDialog />
        </div>
      </div>

      {showAdvancedFilter && <DonorAdvancedFilter />}
      <DonorBulkActions />

      <Card className="overflow-hidden">
        {visibleDonations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {filteredDonations.length > 0 && visibleDonations.length === 0
              ? "Tüm eşleşen bağışçılar sepette. Sepetten çıkarıldıklarında burada görünecekler."
              : searchQuery.trim() ? `"${searchQuery}" için sonuç bulunamadı` : 'Tüm bağışçılar gruplara atanmış veya henüz eklenmedi.'}
          </div>
        ) : (
          <TableVirtuoso
            style={{ height: `min(calc(100vh - 150px), ${visibleDonations.length * 45 + 50}px)`, minHeight: 200 }}
            data={visibleDonations}
            overscan={30}
            computeItemKey={(_idx: number, d: Donation) => d.id}
            components={virtuosoTableComponents as any}
            fixedHeaderContent={() => (
              <tr className="border-b bg-muted/50">
                <th className="p-2 w-8"><input type="checkbox" checked={visibleDonations.length > 0 && visibleDonations.every(d => selectedIds.has(d.id))} onChange={() => { const visibleIds = new Set(visibleDonations.map(d => d.id)); const allSelected = visibleDonations.every(d => selectedIds.has(d.id)); if (allSelected) { setSelectedIds(prev => { const next = new Set(prev); visibleIds.forEach(id => next.delete(id)); return next; }); } else { setSelectedIds(prev => new Set([...prev, ...visibleIds])); } }} className="rounded" /></th>
                <th className="p-2 text-left w-8">#</th>
                <th className="p-2 text-left w-20">Vekalet</th>
                <th className="p-2 text-left cursor-pointer hover:bg-muted" onClick={() => handleSort("description")}>
                  <span className="flex items-center gap-1">Vekaleti Veren{sortField === "description" && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}{sortField !== "description" && <ArrowUpDown className="w-3 h-3 opacity-30" />}</span>
                </th>
                <th className="p-2 text-left cursor-pointer hover:bg-muted" onClick={() => handleSort("name")}>
                  <span className="flex items-center gap-1">Adına Kesilen{sortField === "name" && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}{sortField !== "name" && <ArrowUpDown className="w-3 h-3 opacity-30" />}</span>
                </th>
                <th className="p-2 text-left cursor-pointer hover:bg-muted w-20" onClick={() => handleSort("donationType")}>
                  <span className="flex items-center gap-1">Cinsi{sortField === "donationType" && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}{sortField !== "donationType" && <ArrowUpDown className="w-3 h-3 opacity-30" />}</span>
                </th>
                <th className="p-2 text-left w-24">Notlar</th>
                <th className="p-2 text-center cursor-pointer hover:bg-muted w-16" onClick={() => handleSort("shareCount")}>
                  <span className="flex items-center gap-1 justify-center">Hisse{sortField === "shareCount" && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}{sortField !== "shareCount" && <ArrowUpDown className="w-3 h-3 opacity-30" />}</span>
                </th>
                <th className="p-2 w-10"></th>
              </tr>
            )}
            itemContent={(idx, d) => {
              const descCount = d.excluded ? 0 : (descCountMap.get(d.description.trim().toLowerCase()) || 1);
              const effectiveShare = descCount > 1 ? descCount : d.shareCount;
              const splitShares = effectiveShareMap.get(d.id) || d.shareCount;
              return (
                <DonorRow
                  d={d} idx={idx} descCount={descCount} effectiveShare={effectiveShare}
                  isSelected={selectedIds.has(d.id)}
                  isEditing={editingCell?.donationId === d.id}
                  editField={editingCell?.donationId === d.id ? editingCell.field : null}
                  editDraft={editDraft}
                  isInBasket={basketItemIds.has(d.id)}
                  isGrouped={groupedDonorIds.has(d.id)}
                  canSplit={splitShares > 7}
                  splitShares={splitShares}
                  globalTags={globalTags}
                  tagPopoverOpen={tagPopoverDonorId === d.id}
                  onToggleSelect={toggleSelect}
                  onStartEditing={startEditing}
                  onSetEditDraft={setEditDraft}
                  onCommitEdit={commitEdit}
                  onKeyDown={handleDonorCellKeyDown}
                  onSetPersonEditDesc={setPersonEditDesc}
                  onUpdateField={updateDonationField}
                  onToggleTag={toggleDonationTag}
                  onSetTagPopover={setTagPopoverDonorId}
                  onAddToBasket={addDonorToBasket}
                  onRemoveFromBasket={removeFromBasket}
                  onSmartPlace={setSmartPlacePopover}
                  onSplitShare={setSplitShareDialog}
                  onDelete={deleteDonation}
                  onFlagDonation={handleFlagDonation}
                  onUnflagDonation={handleUnflagDonation}
                />
              );
            }}
          />
        )}
      </Card>
    </Profiler>
  );
}
