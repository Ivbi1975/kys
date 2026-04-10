import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, ClipboardPaste, Upload, Settings2, Loader2, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  bulkImportDonations, checkVekaletConflicts,
} from "@/lib/api";
import type { ImportDonationPayload } from "@/lib/api/bagis-havuzu";
import { ApiFetchError } from "@/lib/api/core";
import { autoMapColumns, POOL_COLUMN_OPTIONS, type ColumnMapping } from "./types";
import { parseExcelInWorker } from "@/lib/excel.worker.client";
import { VekaletConflictDialog, categorizeConflicts, type ConflictRow } from "./VekaletConflictDialog";

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

export function ImportWizard({ open, onOpenChange, projectId, onSuccess }: ImportWizardProps) {
  const { toast } = useToast();
  const [importStep, setImportStep] = useState<"input" | "mapping">("input");
  const [importMode, setImportMode] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [conflictRows, setConflictRows] = useState<ConflictRow[]>([]);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const conflictResolveRef = useRef<((proceed: boolean) => void) | null>(null);

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

  function buildDonationsFromRows(rows: string[][]): ImportDonationPayload[] {
    return rows.map((row): ImportDonationPayload => {
      const d: ImportDonationPayload = {
        id: crypto.randomUUID(), name: "", description: "", donationType: "",
        shareCount: 1, vekalet: "", notes: "", phone: "", birim: "", temsilci: "",
        ozellik: "", fiyat: "", yerTalebi: "", gunTalebi: "", ilkHayvan: "", safi: "",
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
        } else {
          const key = mapping as keyof ImportDonationPayload;
          if (key in d && key !== "id" && key !== "shareCount") {
            (d as Record<string, unknown>)[key] = val;
          }
        }
      }
      d.notes = notesParts.join(" | ");
      return d;
    }).filter((d) => d.name);
  }

  function getErrorMessage(err: unknown): string {
    if (err instanceof ApiFetchError) {
      if (err.details && err.details.length > 0) {
        const detail = err.details[0];
        if (detail.message?.includes("too_big") || detail.message?.includes("at most")) {
          return "Çok fazla satır var. Lütfen daha küçük dosyalar halinde yükleyin.";
        }
        if (detail.path) {
          return `Veri hatası (${detail.path.join(".")}): ${detail.message}`;
        }
        return detail.message || err.message;
      }
      return err.message;
    }
    if (err instanceof Error) {
      if (err.message === "Failed to fetch" || err.message.includes("NetworkError")) {
        return "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.";
      }
      return err.message;
    }
    return String(err);
  }

  const handleImport = useCallback(async () => {
    if (displayPreviewRows.length === 0) {
      toast({ title: "Yüklenecek veri bulunamadı", variant: "destructive" });
      return;
    }
    setImporting(true);
    setImportProgress("Veriler hazırlanıyor...");
    try {
      const donations = buildDonationsFromRows(displayPreviewRows);

      if (donations.length === 0) {
        toast({ title: "İsim sütunu eşleştirilmemiş veya boş", variant: "destructive" });
        setImporting(false);
        setImportProgress("");
        return;
      }

      setImportProgress("Vekalet kontrolleri yapılıyor...");
      const vekaletValues = donations.map(d => d.vekalet).filter(Boolean);
      if (vekaletValues.length > 0) {
        try {
          const { conflicts } = await checkVekaletConflicts(projectId, vekaletValues);
          if (conflicts.length > 0) {
            const rows = categorizeConflicts(conflicts, donations);
            const proceed = await new Promise<boolean>((resolve) => {
              conflictResolveRef.current = resolve;
              setConflictRows(rows);
              setConflictDialogOpen(true);
            });
            if (!proceed) {
              setImporting(false);
              setImportProgress("");
              return;
            }
          }
        } catch (vekaletErr) {
          console.error("Vekalet check error:", vekaletErr);
          const proceed = window.confirm(
            "Vekalet kontrolü sırasında bir hata oluştu. Kontrol atlanarak devam edilsin mi?"
          );
          if (!proceed) {
            setImporting(false);
            setImportProgress("");
            return;
          }
        }
      }

      setImportProgress(`${donations.length} bağış yükleniyor...`);
      const result = await bulkImportDonations(projectId, donations, (inserted, total, chunkIdx, totalChunks) => {
        if (totalChunks > 1) {
          setImportProgress(`Yükleniyor: ${inserted}/${total} (parça ${chunkIdx}/${totalChunks})`);
        }
      });
      toast({ title: `${result.inserted} bağış başarıyla eklendi` });
      resetImport();
      onSuccess();
    } catch (err) {
      console.error("Bulk import error:", err);
      const msg = getErrorMessage(err);
      toast({ title: "Yükleme başarısız", description: msg, variant: "destructive" });
    } finally {
      setImporting(false);
      setImportProgress("");
    }
  }, [displayPreviewRows, columnMappings, projectId, toast, onSuccess]);

  function handleConflictResolve(proceed: boolean) {
    setConflictDialogOpen(false);
    setConflictRows([]);
    conflictResolveRef.current?.(proceed);
    conflictResolveRef.current = null;
  }

  function resetImport() {
    if (conflictResolveRef.current) {
      conflictResolveRef.current(false);
      conflictResolveRef.current = null;
    }
    setConflictDialogOpen(false);
    setConflictRows([]);
    onOpenChange(false);
    setImportStep("input");
    setImportMode("upload");
    setPasteText("");
    setPreviewData([]);
    setColumnMappings([]);
    setHasHeaderRow(true);
  }

  return (
    <>
    <VekaletConflictDialog
      open={conflictDialogOpen}
      conflicts={conflictRows}
      onProceed={() => handleConflictResolve(true)}
      onCancel={() => handleConflictResolve(false)}
    />
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
            {importing && importProgress && (
              <div className="p-2 text-sm text-center text-muted-foreground bg-blue-50 dark:bg-blue-950/30 rounded-md">
                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                {importProgress}
              </div>
            )}
            <div className="flex gap-2 pt-4 flex-shrink-0">
              <Button variant="outline" onClick={() => setImportStep("input")} className="flex-1" disabled={importing}>Geri</Button>
              <Button onClick={handleImport} className="flex-1" disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                {importing ? "Yükleniyor..." : `${displayPreviewRows.length} Bağış Yükle`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
