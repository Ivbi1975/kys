import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  X,
  FileBarChart,
  AlertTriangle,
} from "lucide-react";
import type { LocalDonation, AiResult } from "./types";

interface AiReportStats {
  totalProcessed: number;
  warningDonors: AiResult[];
  warningCount: number;
  requestCount: number;
  categoryDistribution: [string, number][];
  errorBatches: number;
}

interface AiClassificationProps {
  donations: LocalDonation[];
  notesWithContent: LocalDonation[];
  aiRunning: boolean;
  aiStopped: boolean;
  aiResults: Map<string, AiResult>;
  aiProgress: { done: number; total: number };
  showAiPanel: boolean;
  setShowAiPanel: (v: boolean) => void;
  rangeMode: "all" | "range";
  setRangeMode: (v: "all" | "range") => void;
  rangeStart: number;
  setRangeStart: (v: number) => void;
  rangeEnd: number;
  setRangeEnd: (v: number) => void;
  batchSize: number;
  setBatchSize: (v: number) => void;
  startAiClassification: () => void;
  stopAiClassification: () => void;
  showAiReport: boolean;
  setShowAiReport: (v: boolean) => void;
  aiReportCollapsed: boolean;
  setAiReportCollapsed: (v: boolean) => void;
  aiReportStats: AiReportStats;
  scrollToDonation: (donationId: string) => void;
}

export function AiClassification({
  donations, notesWithContent, aiRunning, aiStopped, aiResults, aiProgress,
  showAiPanel, setShowAiPanel, rangeMode, setRangeMode, rangeStart, setRangeStart,
  rangeEnd, setRangeEnd, batchSize, setBatchSize, startAiClassification, stopAiClassification,
  showAiReport, setShowAiReport, aiReportCollapsed, setAiReportCollapsed,
  aiReportStats, scrollToDonation,
}: AiClassificationProps) {
  const resultsCount = aiResults.size;
  const warningsCount = Array.from(aiResults.values()).filter(r => r.warnings && r.warnings.trim() !== "").length;

  return (
    <>
      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowAiPanel(!showAiPanel)}>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            AI Sınıflandırma
            {resultsCount > 0 && <Badge variant="secondary" className="text-xs">{resultsCount} sonuç</Badge>}
            {warningsCount > 0 && <Badge variant="destructive" className="text-xs">{warningsCount} uyarı</Badge>}
          </h2>
          <Button variant="ghost" size="sm">{showAiPanel ? "Gizle" : "Göster"}</Button>
        </div>

        {showAiPanel && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Aralık</label>
                <Select value={rangeMode} onValueChange={v => setRangeMode(v as "all" | "range")}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü ({notesWithContent.length} not)</SelectItem>
                    <SelectItem value="range">Aralık Seç</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {rangeMode === "range" && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Başlangıç - Bitiş</label>
                  <div className="flex items-center gap-1">
                    <Input type="number" min={1} max={donations.length} value={rangeStart} onChange={e => setRangeStart(Math.max(1, parseInt(e.target.value) || 1))} className="h-8 text-sm w-20" />
                    <span className="text-xs text-muted-foreground">-</span>
                    <Input type="number" min={1} max={donations.length} value={rangeEnd} onChange={e => setRangeEnd(Math.max(1, parseInt(e.target.value) || 1))} className="h-8 text-sm w-20" />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Batch boyutu</label>
                <Select value={String(batchSize)} onValueChange={v => setBatchSize(parseInt(v))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 not/istek</SelectItem>
                    <SelectItem value="10">10 not/istek</SelectItem>
                    <SelectItem value="25">25 not/istek</SelectItem>
                    <SelectItem value="50">50 not/istek</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!aiRunning ? (
                <Button size="sm" onClick={startAiClassification} disabled={notesWithContent.length === 0}>
                  <Play className="w-4 h-4 mr-1" />Başlat
                </Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={stopAiClassification}>
                  <Square className="w-4 h-4 mr-1" />Durdur
                </Button>
              )}
              {(aiRunning || aiProgress.total > 0) && (
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{aiRunning ? "İşleniyor..." : aiStopped ? "Durduruldu" : "Tamamlandı"}</span>
                    <span className="text-xs font-medium">{aiProgress.done} / {aiProgress.total}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: aiProgress.total > 0 ? `${(aiProgress.done / aiProgress.total) * 100}%` : "0%" }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {showAiReport && (
        <Card className="p-0 overflow-hidden border-primary/20">
          <div className="flex items-center justify-between p-3 bg-primary/5 cursor-pointer" onClick={() => setAiReportCollapsed(!aiReportCollapsed)}>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <FileBarChart className="w-4 h-4 text-primary" />
              AI Tamamlanma Raporu
              {aiStopped && <Badge variant="outline" className="text-xs">Durduruldu</Badge>}
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setAiReportCollapsed(!aiReportCollapsed); }}>
                {aiReportCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setShowAiReport(false); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {!aiReportCollapsed && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{aiReportStats.totalProcessed}</div>
                  <div className="text-xs text-muted-foreground mt-1">{aiProgress.total > aiReportStats.totalProcessed ? `Başarılı / ${aiProgress.total} toplam` : "İşlenen Not"}</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${aiReportStats.warningCount > 0 ? "bg-destructive/10" : "bg-muted/50"}`}>
                  <div className={`text-2xl font-bold ${aiReportStats.warningCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>{aiReportStats.warningCount}</div>
                  <div className="text-xs text-muted-foreground mt-1">Uyarı</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{aiReportStats.requestCount}</div>
                  <div className="text-xs text-muted-foreground mt-1">Özel İstek</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${aiReportStats.errorBatches > 0 ? "bg-destructive/10" : "bg-muted/50"}`}>
                  <div className={`text-2xl font-bold ${aiReportStats.errorBatches > 0 ? "text-destructive" : "text-muted-foreground"}`}>{aiReportStats.errorBatches}</div>
                  <div className="text-xs text-muted-foreground mt-1">Hatalı Batch</div>
                </div>
              </div>
              {aiReportStats.categoryDistribution.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2">Kategori Dağılımı</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {aiReportStats.categoryDistribution.map(([cat, count]) => (
                      <Badge key={cat} variant="secondary" className="text-xs">{cat.replace(/_/g, " ")} <span className="ml-1 font-bold">{count}</span></Badge>
                    ))}
                  </div>
                </div>
              )}
              {aiReportStats.warningCount > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Uyarılı Bağışçılar ({aiReportStats.warningCount})
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {aiReportStats.warningDonors.map(r => {
                      const donor = donations.find(d => d.id === r.donationId);
                      return (
                        <button key={r.donationId} className="w-full flex items-start gap-2 text-left p-2 rounded-md hover:bg-destructive/5 transition-colors border border-transparent hover:border-destructive/20" onClick={() => scrollToDonation(r.donationId)}>
                          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate">{donor?.description || donor?.name || r.donationId}</div>
                            <div className="text-[11px] text-destructive/80 line-clamp-2">{r.warnings}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {!showAiReport && !aiRunning && aiResults.size > 0 && (
        <Button variant="outline" size="sm" onClick={() => { setShowAiReport(true); setAiReportCollapsed(false); }} className="flex items-center gap-1">
          <FileBarChart className="w-4 h-4" />Raporu Göster
        </Button>
      )}
    </>
  );
}
