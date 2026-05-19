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
  Brain, ArrowLeft, Play, Square, CheckSquare, FastForward, RotateCcw,
  AlertTriangle, Loader2, X, Sparkles, CheckCircle2,
  MessageSquare, FileText, Tag, Settings2, BarChart3, History, Pencil, Zap, Terminal,
} from "lucide-react";
import {
  fetchPoolDonations,
  fetchJobStatus, cancelJob,
  classifyNotesAsyncChunked, saveAiClassifications,
  PartialChunkError, ApiFetchError,
} from "@/lib/api";
import { bulkUpdateNotes, fetchAiJobLogs } from "@/lib/api/ai-notes";
import type { AiJobLog } from "@/lib/api";
import { API_BASE, getApiKey } from "@/lib/api/core";
import { useToast } from "@/hooks/use-toast";
import type { AiClassificationResult } from "@/lib/api";
import type { PoolDonation } from "@/lib/types";
import { CategoryBadge } from "@/lib/categoryConfig";

interface AiResult extends AiClassificationResult {
  donationType?: string;
  donorName?: string;
}

const AI_FAIL_MESSAGES = new Set(["AI bu bağışı sınıflandıramadı", "AI işlemi başarısız oldu", "AI sonuç eşleşmesi bulunamadı"]);

type LiveLogEntry =
  | { id: string; ts: Date; kind: "start"; total: number }
  | { id: string; ts: Date; kind: "batch"; count: number; cats: [string, number][]; warnings: Array<{ name: string; msg: string }> }
  | { id: string; ts: Date; kind: "complete"; processed: number; durationSec: number }
  | { id: string; ts: Date; kind: "stop"; processed: number }
  | { id: string; ts: Date; kind: "error"; message: string };

type LiveLogInput =
  | { kind: "start"; total: number }
  | { kind: "batch"; count: number; cats: [string, number][]; warnings: Array<{ name: string; msg: string }> }
  | { kind: "complete"; processed: number; durationSec: number }
  | { kind: "stop"; processed: number }
  | { kind: "error"; message: string };

