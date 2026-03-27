import React, { useState, useCallback } from "react";
import type { Donation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableVirtuoso } from "react-virtuoso";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Eye, EyeOff,
  FileText, Filter, Scissors, Search, ShoppingBag, Tag, Trash2, UserCog, Wand2, X,
} from "lucide-react";
import { useKesimAlaniContext } from "../KesimAlaniContext";
import { BulkImportDialog } from "./BulkImportDialog";
import { FindDeleteDialog } from "./FindDeleteDialog";
import { AddDonorDialog } from "./AddDonorDialog";
import { DonorAdvancedFilter } from "./DonorAdvancedFilter";
import { DonorBulkActions } from "./DonorBulkActions";

export function DonorListPanel() {
  const ctx = useKesimAlaniContext();
  const {
    kesim, activeFilterCount, addDonorToBasket, basketItemIds, commitEdit,
    debouncedSearchQuery, deleteDonation, descCountMap, donorListVisible,
    editDraft, editingCell, effectiveShareMap, filterUngrouped, filteredDonations,
    globalTags, groupedDonorIds, handleDonorCellKeyDown, handleSort,
    openTrash, removeFromBasket, removedFromGroupIds, searchInputRef,
    selectedIds, setDebouncedSearchQuery, setDonorListReportOpen,
    setDonorListVisible, setEditDraft, setFilterUngrouped, setPersonEditDesc,
    setSelectedIds, setShowAdvancedFilter, setShowRemovedFilter, setSmartPlacePopover,
    setSplitShareDialog, setTagPopoverDonorId, showAdvancedFilter, showRemovedFilter,
    sortDir, sortField, startEditing, tagPopoverDonorId, toggleDonationTag,
    toggleSelect, toggleSelectAll, updateDonationField, virtuosoTableComponents,
  } = ctx;

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
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold whitespace-nowrap">Bağışçı Listesi</h2>
          {filterUngrouped && (
            <button onClick={() => setFilterUngrouped(false)} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors">
              Gruplanmamış<span className="text-[10px]">✕</span>
            </button>
          )}
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
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input ref={searchInputRef} className="h-8 text-sm pl-8 pr-7 w-32 sm:w-48" placeholder="Ara... (Ctrl+F)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleDonorSearch(); } }} />
              {(searchQuery || debouncedSearchQuery) && (
                <button className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded" onClick={handleDonorSearchClear}><X className="w-3 h-3" /></button>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={handleDonorSearch} title="Ara">Ara</Button>
          </div>
          <Button variant={showAdvancedFilter ? "default" : "outline"} size="sm" onClick={() => setShowAdvancedFilter(!showAdvancedFilter)} title="Gelişmiş Filtre">
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (<span className="ml-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">{activeFilterCount}</span>)}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDonorListReportOpen(true)} title="Bağışçı Listesi Raporu"><FileText className="w-4 h-4" /></Button>
          <BulkImportDialog />
          <FindDeleteDialog />
          <Button variant="outline" size="sm" onClick={openTrash} title="Bağış Çöp Kutusu"><Trash2 className="w-4 h-4 mr-1" />Çöp Kutusu</Button>
          <AddDonorDialog />
        </div>
      </div>

      {showAdvancedFilter && <DonorAdvancedFilter />}
      <DonorBulkActions />

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
                <th className="p-2 w-8"><input type="checkbox" checked={kesim.donations.length > 0 && selectedIds.size === kesim.donations.length} onChange={toggleSelectAll} className="rounded" /></th>
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
              return (<>
                <td className="p-2"><input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} className="rounded" /></td>
                <td className="p-2 text-muted-foreground">{idx + 1}</td>
                <td className="p-2">
                  {editingCell?.donationId === d.id && editingCell?.field === "vekalet" ? (
                    <Input className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} onBlur={() => commitEdit()} onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "vekalet")} autoFocus />
                  ) : (
                    <span className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors" onClick={() => startEditing(d.id, "vekalet")}>{d.vekalet || "—"}</span>
                  )}
                </td>
                <td className="p-2">
                  {editingCell?.donationId === d.id && editingCell?.field === "description" ? (
                    <Input className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} onBlur={() => commitEdit()} onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "description")} autoFocus />
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="cursor-text flex-1 block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors" onClick={() => startEditing(d.id, "description")}>{d.description || "—"}</span>
                      {d.description && descCount > 1 && (
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" title="Bu kişinin tüm kayıtlarını düzenle" aria-label="Bu kişinin tüm kayıtlarını düzenle" onClick={() => setPersonEditDesc(d.description)}><UserCog className="w-3 h-3 text-muted-foreground" /></Button>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-2">
                  {editingCell?.donationId === d.id && editingCell?.field === "name" ? (
                    <Input className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} onBlur={() => commitEdit()} onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "name")} autoFocus />
                  ) : (
                    <span className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors" onClick={() => startEditing(d.id, "name")}>{d.name || "—"}</span>
                  )}
                </td>
                <td className="p-2">
                  {editingCell?.donationId === d.id && editingCell?.field === "donationType" ? (
                    <Input className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} onBlur={() => commitEdit()} onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "donationType")} autoFocus />
                  ) : (
                    <span className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors" onClick={() => startEditing(d.id, "donationType")}>{d.donationType || "—"}</span>
                  )}
                </td>
                <td className="p-2">
                  {editingCell?.donationId === d.id && editingCell?.field === "notes" ? (
                    <Input className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} onBlur={() => commitEdit()} onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "notes")} autoFocus />
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors" onClick={() => startEditing(d.id, "notes")}>{d.notes || "—"}</span>
                      {((d.aiCategories && d.aiCategories.length > 0) || (d.aiWarnings && d.aiWarnings.trim())) && (
                        <div className="flex gap-0.5 flex-wrap px-1">
                          {(d.aiCategories || []).map(cat => (<span key={cat} className="px-1.5 py-0 rounded-full text-[9px] font-medium bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">{cat}</span>))}
                          {d.aiWarnings && d.aiWarnings.trim() && (<span className="px-1.5 py-0 rounded-full text-[9px] font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-0.5" title={d.aiWarnings}><AlertTriangle className="w-2.5 h-2.5" /> uyarı</span>)}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-2 text-center">
                  {descCount > 1 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">{effectiveShare}</span>
                  ) : (
                    <Select value={String(d.shareCount)} onValueChange={(v) => updateDonationField(d.id, "shareCount", parseInt(v))}>
                      <SelectTrigger className="h-7 w-16 text-sm mx-auto"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1, 2, 3, 4, 5, 6, 7].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}</SelectContent>
                    </Select>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    {(d.tags || []).length > 0 && globalTags.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap mr-1">
                        {(d.tags || []).map(tagId => { const tag = globalTags.find(t => t.id === tagId); if (!tag) return null; return (<span key={tagId} className="px-1.5 py-0 rounded-full text-[9px] font-medium text-white leading-4" style={{ backgroundColor: tag.color }}>{tag.name}</span>); })}
                      </div>
                    )}
                    {globalTags.length > 0 && (
                      <Popover open={tagPopoverDonorId === d.id} onOpenChange={(open) => setTagPopoverDonorId(open ? d.id : null)}>
                        <PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Etiket ata" aria-label="Etiket ata"><Tag className="w-3 h-3 text-muted-foreground" /></Button></PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="end">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Etiket Ata</p>
                            {globalTags.map(tag => { const isActive = (d.tags || []).includes(tag.id); return (<button key={tag.id} className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted transition-colors ${isActive ? "bg-muted" : ""}`} onClick={() => toggleDonationTag(d.id, tag.id)}><span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} /><span className="flex-1 text-left">{tag.name}</span>{isActive && <span className="text-primary">✓</span>}</button>); })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    {!d.excluded && (
                      <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${basketItemIds.has(d.id) ? "bg-emerald-100 dark:bg-emerald-900" : ""}`} title={basketItemIds.has(d.id) ? "Sepetten Çıkar" : "Sepete Ekle"} aria-label={basketItemIds.has(d.id) ? "Sepetten Çıkar" : "Sepete Ekle"} onClick={() => basketItemIds.has(d.id) ? removeFromBasket(d.id) : addDonorToBasket(d.id)}>
                        <ShoppingBag className={`w-3 h-3 ${basketItemIds.has(d.id) ? "text-emerald-600" : "text-muted-foreground"}`} />
                      </Button>
                    )}
                    {!d.excluded && !groupedDonorIds.has(d.id) && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Akıllı Yerleştir" aria-label="Akıllı Yerleştir" onClick={() => setSmartPlacePopover(d.id)}><Wand2 className="w-3 h-3 text-primary" /></Button>
                    )}
                    {(effectiveShareMap.get(d.id) || d.shareCount) > 7 && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Hisse Böl" aria-label="Hisse Böl" onClick={() => setSplitShareDialog({ donationId: d.id, totalShares: effectiveShareMap.get(d.id) || d.shareCount })}><Scissors className="w-3 h-3 text-amber-600" /></Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={d.excluded ? "Dahil et" : "Hariç tut"} aria-label={d.excluded ? "Dahil et" : "Hariç tut"} onClick={() => updateDonationField(d.id, "excluded", !d.excluded)}>
                      {d.excluded ? <Eye className="w-3 h-3 text-green-600" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Bağışçıyı sil" onClick={() => deleteDonation(d.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </div>
                </td>
              </>);
            }}
          />
        )}
      </Card>
    </>
  );
}
