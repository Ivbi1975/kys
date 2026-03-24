import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Search,
  Replace,
  Trash2,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  Square,
  Settings2,
  X,
  Undo2,
  Redo2,
  FileBarChart,
  ChevronDown,
  ChevronUp,
  Home,
  ChevronRight,
} from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import type { AiClassificationResult } from "@/lib/api";
import {
  fetchKesimAlani,
  fetchProjects,
  bulkUpdateNotes,
  classifyNotes,
  saveAiClassifications,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LocalDonation {
  id: string;
  name: string;
  description: string;
  donationType: string;
  vekalet: string;
  notes: string;
}

interface AiResult extends AiClassificationResult {
  donationType?: string;
}

const MAX_HISTORY = 50;

export default function NotDuzenlemePage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [donations, setDonations] = useState<LocalDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);

  const historyRef = useRef<LocalDonation[][]>([]);
  const historyIndexRef = useRef(-1);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const updateHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplaceBar, setShowReplaceBar] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [aiRunning, setAiRunning] = useState(false);
  const [aiStopped, setAiStopped] = useState(false);
  const aiStopRef = useRef(false);
  const [aiResults, setAiResults] = useState<Map<string, AiResult>>(new Map());
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [aiSaveStatus, setAiSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [batchSize, setBatchSize] = useState(25);
  const [rangeMode, setRangeMode] = useState<"all" | "range">("all");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(50);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiErrorBatches, setAiErrorBatches] = useState(0);
  const [showAiReport, setShowAiReport] = useState(false);
  const [aiReportCollapsed, setAiReportCollapsed] = useState(false);

  const pushHistory = useCallback((newDonations: LocalDonation[]) => {
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    trimmed.push(newDonations);
    if (trimmed.length > MAX_HISTORY) trimmed.shift();
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
    updateHistoryState();
  }, [updateHistoryState]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setDonations(historyRef.current[historyIndexRef.current]);
    setDirty(true);
    updateHistoryState();
  }, [updateHistoryState]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setDonations(historyRef.current[historyIndexRef.current]);
    setDirty(true);
    updateHistoryState();
  }, [updateHistoryState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable;
      if (isEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    if (!params.id) return;
    fetchKesimAlani(params.id).then(async (data) => {
      if (!data) {
        toast({ title: "Hata", description: "Kesim alanı bulunamadı", variant: "destructive" });
        setLocation("/");
        return;
      }
      setKesim(data);
      if (data.projectId) {
        try {
          const projects = await fetchProjects();
          const proj = projects.find(p => p.id === data.projectId);
          if (proj) setProjectName(proj.name);
        } catch {}
      }
      const allDonations: LocalDonation[] = [];
      for (const d of data.donations) {
        if (!allDonations.find(x => x.id === d.id)) {
          allDonations.push({ id: d.id, name: d.name, description: d.description, donationType: d.donationType, vekalet: d.vekalet, notes: d.notes });
        }
      }
      for (const g of data.animalGroups) {
        for (const d of g.donations) {
          if (!allDonations.find(x => x.id === d.id)) {
            allDonations.push({ id: d.id, name: d.name, description: d.description, donationType: d.donationType, vekalet: d.vekalet, notes: d.notes });
          }
        }
      }
      setDonations(allDonations);
      historyRef.current = [allDonations];
      historyIndexRef.current = 0;
      updateHistoryState();
      setLoading(false);
    });
  }, [params.id]);

  const filteredDonations = donations.filter(d => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.notes.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );
  });

  const updateDonationsWithHistory = useCallback((updater: (prev: LocalDonation[]) => LocalDonation[]) => {
    setDonations(prev => {
      const next = updater(prev);
      pushHistory(next);
      setDirty(true);
      return next;
    });
  }, [pushHistory]);

  const handleNoteChange = (id: string, value: string) => {
    setDonations(prev => prev.map(d => d.id === id ? { ...d, notes: value } : d));
    setDirty(true);
  };

  const commitNoteChange = useCallback((id: string) => {
    setDonations(prev => {
      pushHistory(prev);
      return prev;
    });
  }, [pushHistory]);

  const handleBulkReplace = () => {
    if (!findText.trim()) return;
    let count = 0;
    updateDonationsWithHistory(prev => prev.map(d => {
      if (d.notes.includes(findText)) {
        count++;
        return { ...d, notes: d.notes.replaceAll(findText, replaceText) };
      }
      return d;
    }));
    if (count > 0) {
      toast({ title: "Değiştirildi", description: `${count} bağışçıda "${findText}" → "${replaceText}" değiştirildi` });
    } else {
      toast({ title: "Bulunamadı", description: `"${findText}" metni hiçbir notta bulunamadı` });
    }
  };

  const handleBulkDeleteNotes = () => {
    const targets = filteredDonations.filter(d => d.notes.trim() !== "");
    if (targets.length === 0) {
      toast({ title: "Silinecek not yok" });
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const confirmBulkDeleteNotes = () => {
    const targetIds = new Set(filteredDonations.map(d => d.id));
    updateDonationsWithHistory(prev => prev.map(d => targetIds.has(d.id) ? { ...d, notes: "" } : d));
    toast({ title: "Notlar silindi", description: `${targetIds.size} bağışçının notu temizlendi` });
  };

  const handleSave = async () => {
    if (!kesim) return;
    setSaving(true);
    try {
      const updates = donations
        .filter(d => {
          const orig = kesim.donations.find(x => x.id === d.id) ||
            kesim.animalGroups.flatMap(g => g.donations).find(x => x.id === d.id);
          return orig && orig.notes !== d.notes;
        })
        .map(d => ({ donationId: d.id, notes: d.notes }));

      if (updates.length === 0) {
        toast({ title: "Değişiklik yok" });
        setSaving(false);
        setDirty(false);
        return;
      }

      await bulkUpdateNotes(kesim.id, updates);
      setDirty(false);
      toast({ title: "Kaydedildi", description: `${updates.length} bağışçının notu güncellendi` });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Kaydetme hatası", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const notesWithContent = donations.filter(d => d.notes.trim() !== "");

  const startAiClassification = async () => {
    if (!kesim) return;
    aiStopRef.current = false;
    setAiRunning(true);
    setAiStopped(false);
    setAiResults(new Map());
    setAiSaveStatus("idle");
    setAiErrorBatches(0);
    setShowAiReport(false);
    setAiReportCollapsed(false);

    let toProcess: LocalDonation[];
    if (rangeMode === "all") {
      toProcess = donations;
    } else {
      const start = Math.max(1, rangeStart) - 1;
      const end = Math.min(donations.length, rangeEnd);
      toProcess = donations.slice(start, end);
    }
    const withNotes = toProcess.filter(d => d.notes.trim() !== "");

    if (withNotes.length === 0) {
      toast({ title: "İşlenecek not yok", description: "Notu olan bağışçı bulunamadı" });
      setAiRunning(false);
      return;
    }

    setAiProgress({ done: 0, total: withNotes.length });

    const batches: LocalDonation[][] = [];
    for (let i = 0; i < withNotes.length; i += batchSize) {
      batches.push(withNotes.slice(i, i + batchSize));
    }

    let done = 0;
    let errorCount = 0;
    for (const batch of batches) {
      if (aiStopRef.current) {
        setAiStopped(true);
        break;
      }

      try {
        const { results } = await classifyNotes(batch.map(d => ({
          id: d.id,
          name: d.name || d.description,
          donationType: d.donationType,
          vekalet: d.vekalet,
          notes: d.notes,
        })));

        setAiResults(prev => {
          const next = new Map(prev);
          for (const r of results) {
            next.set(r.donationId, { ...r, donationType: batch.find(d => d.id === r.donationId)?.donationType });
          }
          return next;
        });

        try {
          setAiSaveStatus("saving");
          await saveAiClassifications(results.map(r => ({
            donationId: r.donationId,
            categories: r.categories || [],
            warnings: r.warnings || "",
          })));
          setAiSaveStatus("saved");
        } catch {
          setAiSaveStatus("error");
        }

        done += batch.length;
        setAiProgress({ done, total: withNotes.length });

        if (batch !== batches[batches.length - 1] && !aiStopRef.current) {
          await new Promise(res => setTimeout(res, 1000));
        }
      } catch (err) {
        errorCount++;
        setAiErrorBatches(errorCount);
        const msg = err instanceof Error ? err.message : "Sınıflandırma hatası";
        toast({
          title: "AI Batch Hatası",
          description: `Batch ${Math.floor(done / batchSize) + 1} hata verdi: ${msg}. Diğer batch'lere devam ediliyor.`,
          variant: "destructive",
        });
        done += batch.length;
        setAiProgress({ done, total: withNotes.length });

        if (batch !== batches[batches.length - 1] && !aiStopRef.current) {
          await new Promise(res => setTimeout(res, 1000));
        }
      }
    }

    if (errorCount > 0 && !aiStopRef.current) {
      toast({
        title: "AI Tamamlandı (Hatalarla)",
        description: `${errorCount} batch hata verdi, geri kalanı başarıyla işlendi.`,
        variant: "destructive",
      });
    }

    setAiRunning(false);
    setShowAiReport(true);
    setAiReportCollapsed(false);
  };

  const stopAiClassification = () => {
    aiStopRef.current = true;
    setAiStopped(true);
  };

  const scrollToDonation = (donationId: string) => {
    let row = document.querySelector(`[data-donation-id="${donationId}"]`);
    if (!row && searchQuery) {
      setSearchQuery("");
      requestAnimationFrame(() => {
        setTimeout(() => {
          row = document.querySelector(`[data-donation-id="${donationId}"]`);
          if (row) {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
            row.classList.add("ring-2", "ring-primary", "ring-offset-2");
            setTimeout(() => {
              row!.classList.remove("ring-2", "ring-primary", "ring-offset-2");
            }, 2000);
          }
        }, 100);
      });
      return;
    }
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.add("ring-2", "ring-primary", "ring-offset-2");
      setTimeout(() => {
        row!.classList.remove("ring-2", "ring-primary", "ring-offset-2");
      }, 2000);
    }
  };

  const aiReportStats = (() => {
    const results = Array.from(aiResults.values());
    const totalProcessed = results.length;
    const withWarnings = results.filter(r => r.warnings && r.warnings.trim() !== "");
    const withRequests = results.filter(r => r.requests && r.requests.trim() !== "");
    const categoryMap = new Map<string, number>();
    for (const r of results) {
      if (r.categories) {
        for (const cat of r.categories) {
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
        }
      }
    }
    const categoryDistribution = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1]);

    return {
      totalProcessed,
      warningDonors: withWarnings,
      warningCount: withWarnings.length,
      requestCount: withRequests.length,
      categoryDistribution,
      errorBatches: aiErrorBatches,
    };
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const resultsCount = aiResults.size;
  const warningsCount = Array.from(aiResults.values()).filter(r => r.warnings && r.warnings.trim() !== "").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex flex-col gap-1 p-3">
          <nav className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
            <button onClick={() => setLocation("/")} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="w-3 h-3" />
              <span>Ana Sayfa</span>
            </button>
            {kesim?.projectId && projectName && (
              <>
                <ChevronRight className="w-3 h-3" />
                <button onClick={() => setLocation(`/proje/${kesim.projectId}`)} className="hover:text-foreground transition-colors truncate max-w-[120px]">
                  {projectName}
                </button>
              </>
            )}
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => setLocation(`/kesim/${params.id}`)} className="hover:text-foreground transition-colors truncate max-w-[120px]">
              {kesim?.name || "Kesim Alanı"}
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Notlar</span>
          </nav>
          <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">Not Düzenleme</h1>
            <p className="text-xs text-muted-foreground truncate">{kesim?.name} — {donations.length} bağışçı, {notesWithContent.length} notu olan</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={!historyState.canUndo}
              title="Geri Al (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redo}
              disabled={!historyState.canRedo}
              title="İleri Al (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/ai-prompt-ayarlari`)}
            >
              <Settings2 className="w-4 h-4 mr-1" />
              AI Ayarları
            </Button>
            {dirty && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Kaydet
              </Button>
            )}
          </div>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-6xl mx-auto space-y-4">
        <Card className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Notlarda ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReplaceBar(!showReplaceBar)}
            >
              <Replace className="w-4 h-4 mr-1" />
              Değiştir
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDeleteNotes}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Notları Sil
            </Button>
          </div>

          {showReplaceBar && (
            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="Bul..."
                value={findText}
                onChange={e => setFindText(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Değiştir..."
                value={replaceText}
                onChange={e => setReplaceText(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={handleBulkReplace}>
                Tümünü Değiştir
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-3 space-y-3">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowAiPanel(!showAiPanel)}
          >
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              AI Sınıflandırma
              {resultsCount > 0 && (
                <Badge variant="secondary" className="text-xs">{resultsCount} sonuç</Badge>
              )}
              {warningsCount > 0 && (
                <Badge variant="destructive" className="text-xs">{warningsCount} uyarı</Badge>
              )}
            </h2>
            <Button variant="ghost" size="sm">
              {showAiPanel ? "Gizle" : "Göster"}
            </Button>
          </div>

          {showAiPanel && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Aralık</label>
                  <Select
                    value={rangeMode}
                    onValueChange={v => setRangeMode(v as "all" | "range")}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
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
                      <Input
                        type="number"
                        min={1}
                        max={donations.length}
                        value={rangeStart}
                        onChange={e => setRangeStart(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-8 text-sm w-20"
                      />
                      <span className="text-xs text-muted-foreground">-</span>
                      <Input
                        type="number"
                        min={1}
                        max={donations.length}
                        value={rangeEnd}
                        onChange={e => setRangeEnd(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-8 text-sm w-20"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Batch boyutu</label>
                  <Select
                    value={String(batchSize)}
                    onValueChange={v => setBatchSize(parseInt(v))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
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
                    <Play className="w-4 h-4 mr-1" />
                    Başlat
                  </Button>
                ) : (
                  <Button variant="destructive" size="sm" onClick={stopAiClassification}>
                    <Square className="w-4 h-4 mr-1" />
                    Durdur
                  </Button>
                )}

                {(aiRunning || aiProgress.total > 0) && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        {aiRunning ? "İşleniyor..." : aiStopped ? "Durduruldu" : "Tamamlandı"}
                      </span>
                      <span className="text-xs font-medium">{aiProgress.done} / {aiProgress.total}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: aiProgress.total > 0 ? `${(aiProgress.done / aiProgress.total) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {showAiReport && (
          <Card className="p-0 overflow-hidden border-primary/20">
            <div
              className="flex items-center justify-between p-3 bg-primary/5 cursor-pointer"
              onClick={() => setAiReportCollapsed(!aiReportCollapsed)}
            >
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <FileBarChart className="w-4 h-4 text-primary" />
                AI Tamamlanma Raporu
                {aiStopped && <Badge variant="outline" className="text-xs">Durduruldu</Badge>}
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => { e.stopPropagation(); setAiReportCollapsed(!aiReportCollapsed); }}
                >
                  {aiReportCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => { e.stopPropagation(); setShowAiReport(false); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {!aiReportCollapsed && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{aiReportStats.totalProcessed}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {aiProgress.total > aiReportStats.totalProcessed
                        ? `Başarılı / ${aiProgress.total} toplam`
                        : "İşlenen Not"}
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${aiReportStats.warningCount > 0 ? "bg-destructive/10" : "bg-muted/50"}`}>
                    <div className={`text-2xl font-bold ${aiReportStats.warningCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {aiReportStats.warningCount}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Uyarı</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{aiReportStats.requestCount}</div>
                    <div className="text-xs text-muted-foreground mt-1">Özel İstek</div>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${aiReportStats.errorBatches > 0 ? "bg-destructive/10" : "bg-muted/50"}`}>
                    <div className={`text-2xl font-bold ${aiReportStats.errorBatches > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {aiReportStats.errorBatches}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Hatalı Batch</div>
                  </div>
                </div>

                {aiReportStats.categoryDistribution.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">Kategori Dağılımı</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {aiReportStats.categoryDistribution.map(([cat, count]) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat.replace(/_/g, " ")} <span className="ml-1 font-bold">{count}</span>
                        </Badge>
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
                          <button
                            key={r.donationId}
                            className="w-full flex items-start gap-2 text-left p-2 rounded-md hover:bg-destructive/5 transition-colors border border-transparent hover:border-destructive/20"
                            onClick={() => scrollToDonation(r.donationId)}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium truncate">
                                {donor?.description || donor?.name || r.donationId}
                              </div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowAiReport(true); setAiReportCollapsed(false); }}
            className="flex items-center gap-1"
          >
            <FileBarChart className="w-4 h-4" />
            Raporu Göster
          </Button>
        )}

        <div className="text-xs text-muted-foreground">
          {filteredDonations.length} bağışçı gösteriliyor
          {searchQuery && ` ("${searchQuery}" araması)`}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-xs">#</TableHead>
                <TableHead className="text-xs min-w-[150px]">Ad / Açıklama</TableHead>
                <TableHead className="text-xs w-24">Bağış Türü</TableHead>
                <TableHead className="text-xs w-24">Vekalet No</TableHead>
                <TableHead className="text-xs min-w-[200px]">Not</TableHead>
                <TableHead className="text-xs w-[180px]">AI Sonucu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDonations.map((d, idx) => {
                const aiResult = aiResults.get(d.id);
                const hasWarning = aiResult?.warnings && aiResult.warnings.trim() !== "";
                const globalIdx = donations.indexOf(d);

                return (
                  <TableRow
                    key={d.id}
                    data-donation-id={d.id}
                    className={`transition-all ${hasWarning ? "bg-destructive/5" : ""}`}
                  >
                    <TableCell className="text-xs text-muted-foreground">{globalIdx + 1}</TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{d.description || d.name || "(İsimsiz)"}</span>
                    </TableCell>
                    <TableCell>
                      {d.donationType && (
                        <Badge variant="outline" className="text-xs">{d.donationType}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.vekalet && (
                        <span className="text-xs text-muted-foreground">{d.vekalet}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Textarea
                          value={d.notes}
                          onChange={e => handleNoteChange(d.id, e.target.value)}
                          onBlur={() => commitNoteChange(d.id)}
                          placeholder="Not yok..."
                          className="text-xs min-h-[36px] resize-none py-1 px-2"
                          rows={1}
                        />
                        {d.notes.trim() !== "" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive shrink-0 h-6 w-6 p-0"
                            onClick={() => {
                              updateDonationsWithHistory(prev =>
                                prev.map(x => x.id === d.id ? { ...x, notes: "" } : x)
                              );
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {aiRunning && !aiResult && d.notes.trim() !== "" && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      )}
                      {aiResult && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-1 text-left hover:bg-muted/50 rounded p-1 -m-1 transition-colors w-full">
                              {hasWarning ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              )}
                              <div className="flex flex-wrap gap-0.5 min-w-0">
                                {aiResult.categories && aiResult.categories.length > 0 ? (
                                  aiResult.categories.slice(0, 2).map(cat => (
                                    <Badge key={cat} variant="secondary" className="text-[10px] px-1 py-0">{cat.replace(/_/g, " ")}</Badge>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">sonuç var</span>
                                )}
                                {aiResult.categories && aiResult.categories.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground">+{aiResult.categories.length - 2}</span>
                                )}
                              </div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 space-y-2" side="left">
                            <div className="text-sm font-medium">{d.description || d.name}</div>
                            {aiResult.summary && (
                              <p className="text-xs text-muted-foreground">{aiResult.summary}</p>
                            )}
                            {aiResult.categories && aiResult.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {aiResult.categories.map(cat => (
                                  <Badge key={cat} variant="secondary" className="text-xs">{cat.replace(/_/g, " ")}</Badge>
                                ))}
                              </div>
                            )}
                            {aiResult.requests && aiResult.requests.trim() !== "" && (
                              <div>
                                <span className="text-xs font-semibold text-blue-600">İstekler:</span>
                                <p className="text-xs mt-0.5">{aiResult.requests}</p>
                              </div>
                            )}
                            {hasWarning && (
                              <div className="bg-destructive/10 rounded p-2 border border-destructive/20">
                                <span className="text-xs font-semibold text-destructive flex items-center gap-1 mb-0.5">
                                  <AlertTriangle className="w-3 h-3" />
                                  Uyarı:
                                </span>
                                <p className="text-xs text-destructive">{aiResult.warnings}</p>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredDonations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-sm">
                    {searchQuery ? "Arama sonucu bulunamadı" : "Bağışçı yok"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notları Sil</AlertDialogTitle>
            <AlertDialogDescription>
              {searchQuery
                ? `Filtrelenmiş ${filteredDonations.filter(d => d.notes.trim() !== "").length} bağışçının notu silinecek.`
                : `${notesWithContent.length} bağışçının tüm notları silinecek.`}
              Bu işlem geri alınabilir (Geri Al butonuyla veya Ctrl+Z ile geri alabilirsiniz).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmBulkDeleteNotes}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
