import React, { useState, useCallback } from "react";
import type { Donation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableVirtuoso } from "react-virtuoso";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ClipboardPaste, Eye, EyeOff,
  FileSpreadsheet, FileText, Filter, Plus, Scissors, Search, SearchX, Settings2,
  ShoppingBag, SlidersHorizontal, Tag, Trash2, Upload, UserCog, Wand2, X,
} from "lucide-react";
import type { ColumnMapping } from "../hooks/useImportExport";
import { useKesimAlaniContext } from "../KesimAlaniContext";

export function DonorListPanel() {
  const ctx = useKesimAlaniContext();
  const {
    kesim, activeFilterCount, addDonation, addSelectedToBasket, applyBulkEdit, applyBulkImport,
    availableAiCategories, basketItemIds, bulkDialogOpen, bulkEditField, bulkEditOpen, bulkEditValue,
    bulkMode, bulkReviewExpanded, bulkReviewRows, bulkStep, clearAdvancedFilters, COLUMN_OPTIONS,
    columnMappings, commitEdit, debouncedSearchQuery, deleteDonation, deleteSelected, descCountMap,
    displayPreviewRows, donorListVisible, editDraft, editingCell, effectiveShareMap,
    fileInputRef, filterAiCategories, filterAiWarnings, filterCinsi, filterHisseMax, filterHisseMin,
    filterStatus, filterTags, filterUngrouped, filteredDonations, findDeleteColumn, findDeleteColumnLabel,
    findDeleteConfirm, findDeleteOpen, findDeleteValue, addDonorToBasket, getFindDeleteMatches,
    globalTags, groupedDonorIds, groupingInProgress, handleAutoGroupSelected, handleDonorCellKeyDown,
    handleFileUpload, handlePasteData, handleSort, hasHeaderRow, headerRow, openTrash,
    pasteText, processRawData, removedFromGroupIds, removeFromBasket, resetBulkDialog,
    searchInputRef, selectedIds, setAddDialogOpen, addDialogOpen,
    setBulkDialogOpen, setBulkEditField, setBulkEditOpen, setBulkEditValue, setBulkMode,
    setBulkReviewExpanded, setBulkReviewRows, setBulkStep, setColumnMappings,
    setDebouncedSearchQuery, setDonorListReportOpen, setDonorListVisible, setEditDraft,
    setFilterAiCategories, setFilterAiWarnings, setFilterCinsi, setFilterHisseMax, setFilterHisseMin,
    setFilterStatus, setFilterTags, setFilterUngrouped, setFindDeleteColumn, setFindDeleteConfirm,
    setFindDeleteOpen, setFindDeleteValue, setHasHeaderRow, setPasteText, setPersonEditDesc,
    setSelectedIds, setShowAdvancedFilter, setShowRemovedFilter, setSmartPlacePopover,
    setSplitShareDialog, setTagPopoverDonorId, showAdvancedFilter, showRemovedFilter,
    sortDir, sortField, startEditing, tagPopoverDonorId, toast, toggleDonationTag, toggleSelect,
    toggleSelectAll, uniqueDonationTypes, updateDonationField, virtuosoTableComponents,
    executeFindDelete,
  } = ctx;

  const [searchQuery, setSearchQuery] = useState("");
  const [newDonation, setNewDonation] = useState({
    name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "", phone: "",
  });

  const handleDonorSearch = useCallback(() => {
    setDebouncedSearchQuery(searchQuery);
  }, [searchQuery, setDebouncedSearchQuery]);

  const handleDonorSearchClear = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
  }, [setDebouncedSearchQuery]);

  const handleAddDonation = useCallback(() => {
    addDonation(newDonation);
    setNewDonation({ name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "", phone: "" });
  }, [addDonation, newDonation]);

  if (!kesim) return null;

  return (
    <>
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
                      <Button variant="outline" size="sm" onClick={() => setBulkReviewRows(prev => prev.map(r => ({ ...r, selected: true })))}>
                        Tümünü Seç
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setBulkReviewRows(prev => prev.map(r => ({ ...r, selected: false })))}>
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
                          const descLabel = descColIdx >= 0 && groupRows[0]?.row[descColIdx] ? String(groupRows[0].row[descColIdx]) : gk;
                          const allSelected = groupRows.every(r => r.selected);
                          const isExpanded = bulkReviewExpanded.has(gk);
                          return (
                            <div key={gk} className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!allSelected}
                                  onChange={() => {
                                    const newSel = !allSelected;
                                    setBulkReviewRows(prev => prev.map(r => r.groupKey === gk ? { ...r, selected: newSel } : r));
                                  }}
                                  className="rounded"
                                />
                                <button className="flex-1 text-left text-sm" onClick={() => setBulkReviewExpanded(prev => { const s = new Set(prev); isExpanded ? s.delete(gk) : s.add(gk); return s; })}>
                                  <span className="font-semibold">{descLabel}</span>
                                  <span className="text-muted-foreground ml-2 text-xs">
                                    ({groupRows.length} satır, toplam {groupTotal} hisse)
                                  </span>
                                </button>
                              </div>
                              {isExpanded && (
                                <div className="ml-6 mt-1">
                                  <table className="w-full text-xs">
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
                        <Button variant="destructive" className="w-full" onClick={() => setFindDeleteConfirm(true)}>
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
                <Input placeholder="Vekalet No" value={newDonation.vekalet} onChange={(e) => setNewDonation({ ...newDonation, vekalet: e.target.value })} />
                <Input placeholder="Vekaleti Veren" value={newDonation.description} onChange={(e) => setNewDonation({ ...newDonation, description: e.target.value })} />
                <Input placeholder="Adına Kesilen" value={newDonation.name} onChange={(e) => setNewDonation({ ...newDonation, name: e.target.value })} />
                <Input placeholder="Cinsi (Vacip, Akika, Adak...)" value={newDonation.donationType} onChange={(e) => setNewDonation({ ...newDonation, donationType: e.target.value })} />
                <Input placeholder="Notlar" value={newDonation.notes} onChange={(e) => setNewDonation({ ...newDonation, notes: e.target.value })} />
                <Input placeholder="Telefon (opsiyonel)" value={newDonation.phone} onChange={(e) => setNewDonation({ ...newDonation, phone: e.target.value })} />
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Hisse:</label>
                  <Select value={String(newDonation.shareCount)} onValueChange={(v) => setNewDonation({ ...newDonation, shareCount: parseInt(v) })}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddDonation} className="w-full">Ekle</Button>
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
                <label className="text-xs text-muted-foreground">AI Kategori</label>
                <div className="flex gap-1 flex-wrap">
                  {availableAiCategories.map(cat => {
                    const isActive = filterAiCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${isActive ? "bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500" : "bg-muted hover:bg-violet-50 dark:hover:bg-violet-950"}`}
                        onClick={() => setFilterAiCategories(
                          isActive ? filterAiCategories.filter(c => c !== cat) : [...filterAiCategories, cat]
                        )}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">AI Uyarılar</label>
              <button
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${filterAiWarnings ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 ring-2 ring-red-500" : "bg-muted hover:bg-red-50 dark:hover:bg-red-950"}`}
                onClick={() => setFilterAiWarnings(!filterAiWarnings)}
              >
                Uyarılı
              </button>
            </div>
          </div>
        </Card>
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
                <Button onClick={applyBulkEdit} className="w-full">Uygula</Button>
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
                  <input type="checkbox" checked={kesim.donations.length > 0 && selectedIds.size === kesim.donations.length} onChange={toggleSelectAll} className="rounded" />
                </th>
                <th className="p-2 text-left w-8">#</th>
                <th className="p-2 text-left w-20">Vekalet</th>
                <th className="p-2 text-left cursor-pointer hover:bg-muted" onClick={() => handleSort("description")}>
                  <span className="flex items-center gap-1">
                    Vekaleti Veren
                    {sortField === "description" && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    {sortField !== "description" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </span>
                </th>
                <th className="p-2 text-left cursor-pointer hover:bg-muted" onClick={() => handleSort("name")}>
                  <span className="flex items-center gap-1">
                    Adına Kesilen
                    {sortField === "name" && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    {sortField !== "name" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </span>
                </th>
                <th className="p-2 text-left cursor-pointer hover:bg-muted w-20" onClick={() => handleSort("donationType")}>
                  <span className="flex items-center gap-1">
                    Cinsi
                    {sortField === "donationType" && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    {sortField !== "donationType" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </span>
                </th>
                <th className="p-2 text-left w-24">Notlar</th>
                <th className="p-2 text-center cursor-pointer hover:bg-muted w-16" onClick={() => handleSort("shareCount")}>
                  <span className="flex items-center gap-1 justify-center">
                    Hisse
                    {sortField === "shareCount" && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
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
                  <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} className="rounded" />
                </td>
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
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" title="Bu kişinin tüm kayıtlarını düzenle" aria-label="Bu kişinin tüm kayıtlarını düzenle" onClick={() => setPersonEditDesc(d.description)}>
                          <UserCog className="w-3 h-3 text-muted-foreground" />
                        </Button>
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
                          {(d.aiCategories || []).map(cat => (
                            <span key={cat} className="px-1.5 py-0 rounded-full text-[9px] font-medium bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">{cat}</span>
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">{effectiveShare}</span>
                  ) : (
                    <Select value={String(d.shareCount)} onValueChange={(v) => updateDonationField(d.id, "shareCount", parseInt(v))}>
                      <SelectTrigger className="h-7 w-16 text-sm mx-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
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
                            <span key={tagId} className="px-1.5 py-0 rounded-full text-[9px] font-medium text-white leading-4" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                          );
                        })}
                      </div>
                    )}
                    {globalTags.length > 0 && (
                      <Popover open={tagPopoverDonorId === d.id} onOpenChange={(open) => setTagPopoverDonorId(open ? d.id : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Etiket ata" aria-label="Etiket ata">
                            <Tag className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="end">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Etiket Ata</p>
                            {globalTags.map(tag => {
                              const isActive = (d.tags || []).includes(tag.id);
                              return (
                                <button key={tag.id} className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted transition-colors ${isActive ? "bg-muted" : ""}`} onClick={() => toggleDonationTag(d.id, tag.id)}>
                                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
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
                      <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${basketItemIds.has(d.id) ? "bg-emerald-100 dark:bg-emerald-900" : ""}`} title={basketItemIds.has(d.id) ? "Sepetten Çıkar" : "Sepete Ekle"} aria-label={basketItemIds.has(d.id) ? "Sepetten Çıkar" : "Sepete Ekle"} onClick={() => basketItemIds.has(d.id) ? removeFromBasket(d.id) : addDonorToBasket(d.id)}>
                        <ShoppingBag className={`w-3 h-3 ${basketItemIds.has(d.id) ? "text-emerald-600" : "text-muted-foreground"}`} />
                      </Button>
                    )}
                    {!d.excluded && !groupedDonorIds.has(d.id) && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Akıllı Yerleştir" aria-label="Akıllı Yerleştir" onClick={() => setSmartPlacePopover(d.id)}>
                        <Wand2 className="w-3 h-3 text-primary" />
                      </Button>
                    )}
                    {(effectiveShareMap.get(d.id) || d.shareCount) > 7 && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Hisse Böl" aria-label="Hisse Böl" onClick={() => setSplitShareDialog({ donationId: d.id, totalShares: effectiveShareMap.get(d.id) || d.shareCount })}>
                        <Scissors className="w-3 h-3 text-amber-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={d.excluded ? "Dahil et" : "Hariç tut"} aria-label={d.excluded ? "Dahil et" : "Hariç tut"} onClick={() => updateDonationField(d.id, "excluded", !d.excluded)}>
                      {d.excluded ? <Eye className="w-3 h-3 text-green-600" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Bağışçıyı sil" onClick={() => deleteDonation(d.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
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
