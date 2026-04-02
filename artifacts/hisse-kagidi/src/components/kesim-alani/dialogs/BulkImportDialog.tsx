import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ClipboardPaste, FileSpreadsheet, Loader2, MoveRight, Settings2, ShoppingBag, Upload } from "lucide-react";
import type { ColumnMapping } from "../hooks/useImportExport";
import { useKesimAlaniContext } from "../KesimAlaniContext";

export function BulkImportDialog() {
  const {
    addReviewRowsToBasket, applyBulkImport, bulkDialogOpen, bulkMode, bulkReviewExpanded, bulkReviewRows,
    bulkReviewTransferTarget, bulkReviewTransferring, setBulkReviewTransferTarget,
    bulkStep, COLUMN_OPTIONS, columnMappings, displayPreviewRows, fileInputRef,
    handleFileUpload, handlePasteData, hasHeaderRow, headerRow, pasteText,
    resetBulkDialog, setBulkDialogOpen, setBulkMode, setBulkReviewExpanded,
    setBulkReviewRows, setBulkStep, setColumnMappings, setHasHeaderRow, setPasteText,
    siblingKesimAlanlari, transferReviewRowsToKesimAlani,
  } = useKesimAlaniContext();

  const excludedCount = bulkReviewRows.filter(r => !r.selected).length;

  return (
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
              <Button variant={bulkMode === "upload" ? "default" : "outline"} size="sm" onClick={() => setBulkMode("upload")} className="flex-1">
                <FileSpreadsheet className="w-4 h-4 mr-1" />Excel Yükle
              </Button>
              <Button variant={bulkMode === "paste" ? "default" : "outline"} size="sm" onClick={() => setBulkMode("paste")} className="flex-1">
                <ClipboardPaste className="w-4 h-4 mr-1" />Kopyala Yapıştır
              </Button>
            </div>
            {bulkMode === "upload" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Excel dosyanızı (.xlsx, .xls) seçin. İlk sayfa okunacaktır.</p>
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">Excel dosyası seçmek için tıklayın</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv desteklenir</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
              </div>
            )}
            {bulkMode === "paste" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Excel'den kopyaladığınız verileri aşağıya yapıştırın. Bir sonraki adımda hangi sütunun ne olduğunu belirleyeceksiniz.</p>
                <textarea className="w-full h-48 p-3 border rounded-md bg-background text-foreground font-mono text-sm resize-none" placeholder={"Ali Yılmaz\tAnkara\tAdak\t1\nMehmet Kaya\tİstanbul\tKurban\t3\nAyşe Demir\tBursa\tAkika\t2"} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
                <Button onClick={handlePasteData} className="w-full" disabled={!pasteText.trim()}>Devam Et</Button>
              </div>
            )}
          </div>
        )}

        {bulkStep === "review" && (() => {
          const groupKeys = [...new Set(bulkReviewRows.map(r => r.groupKey))];
          const includedGroupCount = groupKeys.filter(gk => bulkReviewRows.filter(r => r.groupKey === gk).some(r => r.selected)).length;
          return (
            <div className="flex flex-col min-h-0 flex-1 pt-4">
              <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg mb-4 flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <p className="text-sm">Aşağıdaki vekaleti verenlerin toplam hisse sayısı 50'den fazla. Dahil etmek istediklerinizi işaretli bırakın, istemediğinizin işaretini kaldırın.</p>
              </div>
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => setBulkReviewRows(prev => prev.map(r => ({ ...r, selected: true })))}>Tümünü Seç</Button>
                <Button variant="outline" size="sm" onClick={() => setBulkReviewRows(prev => prev.map(r => ({ ...r, selected: false })))}>Tümünü Kaldır</Button>
                <span className="text-xs text-muted-foreground ml-auto">{includedGroupCount} / {groupKeys.length} grup dahil edilecek</span>
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
                          <input type="checkbox" checked={allSelected} onChange={() => { const newSel = !allSelected; setBulkReviewRows(prev => prev.map(r => r.groupKey === gk ? { ...r, selected: newSel } : r)); }} className="rounded" />
                          <button className="flex-1 text-left text-sm" onClick={() => setBulkReviewExpanded(prev => { const s = new Set(prev); isExpanded ? s.delete(gk) : s.add(gk); return s; })}>
                            <span className="font-semibold">{descLabel}</span>
                            <span className="text-muted-foreground ml-2 text-xs">({groupRows.length} satır, toplam {groupTotal} hisse)</span>
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="ml-6 mt-1">
                            <table className="w-full text-xs">
                              <thead><tr className="border-b bg-muted/30"><th className="p-1.5 pl-10 w-10 text-center text-xs font-medium text-muted-foreground">Dahil</th><th className="p-1.5 text-left text-xs font-medium text-muted-foreground">Adına Kesilen</th><th className="p-1.5 text-left text-xs font-medium text-muted-foreground">Cinsi</th><th className="p-1.5 text-right text-xs font-medium text-muted-foreground">Hisse</th></tr></thead>
                              <tbody>
                                {groupRows.map((item) => {
                                  const globalIdx = bulkReviewRows.indexOf(item);
                                  const nameColIdx = columnMappings.indexOf("name");
                                  const typeColIdx = columnMappings.indexOf("donationType");
                                  const name = nameColIdx >= 0 ? String(item.row[nameColIdx] ?? "").trim() : "";
                                  const dtype = typeColIdx >= 0 ? String(item.row[typeColIdx] ?? "").trim() : "";
                                  return (
                                    <tr key={item.idx} className={`border-b last:border-0 ${!item.selected ? "bg-red-500/5 text-muted-foreground line-through" : ""}`}>
                                      <td className="p-1.5 pl-10 text-center"><input type="checkbox" checked={item.selected} onChange={() => { setBulkReviewRows(prev => prev.map((r, ri) => ri === globalIdx ? { ...r, selected: !r.selected } : r)); }} className="rounded" /></td>
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

              {excludedCount > 0 && (
                <div className="border rounded-lg p-3 mt-3 bg-muted/30 flex-shrink-0 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{excludedCount} hariç tutulan satır için işlem:</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={addReviewRowsToBasket}>
                      <ShoppingBag className="w-3.5 h-3.5 mr-1" />
                      Hariç Tutulanları Sepete Ekle
                    </Button>
                    {siblingKesimAlanlari.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Select value={bulkReviewTransferTarget} onValueChange={setBulkReviewTransferTarget}>
                          <SelectTrigger className="h-8 text-xs flex-1 min-w-[160px]">
                            <SelectValue placeholder="Kesim listesi seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            {siblingKesimAlanlari.map(ka => (
                              <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={transferReviewRowsToKesimAlani}
                          disabled={!bulkReviewTransferTarget || bulkReviewTransferring}
                        >
                          {bulkReviewTransferring ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <MoveRight className="w-3.5 h-3.5 mr-1" />}
                          Listeye Aktar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 flex-shrink-0">
                <Button variant="outline" onClick={() => setBulkStep("mapping")} className="flex-1">Geri</Button>
                <Button onClick={applyBulkImport} className="flex-1">
                  {excludedCount > 0 ? `${excludedCount} Satırı Hariç Tut ve Devam Et` : "Tümünü Dahil Et ve Devam Et"}
                </Button>
              </div>
            </div>
          );
        })()}

        {bulkStep === "mapping" && (
          <div className="flex flex-col min-h-0 flex-1 pt-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4 flex-shrink-0">
              <Settings2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">Her sütunun hangi bilgiye karşılık geldiğini aşağıdan seçin. Kullanmak istemediğiniz sütunları "Atla" olarak ayarlayın.</p>
            </div>
            <div className="flex items-center gap-2 mb-4 flex-shrink-0">
              <input type="checkbox" id="hasHeader" checked={hasHeaderRow} onChange={(e) => setHasHeaderRow(e.target.checked)} className="rounded" />
              <label htmlFor="hasHeader" className="text-sm font-medium">İlk satır başlık satırıdır (veri olarak eklenmez)</label>
            </div>
            <div className="border rounded-lg overflow-hidden min-h-0 flex-1">
              <div className="overflow-auto max-h-full">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-primary/10 border-b">
                      {columnMappings.map((mapping, colIdx) => (
                        <th key={colIdx} className="p-2 min-w-[140px]">
                          <Select value={mapping} onValueChange={(v) => { const newMappings = [...columnMappings]; newMappings[colIdx] = v as ColumnMapping; setColumnMappings(newMappings); }}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{COLUMN_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                          </Select>
                        </th>
                      ))}
                    </tr>
                    {headerRow && (
                      <tr className="bg-muted/30 border-b">
                        {headerRow.map((cell, idx) => (<td key={idx} className="p-2 text-xs text-muted-foreground font-medium">{cell || "—"}</td>))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {displayPreviewRows.slice(0, 5).map((row, rIdx) => (
                      <tr key={rIdx} className="border-b">
                        {columnMappings.map((mapping, cIdx) => (<td key={cIdx} className={`p-2 text-xs ${mapping === "skip" ? "text-muted-foreground/40 line-through" : ""}`}>{row[cIdx] || "—"}</td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {displayPreviewRows.length > 5 && (
                <div className="p-2 text-xs text-muted-foreground text-center bg-muted/20">... ve {displayPreviewRows.length - 5} satır daha (toplam {displayPreviewRows.length} satır)</div>
              )}
            </div>
            <div className="flex gap-2 pt-4 flex-shrink-0">
              <Button variant="outline" onClick={() => setBulkStep("input")} className="flex-1">Geri</Button>
              <Button onClick={applyBulkImport} className="flex-1">{displayPreviewRows.length} Bağışçı Ekle</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
