import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Brain, ArrowLeft, Play, Square, FastForward, RotateCcw,
  AlertTriangle, Loader2, X, Sparkles, CheckCircle2,
  MessageSquare, FileText, Tag, Settings2, BarChart3,
} from "lucide-react";
import {
  fetchPoolDonations,
  fetchJobStatus, cancelJob,
  classifyNotesAsyncChunked, saveAiClassifications,
  PartialChunkError, ApiFetchError,
} from "@/lib/api";
import { API_BASE, getApiKey } from "@/lib/api/core";
import { useToast } from "@/hooks/use-toast";
import type { AiClassificationResult } from "@/lib/api";
import { CategoryBadge } from "@/lib/categoryConfig";

interface AiResult extends AiClassificationResult {
  donationType?: string;
  donorName?: string;
}

const AI_FAIL_MESSAGES = new Set(["AI bu bağışı sınıflandıramadı", "AI işlemi başarısız oldu", "AI sonuç eşleşmesi bulunamadı"]);

export default function AiSiniflandirmaPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [batchSize, setBatchSize] = useState(25);
  const [skipClassified, setSkipClassified] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiStopped, setAiStopped] = useState(false);
  const [aiResults, setAiResults] = useState<Map<string, AiResult>>(new Map());
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [aiErrorBatches, setAiErrorBatches] = useState(0);
  const [aiTotalBatches, setAiTotalBatches] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [resultTypeFilter, setResultTypeFilter] = useState<"warnings" | "failed" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeJobIdsRef = useRef<string[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiResultsRef = useRef<Map<string, AiResult>>(new Map());
  const aiRunningRef = useRef(false);

  const { data: donationsData, isLoading } = useQuery({
    queryKey: ["pool-donations-ai-page", projectId],
    queryFn: () => fetchPoolDonations(projectId, { limit: 100000, offset: 0, sortBy: "sortOrder" }),
    enabled: !!projectId,
  });

  const allItems = useMemo(() => donationsData?.items ?? [], [donationsData]);
  const itemsWithNotes = useMemo(
    () => allItems.filter(d => (d.notes || "").trim() !== ""),
    [allItems],
  );

  useEffect(() => {
    if (allItems.length === 0) return;
    setAiResults(prev => {
      if (prev.size > 0) return prev;
      const preloaded = new Map<string, AiResult>();
      for (const d of allItems) {
        if (d.aiCategories && d.aiCategories.length > 0) {
          preloaded.set(d.id, {
            donationId: d.id,
            categories: d.aiCategories,
            warnings: d.aiWarnings || "",
            requests: "",
            summary: "",
            donationType: d.donationType || "",
            donorName: d.description || d.name || d.id,
          });
        }
      }
      if (preloaded.size > 0) aiResultsRef.current = preloaded;
      return preloaded.size > 0 ? preloaded : prev;
    });
  }, [allItems]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => { aiRunningRef.current = aiRunning; }, [aiRunning]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const fireKeepaliveSave = useCallback(() => {
    const results = aiResultsRef.current;
    if (results.size === 0) return;
    const token = getApiKey();
    const body = JSON.stringify({
      classifications: Array.from(results.values()).map(r => ({
        donationId: r.donationId,
        categories: r.categories,
        warnings: r.warnings || "",
        requests: r.requests || "",
        summary: r.summary || "",
      })),
    });
    fetch(`${API_BASE}/ai-notes/save-classifications`, {
      method: "PUT",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!aiRunning) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      fireKeepaliveSave();
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [aiRunning, fireKeepaliveSave]);

  useEffect(() => {
    return () => {
      if (aiRunningRef.current && aiResultsRef.current.size > 0) {
        fireKeepaliveSave();
      }
    };
  }, [fireKeepaliveSave]);

  const startPollingJobs = useCallback((jobIds: string[], batchTotal: number) => {
    stopPolling();
    const finishedJobs = new Set<string>();
    const jobProgressMap = new Map<string, { done: number; total: number }>();
    const jobErrorMap = new Map<string, number>();
    const jobBatchMap = new Map<string, number>();
    type SaveItem = { donationId: string; categories: string[]; warnings: string; requests?: string; summary?: string };
    const queuedDonationIds = new Set<string>();
    const saveQueue: SaveItem[] = [];
    let isSaving = false;
    let isPolling = false;
    let totalSavedCount = 0;

    const drainQueue = async () => {
      if (isSaving) return;
      while (saveQueue.length > 0) {
        isSaving = true;
        const batch = saveQueue.splice(0, saveQueue.length);
        try {
          const SAVE_CHUNK = 2000;
          for (let si = 0; si < batch.length; si += SAVE_CHUNK) {
            await saveAiClassifications(batch.slice(si, si + SAVE_CHUNK));
          }
          totalSavedCount += batch.length;
          queryClient.invalidateQueries({ queryKey: ["pool-donations"] });
        } catch { /* sessiz — keepalive fetch son çare olarak devreye girer */ }
        finally { isSaving = false; }
      }
    };

    const enqueueNewResults = (newResults: SaveItem[]) => {
      if (newResults.length === 0) return;
      for (const r of newResults) queuedDonationIds.add(r.donationId);
      saveQueue.push(...newResults);
      drainQueue();
    };

    const poll = async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const activeIds = jobIds.filter(id => !finishedJobs.has(id));
        const statuses = await Promise.all(activeIds.map(id => fetchJobStatus(id).catch(() => null)));

        const newResultsThisPoll: { donationId: string; categories: string[]; warnings: string; requests?: string; summary?: string }[] = [];

        for (let i = 0; i < activeIds.length; i++) {
          const status = statuses[i];
          if (!status) continue;
          const jid = activeIds[i];

          const prev = jobProgressMap.get(jid);
          jobProgressMap.set(jid, {
            done: status.processedDonations,
            total: Math.max(status.totalDonations, prev?.total ?? 0),
          });
          if (status.failedBatchCount !== undefined) jobErrorMap.set(jid, status.failedBatchCount);
          if (status.totalBatches !== undefined) jobBatchMap.set(jid, status.totalBatches);

          if (status.results && status.results.length > 0) {
            const unsaved = status.results.filter(r => !queuedDonationIds.has(r.donationId));
            if (unsaved.length > 0) {
              newResultsThisPoll.push(...unsaved.map(r => ({
                donationId: r.donationId,
                categories: Array.isArray(r.categories) ? r.categories : [],
                warnings: r.warnings || "",
                requests: r.requests || "",
                summary: r.summary || "",
              })));
            }

            setAiResults(prev => {
              const next = new Map(prev);
              for (const r of status.results!) {
                const cats = Array.isArray(r.categories) ? r.categories : (r.categories ? [String(r.categories)] : []);
                const donor = allItems.find(d => d.id === r.donationId);
                next.set(r.donationId, {
                  ...r,
                  categories: cats,
                  warnings: r.warnings || "",
                  donationType: donor?.donationType || "",
                  donorName: donor?.description || donor?.name || r.donationId,
                });
              }
              aiResultsRef.current = next;
              return next;
            });
          }

          if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") {
            finishedJobs.add(jid);
            if (status.status === "cancelled") setAiStopped(true);
            if (status.status === "failed") {
              const isTimeout = status.error?.startsWith("Zaman aşımı");
              toast({
                title: isTimeout ? "Süre Doldu — Kısmi Sonuç Kaydedildi" : "AI İşlemi Başarısız",
                description: isTimeout
                  ? `${status.error} Aşağıdaki "Kaldığı Yerden Devam" butonu ile kalan notları işleyebilirsiniz.`
                  : (status.error || "Bilinmeyen hata"),
                variant: "destructive",
              });
              if (isTimeout) setAiStopped(true);
            }
          }
        }

        if (newResultsThisPoll.length > 0) {
          enqueueNewResults(newResultsThisPoll);
        }

        let totalDone = 0, totalAll = 0;
        for (const p of jobProgressMap.values()) { totalDone += p.done; totalAll += p.total; }
        setAiProgress({ done: totalDone, total: totalAll });

        let totalErrors = 0;
        for (const e of jobErrorMap.values()) totalErrors += e;
        setAiErrorBatches(totalErrors);
        let totalBatch = 0;
        for (const b of jobBatchMap.values()) totalBatch += b;
        setAiTotalBatches(totalBatch);

        if (finishedJobs.size === jobIds.length) {
          stopPolling();
          setAiRunning(false);
          activeJobIdsRef.current = [];

          let finalErrors = 0;
          for (const e of jobErrorMap.values()) finalErrors += e;
          if (finalErrors > 0) {
            toast({
              title: "Kısmi başarısızlık",
              description: `${finalErrors} batch AI'dan eksik yanıt aldı ve yeniden denendi. Bazı bağışlar sınıflandırılamadı olarak işaretlendi.`,
              variant: "destructive",
            });
          }

          const unsavedAtEnd = Array.from(aiResultsRef.current.values())
            .filter(r => !queuedDonationIds.has(r.donationId))
            .map(r => ({
              donationId: r.donationId,
              categories: r.categories,
              warnings: r.warnings || "",
              requests: r.requests || "",
              summary: r.summary || "",
            }));

          if (unsavedAtEnd.length > 0) {
            enqueueNewResults(unsavedAtEnd);
          }

          await drainQueue();

          queryClient.invalidateQueries({ queryKey: ["pool-donations-ai-page"] });
          const finalTotal = totalSavedCount;
          setSaved(true);
          toast({ title: "Tümü kaydedildi", description: `${finalTotal} bağışçı sınıflandırması güncellendi` });
        }
      } catch {} finally { isPolling = false; }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 3000);
  }, [stopPolling, toast, allItems, queryClient]);

  const handleStart = useCallback(async (resume = false) => {
    let toProcess = itemsWithNotes;
    if (resume) {
      if (aiResults.size > 0) {
        toProcess = toProcess.filter(d => !aiResults.has(d.id));
      } else {
        toProcess = toProcess.filter(d => !d.aiCategories || d.aiCategories.length === 0);
      }
    }
    if (skipClassified) toProcess = toProcess.filter(d => !d.aiCategories || d.aiCategories.length === 0);

    if (toProcess.length === 0) {
      toast({ title: "İşlenecek bağış yok", description: "Notu olan veya sınıflandırılmamış bağış bulunamadı" });
      return;
    }

    setAiRunning(true);
    setAiStopped(false);
    setAiErrorBatches(0);
    setAiTotalBatches(0);
    setSaved(false);
    if (!resume) setAiResults(new Map());

    const previouslyDone = resume ? aiResults.size : 0;
    setAiProgress({ done: previouslyDone, total: previouslyDone + toProcess.length });

    try {
      const { jobIds } = await classifyNotesAsyncChunked(
        toProcess.map(d => ({ id: d.id, name: d.description || d.name || "", donationType: d.donationType || "", vekalet: d.vekalet || "", notes: d.notes || "" })),
        undefined,
        batchSize,
      );
      activeJobIdsRef.current = jobIds;
      startPollingJobs(jobIds, toProcess.length);
    } catch (err) {
      if (err instanceof PartialChunkError && err.jobIds.length > 0) {
        activeJobIdsRef.current = err.jobIds;
        startPollingJobs(err.jobIds, toProcess.length);
        toast({ title: "Kısmi başlatma", description: err.message, variant: "destructive" });
        return;
      }
      setAiRunning(false);
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      const details = err instanceof ApiFetchError ? err.details : undefined;
      const detailStr = details ? details.map((d: { path?: string[]; message?: string }) => `${(d.path || []).join(".")}: ${d.message || ""}`).join(", ") : "";
      toast({ title: "AI Başlatılamadı", description: detailStr ? `${msg} (${detailStr})` : msg, variant: "destructive" });
    }
  }, [itemsWithNotes, skipClassified, aiResults, toast, startPollingJobs]);

  const handleStop = useCallback(async () => {
    const jobIds = activeJobIdsRef.current;
    if (jobIds.length > 0) await Promise.all(jobIds.map(id => cancelJob(id).catch(() => {})));
    setAiStopped(true);
    setAiRunning(false);
  }, []);

  const handleSaveNow = useCallback(async () => {
    if (aiResults.size === 0) return;
    setSaving(true);
    try {
      const toSave = Array.from(aiResults.values()).map(r => ({
        donationId: r.donationId,
        categories: r.categories,
        warnings: r.warnings || "",
        requests: r.requests || "",
        summary: r.summary || "",
      }));
      const CHUNK = 2000;
      for (let i = 0; i < toSave.length; i += CHUNK) {
        await saveAiClassifications(toSave.slice(i, i + CHUNK));
      }
      queryClient.invalidateQueries({ queryKey: ["pool-donations"] });
      queryClient.invalidateQueries({ queryKey: ["pool-donations-ai-page"] });
      setSaved(true);
      toast({ title: "Kaydedildi", description: `${toSave.length} bağışçı sınıflandırması güncellendi` });
    } catch {
      toast({ title: "Kaydetme hatası", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [aiResults, queryClient, toast]);

  const categoryDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of aiResults.values()) {
      for (const cat of r.categories) {
        map.set(cat, (map.get(cat) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [aiResults]);

  const warningResults = useMemo(
    () => Array.from(aiResults.values()).filter(r => r.warnings && r.warnings.trim()),
    [aiResults],
  );

  const permanentlyFailedResults = useMemo(
    () => Array.from(aiResults.values()).filter(r => AI_FAIL_MESSAGES.has(r.warnings)),
    [aiResults],
  );

  const requestResults = useMemo(
    () => Array.from(aiResults.values()).filter(r => r.requests?.trim()),
    [aiResults],
  );

  const filteredResults = useMemo(() => {
    let all = Array.from(aiResults.values());
    if (resultTypeFilter === "warnings") return all.filter(r => r.warnings && r.warnings.trim() && !AI_FAIL_MESSAGES.has(r.warnings));
    if (resultTypeFilter === "failed") return all.filter(r => AI_FAIL_MESSAGES.has(r.warnings));
    if (categoryFilter) return all.filter(r => r.categories.some(c => c.toLocaleLowerCase("tr") === categoryFilter.toLocaleLowerCase("tr")));
    return all;
  }, [aiResults, categoryFilter, resultTypeFilter]);

  const progressPct = aiProgress.total > 0 ? Math.round((aiProgress.done / aiProgress.total) * 100) : 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/bagis-havuzu/${projectId}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" />Geri
        </Button>
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h1 className="text-base font-semibold">AI Sınıflandırma</h1>
        </div>
        {aiRunning && (
          <Badge variant="secondary" className="animate-pulse text-xs">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            {aiProgress.done}/{aiProgress.total} işleniyor
          </Badge>
        )}
        {!aiRunning && aiResults.size > 0 && (
          <Badge variant="secondary" className="text-xs">{aiResults.size} sonuç</Badge>
        )}
        {warningResults.length > 0 && (
          <Badge variant="destructive" className="text-xs">{warningResults.length} uyarı</Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {aiResults.size > 0 && !aiRunning && (
            <Button size="sm" variant={saved ? "outline" : "default"} onClick={handleSaveNow} disabled={saving || saved}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              {saved ? "Kaydedildi" : "Kaydet"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-72 shrink-0 border-r flex flex-col gap-4 p-4 overflow-y-auto">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-3">
              <Settings2 className="w-4 h-4" />Ayarlar
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Batch boyutu</label>
                <Select value={String(batchSize)} onValueChange={v => setBatchSize(parseInt(v))} disabled={aiRunning}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 bağış / istek</SelectItem>
                    <SelectItem value="10">10 bağış / istek</SelectItem>
                    <SelectItem value="25">25 bağış / istek</SelectItem>
                    <SelectItem value="50">50 bağış / istek</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="ai-skip"
                  type="checkbox"
                  checked={skipClassified}
                  onChange={e => setSkipClassified(e.target.checked)}
                  disabled={aiRunning}
                  className="rounded border-gray-300"
                />
                <label htmlFor="ai-skip" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Daha önce sınıflandırılmış olanları atla
                </label>
              </div>

              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />Bağışlar yükleniyor...
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {itemsWithNotes.length} notu olan bağış işlenecek
                  {allItems.length !== itemsWithNotes.length && (
                    <span className="block text-[11px]">({allItems.length} bağıştan)</span>
                  )}
                </p>
              )}

              {!aiRunning ? (
                aiStopped && aiResults.size > 0 ? (
                  <div className="flex flex-col gap-2">
                    <Button size="sm" onClick={() => handleStart(true)} className="w-full">
                      <FastForward className="w-4 h-4 mr-1" />Kaldığı Yerden Devam
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleStart(false)} className="w-full">
                      <RotateCcw className="w-4 h-4 mr-1" />Yeniden Başla
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => handleStart(false)} disabled={itemsWithNotes.length === 0 || isLoading} className="w-full">
                    <Play className="w-4 h-4 mr-1" />Başlat ({itemsWithNotes.length} bağış)
                  </Button>
                )
              ) : (
                <Button variant="destructive" size="sm" onClick={handleStop} className="w-full">
                  <Square className="w-4 h-4 mr-1" />Durdur
                </Button>
              )}
            </div>
          </div>

          {(aiRunning || aiProgress.total > 0) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {aiRunning ? "İşleniyor..." : aiStopped ? "Durduruldu" : "Tamamlandı"}
                </span>
                <span className="font-medium">{progressPct}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{aiProgress.done} işlendi</span>
                <span>{aiProgress.total} toplam</span>
              </div>
              {aiErrorBatches > 0 && (
                <p className="text-[11px] text-amber-600" title="Bu batch'ler AI'dan eksik yanıt aldı ve otomatik olarak yeniden denendi. Hâlâ başarısız olanlar 'Uyarılı Bağışçılar' bölümünde görünür.">
                  ⚠ {aiErrorBatches}/{aiTotalBatches} batch yeniden denendi
                </p>
              )}
            </div>
          )}

          {aiResults.size > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />İstatistikler
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-primary">{aiResults.size}</div>
                  <div className="text-[10px] text-muted-foreground">İşlenen</div>
                </div>
                <button
                  className={`rounded-lg p-2.5 text-center transition-all ${warningResults.length > 0 ? "bg-destructive/10 hover:bg-destructive/20 cursor-pointer" : "bg-muted/50 cursor-default"} ${resultTypeFilter === "warnings" ? "ring-2 ring-destructive" : ""}`}
                  onClick={() => warningResults.length > 0 && setResultTypeFilter(prev => prev === "warnings" ? null : "warnings")}
                  disabled={warningResults.length === 0}
                >
                  <div className={`text-lg font-bold ${warningResults.length > 0 ? "text-destructive" : "text-muted-foreground"}`}>{warningResults.length}</div>
                  <div className="text-[10px] text-muted-foreground">{resultTypeFilter === "warnings" ? "↑ Filtrelendi" : "Uyarı"}</div>
                </button>
                <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-blue-600">{requestResults.length}</div>
                  <div className="text-[10px] text-muted-foreground">Özel İstek</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-muted-foreground">{categoryDistribution.length}</div>
                  <div className="text-[10px] text-muted-foreground">Kategori</div>
                </div>
                {permanentlyFailedResults.length > 0 && (
                  <button
                    className={`col-span-2 rounded-lg p-2.5 text-center transition-all border cursor-pointer hover:brightness-110 ${resultTypeFilter === "failed" ? "bg-red-200 dark:bg-red-900/40 border-red-400 dark:border-red-700 ring-2 ring-red-500" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"}`}
                    onClick={() => setResultTypeFilter(prev => prev === "failed" ? null : "failed")}
                  >
                    <div className="text-lg font-bold text-destructive">{permanentlyFailedResults.length}</div>
                    <div className="text-[10px] text-destructive/80">{resultTypeFilter === "failed" ? "↑ Filtrelendi" : "AI işleyemedi"}</div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4">
          {aiResults.size === 0 && !aiRunning && (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
              <Brain className="w-12 h-12 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Henüz sınıflandırma yapılmadı</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Soldaki ayarları kullanarak başlatın</p>
              </div>
            </div>
          )}

          {categoryDistribution.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className={`w-4 h-4 text-primary ${aiRunning ? "animate-pulse" : ""}`} />
                  Kategori Dağılımı
                  {categoryFilter && (
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={() => setCategoryFilter(null)}>
                      <X className="w-3 h-3 mr-0.5" />Filtreyi Kaldır
                    </Button>
                  )}
                </h2>
                <span className="text-xs text-muted-foreground">{aiResults.size} sonuçtan</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {categoryDistribution.map(([cat, count]) => (
                  <CategoryBadge
                    key={cat}
                    cat={cat}
                    count={count}
                    active={categoryFilter === cat}
                    onClick={() => setCategoryFilter(prev => prev === cat ? null : cat)}
                  />
                ))}
              </div>
            </Card>
          )}

          {filteredResults.length > 0 && (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" />
                  Sonuçlar
                  {resultTypeFilter === "warnings" && (
                    <Badge variant="destructive" className="text-xs ml-1 cursor-pointer" onClick={() => setResultTypeFilter(null)}>
                      Uyarılılar <X className="w-2.5 h-2.5 ml-0.5" />
                    </Badge>
                  )}
                  {resultTypeFilter === "failed" && (
                    <Badge variant="destructive" className="text-xs ml-1 cursor-pointer" onClick={() => setResultTypeFilter(null)}>
                      AI işleyemedi <X className="w-2.5 h-2.5 ml-0.5" />
                    </Badge>
                  )}
                  {!resultTypeFilter && categoryFilter && (
                    <Badge variant="outline" className="text-xs ml-1 cursor-pointer" onClick={() => setCategoryFilter(null)}>
                      {categoryFilter.replace(/_/g, " ")} <X className="w-2.5 h-2.5 ml-0.5" />
                    </Badge>
                  )}
                </h2>
                <span className="text-xs text-muted-foreground">{filteredResults.length} kayıt</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium w-40">Bağışçı</th>
                      <th className="text-left px-3 py-2 font-medium w-24">Cinsi</th>
                      <th className="text-left px-3 py-2 font-medium">Kategoriler</th>
                      <th className="text-left px-3 py-2 font-medium w-52">Özet</th>
                      <th className="text-left px-3 py-2 font-medium w-52">Özel İstekler</th>
                      <th className="text-left px-3 py-2 font-medium w-52">Uyarılar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredResults.map((r, idx) => {
                      const donor = allItems.find(d => d.id === r.donationId);
                      const hasWarning = r.warnings && r.warnings.trim();
                      const isAiFailed = AI_FAIL_MESSAGES.has(r.warnings);
                      return (
                        <tr key={r.donationId} className={`${isAiFailed ? "bg-red-50 dark:bg-red-950/20" : idx % 2 === 0 ? "bg-background" : "bg-muted/20"} ${hasWarning ? "border-l-2 border-l-destructive" : ""}`}>
                          <td className="px-3 py-2.5 font-medium text-xs truncate max-w-[160px]" title={donor?.description || donor?.name || r.donationId}>
                            {donor?.description || donor?.name || r.donationId}
                            {isAiFailed && <span className="ml-1 text-[10px] text-destructive font-semibold">[hata]</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">{donor?.donationType || "—"}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {r.categories.length > 0 ? (
                                r.categories.map(cat => (
                                  <CategoryBadge key={cat} cat={cat} onClick={() => setCategoryFilter(prev => prev === cat ? null : cat)} />
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground/50">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.summary || "—"}</td>
                          <td className="px-3 py-2.5 text-xs">
                            {r.requests?.trim() ? (
                              <span className="flex items-start gap-1">
                                <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                <span className="text-blue-700 dark:text-blue-400">{r.requests}</span>
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            {hasWarning ? (
                              <span className="flex items-start gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                                <span className="text-destructive">{r.warnings}</span>
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {warningResults.length > 0 && !categoryFilter && (
            <Card className="border-destructive/30 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-destructive/5 border-b border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <h2 className="text-sm font-semibold text-destructive">Uyarılı Bağışçılar ({warningResults.length})</h2>
              </div>
              <div className="divide-y">
                {warningResults.map(r => {
                  const donor = allItems.find(d => d.id === r.donationId);
                  return (
                    <div key={r.donationId} className="px-4 py-2.5 flex items-start gap-3">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium">{donor?.description || donor?.name || r.donationId}</div>
                        <div className="text-xs text-destructive/80 mt-0.5">{r.warnings}</div>
                        {r.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.categories.map(cat => <CategoryBadge key={cat} cat={cat} />)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
