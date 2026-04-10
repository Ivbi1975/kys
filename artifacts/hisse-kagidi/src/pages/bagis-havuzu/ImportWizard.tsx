import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, ClipboardPaste, Upload, Settings2, Loader2, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  bulkImportDonations, checkVekaletConflicts,
} from "@/lib/api";
import { autoMapColumns, POOL_COLUMN_OPTIONS, type ColumnMapping } from "./types";
import { parseExcelInWorker } from "@/lib/excel.worker.client";

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  kesimAlanlari: { id: string; name: string }[];
  onSuccess: () => void;
}

export function ImportWizard({ open, onOpenChange, projectId, kesimAlanlari, onSuccess }: ImportWizardProps) {
  const { toast } = useToast();
  const [importStep, setImportStep] = useState<"input" | "mapping">("input");
  const [importMode, setImportMode] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [importTargetKA, setImportTargetKA] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function processRawData(rows: string[][]) {
    setPreviewData(rows);
    const colCount = Math.max(...rows.map(r => r.length));
    if (rows.length > 0 && hasHeaderRow) {
      const headers = rows[0].map(cell => String(cell ?? "").trim());
      const smartMappings = autoMapColumns(headers);
      while (smartMappings.length < colCount) smartMappings.push("skip");
      setColumnMappings(smartMappings);
    } else {
      const defaultMappings: ColumnMapping[] = [];
      const defaults: ColumnMapping[] = ["vekalet", "description", "name", "donationType", "shareCount", "notes"];
      for (let i = 0; i < colCount; i++) {
        defaultMappings.push(i < defaults.length ? defaults[i] : "skip");
      }
      setColumnMappings(defaultMappings);
    }
    setImportStep("mapping");
  }

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseExcelInWorker(file);
      if (rows.length > 0) processRawData(rows);
    } catch {
      toast({ title: "Excel dosyası okunamadı", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [toast, hasHeaderRow]);

  const handlePasteData = useCallback(() => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split("\n");
    const rows = lines.map(line => line.split("\t").map(c => c.trim()));
    processRawData(rows);
  }, [pasteText, hasHeaderRow]);

  const displayPreviewRows = useMemo(() => {
    if (previewData.length === 0) return [];
    return hasHeaderRow ? previewData.slice(1) : previewData;
  }, [previewData, hasHeaderRow]);

  const headerRow = useMemo(() => {
    if (!hasHeaderRow || previewData.length === 0) return null;
    return previewData[0];
  }, [hasHeaderRow, previewData]);

  const handleImport = useCallback(async () => {
    if (!importTargetKA || displayPreviewRows.length === 0) {
      toast({ title: "Hedef kesim listesi seçin", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      interface ImportDonation {
        id: string; name: string; description: string; donationType: string;
        shareCount: number; vekalet: string; notes: string; phone: string;
        birim: string; temsilci: string; ozellik: string; fiyat: string;
        yerTalebi: string; gunTalebi: string; ilkHayvan: string; safi: string;
        kesimAlaniId: string;
      }
      const donations = displayPreviewRows.map((row): ImportDonation => {
        const d: ImportDonation = {
          id: crypto.randomUUID(), name: "", description: "", donationType: "",
          shareCount: 1, vekalet: "", notes: "", phone: "", birim: "", temsilci: "",
          ozellik: "", fiyat: "", yerTalebi: "", gunTalebi: "", ilkHayvan: "", safi: "",
          kesimAlaniId: importTargetKA,
        };
        const notesParts: string[] = [];
        for (let c = 0; c < columnMappings.length; c++) {
          const mapping = columnMappings[c];
          const val = String(row[c] ?? "").trim();
          if (mapping === "skip" || !val) continue;
          if (mapping === "shareCount") {
            d.shareCount = Math.max(1, parseInt(val, 10) || 1);
          } else if (mapping === "notes") {
            notesParts.push(val);
          } else if (mapping === "name") {
            d.name = val;
          } else if (mapping === "description") {
            d.description = val;
          } else if (mapping === "donationType") {
            d.donationType = val;
          } else if (mapping === "vekalet") {
            d.vekalet = val;
          } else if (mapping === "phone") {
            d.phone = val;
          } else if (mapping === "birim") {
            d.birim = val;
          } else if (mapping === "temsilci") {
            d.temsilci = val;
          } else if (mapping === "ozellik") {
            d.ozellik = val;
          } else if (mapping === "fiyat") {
            d.fiyat = val;
          } else if (mapping === "yerTalebi") {
            d.yerTalebi = val;
          } else if (mapping === "gunTalebi") {
            d.gunTalebi = val;
          } else if (mapping === "ilkHayvan") {
            d.ilkHayvan = val;
          } else if (mapping === "safi") {
            d.safi = val;
          }
        }
        d.notes = notesParts.join(" | ");
        return d;
      }).filter((d: ImportDonation) => d.name);

      if (donations.length === 0) {
        toast({ title: "İsim sütunu eşleştirilmemiş veya boş", variant: "destructive" });
        setImporting(false);
        return;
      }

      const vekaletValues = donations.map(d => d.vekalet).filter(Boolean);
      if (vekaletValues.length > 0) {
        const { conflicts } = await checkVekaletConflicts(projectId, vekaletValues);
        if (conflicts.length > 0) {
          const uniqueConflicts = new Set(conflicts.map(c => c.vekalet));
          const proceed = window.confirm(
            `Dikkat: ${uniqueConflicts.size} vekalet numarası zaten başka yerlerde mevcut:\n${[...uniqueConflicts].slice(0, 10).join(", ")}${uniqueConflicts.size > 10 ? ` ve ${uniqueConflicts.size - 10} adet daha...` : ""}\n\nDevam etmek istiyor musunuz?`
          );
          if (!proceed) {
            setImporting(false);
            return;
          }
        }
      }

      const result = await bulkImportDonations(projectId, donations);
      toast({ title: `${result.inserted} bağış eklendi` });
      resetImport();
      onSuccess();
    } catch (err) {
      toast({ title: "Yükleme başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }, [importTargetKA, displayPreviewRows, columnMappings, projectId, toast, onSuccess]);

  function resetImport() {
    onOpenChange(false);
    setImportStep("input");
    setImportMode("upload");
    setPasteText("");
    setPreviewData([]);
    setColumnMappings([]);
    setHasHeaderRow(true);
    setImportTargetKA("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetImport(); else onOpenChange(true); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{importStep === "input" ? "Toplu Bağış Yükle" : "Sütun Eşleştirme"}</DialogTitle>
        </DialogHeader>

        {importStep === "input" && (
          <div className="space-y-4 pt-4">
            <div className="flex gap-2">
              <Button variant={importMode === "upload" ? "default" : "outline"} size="sm" onClick={() => setImportMode("upload")} className="flex-1">
                <FileSpreadsheet className="w-4 h-4 mr-1" />Excel Yükle
              </Button>
              <Button variant={importMode === "paste" ? "default" : "outline"} size="sm" onClick={() => setImportMode("paste")} className="flex-1">
                <ClipboardPaste className="w-4 h-4 mr-1" />Kopyala Yapıştır
              </Button>
            </div>
            {importMode === "upload" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Excel dosyanızı (.xlsx, .xls, .csv) seçin.</p>
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">Excel dosyası seçmek için tıklayın</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv desteklenir</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
              </div>
            )}
            {importMode === "paste" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Excel'den kopyaladığınız verileri yapıştırın.</p>
                <textarea className="w-full h-48 p-3 border rounded-md bg-background text-foreground font-mono text-sm resize-none" placeholder={"Ali Yılmaz\tAnkara\tAdak\t1"} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
                <Button onClick={handlePasteData} className="w-full" disabled={!pasteText.trim()}>Devam Et</Button>
              </div>
            )}
          </div>
        )}

        {importStep === "mapping" && (
          <div className="flex flex-col min-h-0 flex-1 pt-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-3 flex-shrink-0">
              <Settings2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">Her sütunun hangi bilgiye karşılık geldiğini seçin.</p>
            </div>
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <input type="checkbox" id="poolHasHeader" checked={hasHeaderRow} onChange={(e) => setHasHeaderRow(e.target.checked)} className="rounded" />
              <label htmlFor="poolHasHeader" className="text-sm font-medium">İlk satır başlık satırıdır</label>
            </div>

            <div className="mb-3 flex-shrink-0">
              <label className="text-sm font-medium mb-1 block">Hedef Kesim Listesi</label>
              <Select value={importTargetKA} onValueChange={setImportTargetKA}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Yüklenecek kesim listesini seçin..." /></SelectTrigger>
                <SelectContent>
                  {kesimAlanlari.map(ka => (
                    <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg overflow-hidden min-h-0 flex-1">
              <div className="overflow-auto max-h-full thick-scrollbar">
                <table className="w-full text-sm" style={{ minWidth: columnMappings.length * 150 + "px" }}>
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-primary/10 border-b">
                      {columnMappings.map((mapping, colIdx) => (
                        <th key={colIdx} className={`p-2 min-w-[140px] ${mapping === "skip" ? "bg-orange-100 dark:bg-orange-950/40" : ""}`}>
                          <Select value={mapping} onValueChange={(v) => { const m = [...columnMappings]; m[colIdx] = v as ColumnMapping; setColumnMappings(m); }}>
                            <SelectTrigger className={`h-8 text-xs ${mapping === "skip" ? "border-orange-400 bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 font-semibold" : ""}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 overflow-y-auto">
                              {POOL_COLUMN_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.value === "skip" ? <span className="text-orange-600 font-semibold flex items-center gap-1"><Ban className="w-3.5 h-3.5" />{opt.label}</span> : opt.label}
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
                          <td key={idx} className={`p-2 text-xs text-muted-foreground font-medium ${columnMappings[idx] === "skip" ? "bg-orange-50/50 dark:bg-orange-950/20" : ""}`}>{cell || "—"}</td>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {displayPreviewRows.slice(0, 5).map((row, rIdx) => (
                      <tr key={rIdx} className="border-b">
                        {columnMappings.map((mapping, cIdx) => (
                          <td key={cIdx} className={`p-2 text-xs ${mapping === "skip" ? "text-orange-400/60 line-through bg-orange-50/30 dark:bg-orange-950/10" : ""}`}>{row[cIdx] || "—"}</td>
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
              <Button variant="outline" onClick={() => setImportStep("input")} className="flex-1">Geri</Button>
              <Button onClick={handleImport} className="flex-1" disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                {displayPreviewRows.length} Bağış Yükle
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