function LogEntry({ entry }: { entry: LiveLogEntry }) {
  const ts = entry.ts.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="flex items-start gap-1.5 py-1 text-[11px] leading-relaxed border-b border-border/30 last:border-0">
      <span className="text-muted-foreground/40 font-mono shrink-0 tabular-nums mt-0.5">{ts}</span>
      <div className="min-w-0 flex-1">
        {entry.kind === "start" && (
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
            <Brain className="w-3 h-3 shrink-0" />
            Başlatıldı — {entry.total} bağış işlenecek
          </div>
        )}
        {entry.kind === "batch" && (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-foreground/80 font-medium">
              <Zap className="w-3 h-3 shrink-0 text-amber-500" />
              {entry.count} bağış işlendi
            </div>
            {entry.cats.length > 0 && (
              <div className="flex flex-wrap gap-0.5 pl-4">
                {entry.cats.map(([cat, n]) => (
                  <span key={cat} className="px-1 rounded text-[9px] bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                    {cat.replace(/_/g, " ")} ×{n}
                  </span>
                ))}
              </div>
            )}
            {entry.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-0.5 pl-4 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                <span className="min-w-0 break-words"><span className="font-medium">{w.name}</span>: {w.msg}</span>
              </div>
            ))}
          </div>
        )}
        {entry.kind === "complete" && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            Tamamlandı — {entry.processed} bağış · {entry.durationSec}s
          </div>
        )}
        {entry.kind === "stop" && (
          <div className="flex items-center gap-1 text-orange-500 dark:text-orange-400 font-medium">
            <Square className="w-3 h-3 shrink-0" />
            Durduruldu · {entry.processed} bağış işlendi
          </div>
        )}
        {entry.kind === "error" && (
          <div className="flex items-start gap-1 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="font-medium break-words">{entry.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [resultTypeFilter, setResultTypeFilter] = useState<"warnings" | "failed" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`ai-selected-${projectId}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  const toggleResultSelect = (id: string) => {
    setSelectedResultIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(`ai-selected-${projectId}`, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const [colWidths, setColWidths] = useState<Record<string, number>>({
    rowNum: 36, checkbox: 32, vekalet: 160, name: 144, cinsi: 80, ozellik: 96, kategoriler: 200, orijinalNotlar: 200, aiOzet: 200, istekler: 176, uyarilar: 176,
  });

  const [editingCategory, setEditingCategory] = useState<{ donationId: string; catIndex: number; value: string } | null>(null);

  const [liveLogEntries, setLiveLogEntries] = useState<LiveLogEntry[]>([]);
  const [liveLogTab, setLiveLogTab] = useState<"live" | "history">("live");
  const [recentResults, setRecentResults] = useState<Array<{ donationId: string; name: string; cats: string[]; summary: string; warnings: string }>>([]);
  const liveLogScrollRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);
  const processedCountRef = useRef(0);

  const addLogEntry = useCallback((entry: LiveLogInput) => {
    const id = String(++logIdRef.current);
    setLiveLogEntries(prev => [...prev.slice(-500), { ...entry, id, ts: new Date() } as LiveLogEntry]);
    setTimeout(() => {
      liveLogScrollRef.current?.scrollTo({ top: liveLogScrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  const removeCategory = (donationId: string, catIndex: number) => {
    setAiResults(prev => {
      const next = new Map(prev);
      const entry = next.get(donationId);
      if (!entry) return prev;
      const updatedCats = entry.categories.filter((_, i) => i !== catIndex);
      const updated = { ...entry, categories: updatedCats };
      next.set(donationId, updated);
      aiResultsRef.current = next;
      return next;
    });
  };

  const confirmRenameCategory = (donationId: string, catIndex: number, newLabel: string) => {
    setAiResults(prev => {
      const next = new Map(prev);
      const entry = next.get(donationId);
      if (!entry) return prev;
      const updatedCats = entry.categories.map((c, i) => i === catIndex ? newLabel.trim() || c : c);
      const updated = { ...entry, categories: updatedCats };
      next.set(donationId, updated);
      aiResultsRef.current = next;
      return next;
    });
    setEditingCategory(null);
  };

  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = e.clientX - resizingRef.current.startX;
      const newW = Math.max(60, resizingRef.current.startW + delta);
      setColWidths(prev => ({ ...prev, [resizingRef.current!.col]: newW }));
    };
    const onUp = () => { resizingRef.current = null; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const startResize = (col: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { col, startX: e.clientX, startW: colWidths[col] };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const [editingNote, setEditingNote] = useState<{ donationId: string; value: string } | null>(null);
  const [pendingNote, setPendingNote] = useState<{ donationId: string; value: string } | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  const confirmNoteEdit = async (kesimAlaniId: string) => {
    if (!pendingNote) return;
    setSavingNote(true);
    const { donationId, value } = pendingNote;
    try {
      await bulkUpdateNotes(kesimAlaniId, [{ donationId, notes: value }]);

      const updateItems = (old: { items: PoolDonation[]; total: number } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map(item =>
            item.id === donationId ? { ...item, notes: value } : item
          ),
        };
      };
      queryClient.setQueryData(["pool-donations-ai-page", projectId], updateItems);
      queryClient.setQueryData(["pool-all-descriptions", projectId], updateItems);

      toast({ title: "Not güncellendi", duration: 2000 });
    } catch {
      toast({ title: "Kayıt başarısız", variant: "destructive", duration: 3000 });
    } finally {
      setSavingNote(false);
      setPendingNote(null);
    }
  };

  const activeJobIdsRef = useRef<string[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiResultsRef = useRef<Map<string, AiResult>>(new Map());
  const aiRunningRef = useRef(false);

  const { data: donationsData, isLoading } = useQuery({
    queryKey: ["pool-donations-ai-page", projectId],
    queryFn: () => fetchPoolDonations(projectId, { limit: 100000, offset: 0, sortBy: "sortOrder" }),
    enabled: !!projectId,
  });

  const { data: jobLogsData } = useQuery({
    queryKey: ["ai-job-logs", projectId],
    queryFn: () => fetchAiJobLogs(projectId, 20),
    enabled: !!projectId,
    refetchInterval: 30000,
  });

  const allItems = useMemo(
    () => (donationsData?.items ?? []).filter(d => !d.kesimAlaniName || d.kesimAlaniName === "__havuz__"),
    [donationsData],
  );
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
    const loggedDonationIds = new Set<string>();
    const jobStartedAt = Date.now();

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
            if (status.status === "cancelled") { setAiStopped(true); addLogEntry({ kind: "stop", processed: processedCountRef.current }); }
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
              addLogEntry({ kind: "error", message: status.error || "AI işlemi başarısız oldu" });
            }
          }
        }

        if (newResultsThisPoll.length > 0) {
          enqueueNewResults(newResultsThisPoll);
          const newToLog = newResultsThisPoll.filter(r => !loggedDonationIds.has(r.donationId));
          if (newToLog.length > 0) {
            for (const r of newToLog) loggedDonationIds.add(r.donationId);
            const catMap = new Map<string, number>();
            const batchWarnings: Array<{ name: string; msg: string }> = [];
            const recentItems: Array<{ donationId: string; name: string; cats: string[]; summary: string; warnings: string }> = [];
            for (const r of newToLog) {
              const donor = allItems.find(d => d.id === r.donationId);
              const dName = donor?.description || donor?.name || r.donationId;
              for (const cat of r.categories) catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
              if (r.warnings) batchWarnings.push({ name: dName, msg: r.warnings });
              recentItems.push({ donationId: r.donationId, name: dName, cats: r.categories, summary: r.summary || "", warnings: r.warnings || "" });
            }
            const cats = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) as [string, number][];
            addLogEntry({ kind: "batch", count: newToLog.length, cats, warnings: batchWarnings });
            setRecentResults(prev => [...[...recentItems].reverse(), ...prev].slice(0, 8));
          }
        }

        let totalDone = 0, totalAll = 0;
        for (const p of jobProgressMap.values()) { totalDone += p.done; totalAll += p.total; }
        setAiProgress({ done: totalDone, total: totalAll });
        processedCountRef.current = totalDone;

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
          queryClient.invalidateQueries({ queryKey: ["ai-job-logs"] });
          const finalTotal = totalSavedCount;
          setSaved(true);
          addLogEntry({ kind: "complete", processed: totalDone, durationSec: Math.round((Date.now() - jobStartedAt) / 1000) });
          toast({ title: "Tümü kaydedildi", description: `${finalTotal} bağışçı sınıflandırması güncellendi` });
        }
      } catch {} finally { isPolling = false; }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 3000);
  }, [stopPolling, toast, allItems, queryClient, addLogEntry]);

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
    if (!resume) { setAiResults(new Map()); setLiveLogEntries([]); setRecentResults([]); setLiveLogTab("live"); }
    addLogEntry({ kind: "start", total: toProcess.length });

    const previouslyDone = resume ? aiResults.size : 0;
    setAiProgress({ done: previouslyDone, total: previouslyDone + toProcess.length });

    try {
      const { jobIds } = await classifyNotesAsyncChunked(
        toProcess.map(d => ({ id: d.id, name: d.description || d.name || "", donationType: d.donationType || "", vekalet: d.vekalet || "", notes: d.notes || "" })),
        undefined,
        batchSize,
        projectId,
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
  }, [itemsWithNotes, skipClassified, aiResults, toast, startPollingJobs, addLogEntry, projectId]);

  const handleStop = useCallback(async () => {
    const jobIds = activeJobIdsRef.current;
    if (jobIds.length > 0) await Promise.all(jobIds.map(id => cancelJob(id).catch(() => {})));
    setAiStopped(true);
    setAiRunning(false);
    addLogEntry({ kind: "stop", processed: processedCountRef.current });
  }, [addLogEntry]);

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
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "tr"));
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
    if (categoryFilter.length > 0) return all.filter(r => categoryFilter.every(f => r.categories.some(c => c.toLocaleLowerCase("tr") === f.toLocaleLowerCase("tr"))));
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
        <div className="w-64 shrink-0 border-r flex flex-col gap-4 p-4 overflow-y-auto">
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
                  {categoryFilter.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={() => setCategoryFilter([])}>
                      <X className="w-3 h-3 mr-0.5" />Filtreyi Kaldır ({categoryFilter.length})
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
                    active={categoryFilter.includes(cat)}
                    onClick={() => setCategoryFilter(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
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
                  {!resultTypeFilter && categoryFilter.length > 0 && (
                    categoryFilter.map(f => (
                      <Badge key={f} variant="outline" className="text-xs ml-1 cursor-pointer" onClick={() => setCategoryFilter(prev => prev.filter(c => c !== f))}>
                        {f.charAt(0).toUpperCase() + f.replace(/_/g, " ").slice(1)} <X className="w-2.5 h-2.5 ml-0.5" />
                      </Badge>
                    ))
                  )}
                </h2>
                <span className="text-xs text-muted-foreground">{filteredResults.length} kayıt</span>
              </div>
              <div className="overflow-x-auto">
                <table className="text-sm" style={{ tableLayout: "fixed", width: Object.values(colWidths).reduce((a, b) => a + b, 0) }}>
                  <colgroup>
                    {(["rowNum","checkbox","vekalet","name","cinsi","ozellik","kategoriler","orijinalNotlar","aiOzet","istekler","uyarilar"] as const).map(col => (
                      <col key={col} style={{ width: colWidths[col] }} />
                    ))}
                  </colgroup>
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      {([
                        { key: "rowNum", label: "#" },
                        { key: "checkbox", label: "" },
                        { key: "vekalet", label: "Vekaleti Veren" },
                        { key: "name", label: "Adına Kesilen" },
                        { key: "cinsi", label: "Cinsi" },
                        { key: "ozellik", label: "Özellik" },
                        { key: "kategoriler", label: "Kategoriler" },
                        { key: "orijinalNotlar", label: "Orijinal Notlar" },
                        { key: "aiOzet", label: "AI Özeti" },
                        { key: "istekler", label: "Özel İstekler" },
                        { key: "uyarilar", label: "Uyarılar" },
                      ] as const).map(({ key, label }) => (
                        <th
                          key={key}
                          className="text-left px-3 py-2 font-medium relative select-none overflow-hidden"
                          style={{ width: colWidths[key] }}
                        >
                          <span className="truncate block pr-2">{label}</span>
                          <div
                            onMouseDown={startResize(key)}
                            className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize group z-10"
                          >
                            <div className="w-px h-4 bg-border group-hover:bg-primary group-hover:w-0.5 transition-all" />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredResults.map((r, idx) => {
                      const donor = allItems.find(d => d.id === r.donationId);
                      const hasWarning = r.warnings && r.warnings.trim();
                      const isAiFailed = AI_FAIL_MESSAGES.has(r.warnings);
                      const isSelected = selectedResultIds.has(r.donationId);
                      return (
                        <tr
                          key={r.donationId}
                          className={`cursor-pointer transition-colors ${isSelected ? "bg-green-100/80 dark:bg-green-900/40" : isAiFailed ? "bg-red-50 dark:bg-red-950/20" : idx % 2 === 0 ? "bg-background" : "bg-muted/20"} ${hasWarning && !isSelected ? "border-l-2 border-l-destructive" : ""}`}
                          onClick={() => toggleResultSelect(r.donationId)}
                        >
                          <td className="px-2 py-2.5 text-center text-[11px] text-muted-foreground/60 font-mono select-none">
                            {idx + 1}
                          </td>
                          <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                            <button onClick={() => toggleResultSelect(r.donationId)} className="text-muted-foreground hover:text-foreground">
                              {isSelected
                                ? <CheckSquare className="w-4 h-4 text-green-600" />
                                : <Square className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-xs" title={(donor?.description || r.donationId).toUpperCase()}>
                            <div className="truncate">{(donor?.description || r.donationId).toUpperCase()}
                              {isAiFailed && <span className="ml-1 text-[10px] text-destructive font-semibold">[hata]</span>}
                            </div>
                            {donor?.vekalet != null && donor.vekalet !== "" && (
                              <div className="text-[10px] text-muted-foreground/60 font-normal truncate mt-0.5">
                                #{donor.vekalet}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[144px]" title={(donor?.name || "").toUpperCase()}>{donor?.name ? donor.name.toUpperCase() : "—"}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">{donor?.donationType || "—"}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">{donor?.ozellik || donor?.birim || "—"}</td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-wrap gap-1">
                              {r.categories.length > 0 ? (
                                r.categories.map((cat, catIdx) => (
                                  editingCategory?.donationId === r.donationId && editingCategory.catIndex === catIdx ? (
                                    <span key={catIdx} className="inline-flex items-center gap-0.5">
                                      <input
                                        autoFocus
                                        value={editingCategory.value}
                                        onChange={e => setEditingCategory({ ...editingCategory, value: e.target.value })}
                                        onKeyDown={e => {
                                          if (e.key === "Enter") confirmRenameCategory(r.donationId, catIdx, editingCategory.value);
                                          if (e.key === "Escape") setEditingCategory(null);
                                        }}
                                        onBlur={() => confirmRenameCategory(r.donationId, catIdx, editingCategory.value)}
                                        className="text-[10px] border rounded px-1 py-0.5 w-24 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                      />
                                    </span>
                                  ) : (
                                    <span key={catIdx} className="inline-flex items-center gap-0.5 group/cat">
                                      <CategoryBadge cat={cat} onClick={() => setCategoryFilter(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])} />
                                      <button
                                        title="Yeniden adlandır"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={e => { e.stopPropagation(); setEditingCategory({ donationId: r.donationId, catIndex: catIdx, value: cat }); }}
                                        className="opacity-0 group-hover/cat:opacity-100 transition-opacity ml-0.5 text-muted-foreground hover:text-foreground"
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        title="Kaldır"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={e => { e.stopPropagation(); removeCategory(r.donationId, catIdx); }}
                                        className="opacity-0 group-hover/cat:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </span>
                                  )
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground/50">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground" onClick={e => e.stopPropagation()}>
                            {pendingNote?.donationId === r.donationId ? (
                              <div className="space-y-1.5">
                                <p className="text-[11px] italic text-foreground/60 bg-muted/30 rounded px-2 py-1 border whitespace-pre-wrap">{pendingNote.value || "(boş)"}</p>
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Değişikliği kaydetmek istiyor musunuz?</p>
                                <div className="flex gap-1">
                                  <button
                                    autoFocus
                                    disabled={savingNote}
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => confirmNoteEdit(projectId)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-400"
                                  >
                                    {savingNote ? "Kaydediliyor…" : "✓ Evet, kaydet"}
                                  </button>
                                  <button
                                    disabled={savingNote}
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => { setPendingNote(null); setEditingNote({ donationId: r.donationId, value: pendingNote.value }); }}
                                    className="text-[10px] px-2 py-0.5 rounded bg-muted border hover:bg-muted/70 disabled:opacity-50"
                                  >
                                    Geri dön
                                  </button>
                                  <button
                                    disabled={savingNote}
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => setPendingNote(null)}
                                    className="text-[10px] px-2 py-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-50"
                                  >
                                    İptal
                                  </button>
                                </div>
                              </div>
                            ) : editingNote?.donationId === r.donationId ? (
                              <div className="space-y-1">
                                <textarea
                                  autoFocus
                                  value={editingNote.value}
                                  onChange={e => setEditingNote({ donationId: r.donationId, value: e.target.value })}
                                  onKeyDown={e => {
                                    if (e.key === "Escape") { setEditingNote(null); }
                                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                      setPendingNote({ donationId: r.donationId, value: editingNote.value });
                                      setEditingNote(null);
                                    }
                                  }}
                                  rows={3}
                                  className="w-full text-xs border rounded px-2 py-1 bg-background resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => {
                                      setPendingNote({ donationId: r.donationId, value: editingNote.value });
                                      setEditingNote(null);
                                    }}
                                    className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                                  >
                                    Onayla
                                  </button>
                                  <button
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => setEditingNote(null)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-muted border hover:bg-muted/70"
                                  >
                                    İptal
                                  </button>
                                  <span className="text-[9px] text-muted-foreground/50 self-center">Ctrl+Enter</span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                {donor?.notes?.trim() ? (
                                  <p
                                    className="text-foreground/70 italic cursor-text hover:bg-muted/30 rounded px-1 -mx-1 transition-colors whitespace-pre-wrap"
                                    title="Düzenlemek için tıklayın"
                                    onClick={() => setEditingNote({ donationId: r.donationId, value: donor.notes?.trim() || "" })}
                                  >
                                    {donor.notes.trim()}
                                  </p>
                                ) : (
                                  <button
                                    className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground italic"
                                    onClick={() => setEditingNote({ donationId: r.donationId, value: "" })}
                                  >
                                    + not ekle
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground/80 italic">
                            {r.summary?.trim() ? r.summary : "—"}
                          </td>
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

        {/* Right Log Panel */}
        <div className="w-[300px] shrink-0 border-l flex flex-col bg-background">
          <div className="flex items-center border-b shrink-0">
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${liveLogTab === "live" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setLiveLogTab("live")}
            >
              <Terminal className="w-3.5 h-3.5" />
              Canlı Log
              {aiRunning && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />}
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${liveLogTab === "history" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setLiveLogTab("history")}
            >
              <History className="w-3.5 h-3.5" />
              Geçmiş
            </button>
          </div>

          {liveLogTab === "live" ? (
            <div className="flex flex-col flex-1 min-h-0">
              {aiRunning && recentResults.length > 0 && (
                <div className="border-b bg-muted/30 p-2 space-y-1 shrink-0 max-h-[220px] overflow-y-auto">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />Son İşlenen
                  </p>
                  {recentResults.map(r => (
                    <div key={r.donationId} className={`text-[10px] rounded p-1.5 ${r.warnings ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50" : "bg-muted/60"}`}>
                      <div className="font-medium text-foreground/80 truncate">{r.name}</div>
                      {r.cats.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {r.cats.slice(0, 4).map(c => (
                            <span key={c} className="px-1 rounded text-[9px] bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">{c.replace(/_/g, " ")}</span>
                          ))}
                        </div>
                      )}
                      {r.summary && <p className="text-muted-foreground/60 mt-0.5 line-clamp-1 italic">{r.summary}</p>}
                      {r.warnings && <p className="text-amber-600 dark:text-amber-400 mt-0.5 font-medium">⚠ {r.warnings}</p>}
                    </div>
                  ))}
                </div>
              )}
              <div ref={liveLogScrollRef} className="flex-1 overflow-y-auto p-2">
                {liveLogEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
                    <Terminal className="w-8 h-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground/50">Sınıflandırma başlatıldığında<br />işlem logları burada görünür</p>
                  </div>
                ) : (
                  liveLogEntries.map(entry => <LogEntry key={entry.id} entry={entry} />)
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {(jobLogsData?.logs ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
                  <History className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground/50">Henüz tamamlanmış<br />bir sınıflandırma işi yok</p>
                </div>
              ) : (jobLogsData?.logs ?? []).map((log: AiJobLog) => {
                const completedDate = log.completedAt ? new Date(log.completedAt) : null;
                const durationSec = log.durationMs != null ? Math.round(log.durationMs / 1000) : null;
                let topCats: [string, number][] = [];
                if (log.categoryDistribution) {
                  try {
                    const dist = JSON.parse(log.categoryDistribution) as Record<string, number>;
                    topCats = Object.entries(dist).slice(0, 3);
                  } catch {}
                }
                return (
                  <div key={log.id} className="rounded-md bg-muted/40 border px-2.5 py-2 text-[11px] space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-foreground">{log.donationCount} bağış</span>
                      <div className="flex items-center gap-1.5">
                        {log.avgConfidenceScore != null && (
                          <span className={`font-semibold ${log.avgConfidenceScore >= 7 ? "text-green-600 dark:text-green-400" : log.avgConfidenceScore >= 4 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                            ★{log.avgConfidenceScore.toFixed(1)}
                          </span>
                        )}
                        {log.warningCount > 0 && (
                          <span className="text-destructive font-semibold flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" />{log.warningCount}
                          </span>
                        )}
                      </div>
                    </div>
                    {topCats.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {topCats.map(([cat, count]) => (
                          <span key={cat} className="bg-muted rounded px-1 text-muted-foreground">{cat.replace(/_/g, " ")} ({count})</span>
                        ))}
                      </div>
                    )}
                    <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
                      {completedDate && <span>{completedDate.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} {completedDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>}
                      {durationSec != null && <span>{durationSec}s</span>}
                      {log.errorBatchCount > 0 && <span className="text-amber-600">{log.errorBatchCount}/{log.totalBatches} hata</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
