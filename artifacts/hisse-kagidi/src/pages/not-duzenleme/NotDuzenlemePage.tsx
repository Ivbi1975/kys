import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Search,
  Replace,
  Trash2,
  Loader2,
  Settings2,
  Undo2,
  Redo2,
  Home,
  ChevronRight,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import {
  fetchKesimAlani,
  fetchProjects,
  bulkUpdateNotes,
  classifyNotesAsyncChunked,
  PartialChunkError,
  fetchJobStatus,
  cancelJob,
  fetchActiveJob,
  saveAiClassifications,
  API_BASE,
  ApiFetchError,
  getApiKey,
} from "@/lib/api";
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
import type { LocalDonation, AiResult, HistoryDiff } from "./types";
import { MAX_HISTORY } from "./types";
import { AiClassification } from "./AiClassification";
import { DonationsTable, type DonationsTableHandle } from "./DonationsTable";

const AUTO_SAVE_DEBOUNCE_MS = 5000;

export default function NotDuzenlemePage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [donations, setDonations] = useState<LocalDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);

  const historyRef = useRef<HistoryDiff[]>([]);
  const historyIndexRef = useRef(-1);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const updateHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyIndexRef.current >= 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [hideEmptyNotes, setHideEmptyNotes] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplaceBar, setShowReplaceBar] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [aiRunning, setAiRunning] = useState(false);
  const [aiStopped, setAiStopped] = useState(false);
  const [aiResults, setAiResults] = useState<Map<string, AiResult>>(new Map());
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [aiSaveStatus, setAiSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [batchSize, setBatchSize] = useState(25);
  const [rangeMode, setRangeMode] = useState<"all" | "range">("all");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(50);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiErrorBatches, setAiErrorBatches] = useState(0);
  const [aiTotalBatches, setAiTotalBatches] = useState(0);
  const [showAiReport, setShowAiReport] = useState(false);
  const [aiReportCollapsed, setAiReportCollapsed] = useState(false);
  const [aiCategoryFilter, setAiCategoryFilter] = useState<string | null>(null);
  const [skipClassified, setSkipClassified] = useState(false);
  const activeJobIdsRef = useRef<string[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pushHistory = useCallback((prevDonations: LocalDonation[], nextDonations: LocalDonation[]) => {
    const changes = new Map<string, { prevNotes: string; prevDesc: string; nextNotes: string; nextDesc: string }>();
    for (let i = 0; i < prevDonations.length; i++) {
      const prev = prevDonations[i];
      const next = nextDonations[i];
      if (prev.notes !== next.notes || prev.description !== next.description) {
        changes.set(prev.id, {
          prevNotes: prev.notes,
          prevDesc: prev.description,
          nextNotes: next.notes,
          nextDesc: next.description,
        });
      }
    }
    if (changes.size === 0) return;

    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    trimmed.push({ changes });
    if (trimmed.length > MAX_HISTORY) trimmed.shift();
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
    updateHistoryState();
  }, [updateHistoryState]);

  const undo = useCallback(() => {
    if (historyIndexRef.current < 0) return;
    const diff = historyRef.current[historyIndexRef.current];
    historyIndexRef.current -= 1;
    setDonations(prev => {
      const next = [...prev];
      for (let i = 0; i < next.length; i++) {
        const change = diff.changes.get(next[i].id);
        if (change) {
          next[i] = { ...next[i], notes: change.prevNotes, description: change.prevDesc };
        }
      }
      return next;
    });
    setDirty(true);
    updateHistoryState();
  }, [updateHistoryState]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const diff = historyRef.current[historyIndexRef.current];
    setDonations(prev => {
      const next = [...prev];
      for (let i = 0; i < next.length; i++) {
        const change = diff.changes.get(next[i].id);
        if (change) {
          next[i] = { ...next[i], notes: change.nextNotes, description: change.nextDesc };
        }
      }
      return next;
    });
    setDirty(true);
    updateHistoryState();
  }, [updateHistoryState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable;
      if (isEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const kesimRef = useRef<KesimAlani | null>(null);
  const donationsRef = useRef<LocalDonation[]>([]);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => { kesimRef.current = kesim; }, [kesim]);
  useEffect(() => { donationsRef.current = donations; }, [donations]);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { savingRef.current = saving; }, [saving]);

  const origDonationMapRef = useRef<Map<string, { notes: string; description: string }>>(new Map());

  const computeUpdates = useCallback(() => {
    const currentKesim = kesimRef.current;
    const currentDonations = donationsRef.current;
    if (!currentKesim) return null;
    const origMap = origDonationMapRef.current;
    const updates: { donationId: string; notes?: string; description?: string }[] = [];
    for (const d of currentDonations) {
      const orig = origMap.get(d.id);
      if (!orig) continue;
      const entry: { donationId: string; notes?: string; description?: string } = { donationId: d.id };
      if (orig.notes !== d.notes) entry.notes = d.notes;
      if (orig.description !== (d.description || "")) entry.description = d.description;
      if (entry.notes !== undefined || entry.description !== undefined) updates.push(entry);
    }
    return updates.length > 0 ? { kesimAlaniId: currentKesim.id, updates } : null;
  }, []);

  const performAutoSave = useCallback(async () => {
    if (!dirtyRef.current || savingRef.current) return;
    const data = computeUpdates();
    if (!data) { setDirty(false); return; }

    setSaving(true);
    try {
      await bulkUpdateNotes(data.kesimAlaniId, data.updates);
      setKesim(prev => {
        if (!prev) return prev;
        const updateMap = new Map(data.updates.map(u => [u.donationId, u]));
        const applyUpdate = <T extends { id: string; notes: string; description: string }>(d: T): T => {
          const u = updateMap.get(d.id);
          if (!u) return d;
          return { ...d, ...(u.notes !== undefined ? { notes: u.notes } : {}), ...(u.description !== undefined ? { description: u.description } : {}) };
        };
        return { ...prev, donations: prev.donations.map(applyUpdate), animalGroups: prev.animalGroups.map(g => ({ ...g, donations: g.donations.map(applyUpdate) })) };
      });
      for (const u of data.updates) {
        const existing = origDonationMapRef.current.get(u.donationId);
        if (existing) {
          origDonationMapRef.current.set(u.donationId, {
            notes: u.notes !== undefined ? u.notes : existing.notes,
            description: u.description !== undefined ? u.description : existing.description,
          });
        }
      }
      setDirty(false);
    } catch {
    } finally { setSaving(false); }
  }, [computeUpdates]);

  const autoSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (dirty) {
      if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
      autoSaveDebounceRef.current = setTimeout(() => { performAutoSave(); }, AUTO_SAVE_DEBOUNCE_MS);
    }
    return () => { if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current); };
  }, [dirty, donations, performAutoSave]);

  useEffect(() => {
    autoSaveIntervalRef.current = setInterval(() => {
      if (dirtyRef.current && !savingRef.current) {
        performAutoSave();
      }
    }, AUTO_SAVE_DEBOUNCE_MS * 2);
    return () => { if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current); };
  }, [performAutoSave]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
        const data = computeUpdates();
        if (data) {
          const payload = JSON.stringify({ kesimAlaniId: data.kesimAlaniId, updates: data.updates });
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          const apiKey = getApiKey();
          if (apiKey) headers["X-API-Key"] = apiKey;
          try {
            fetch(`${API_BASE}/ai-notes/bulk-update`, {
              method: "PUT",
              headers,
              body: payload,
              keepalive: true,
            });
          } catch {}
        }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [computeUpdates]);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    setLoadError(null);
    fetchKesimAlani(params.id).then(async (data) => {
      if (!data) { setLoadError("Kesim alanı bulunamadı"); setLoading(false); return; }
      setKesim(data);
      if (data.projectId) {
        try { const projects = await fetchProjects(); const proj = projects.find(p => p.id === data.projectId); if (proj) setProjectName(proj.name); } catch {}
      }
      const allDonations: LocalDonation[] = [];
      const seenIds = new Set<string>();
      const origMap = new Map<string, { notes: string; description: string }>();
      const addDonation = (d: typeof data.donations[0]) => {
        if (seenIds.has(d.id)) return;
        seenIds.add(d.id);
        allDonations.push({ id: d.id, name: d.name || "", description: d.description || "", donationType: d.donationType || "", vekalet: d.vekalet || "", notes: d.notes || "", aiCategories: d.aiCategories, aiWarnings: d.aiWarnings });
        origMap.set(d.id, { notes: d.notes || "", description: d.description || "" });
      };
      for (const d of data.donations) addDonation(d);
      for (const g of data.animalGroups) for (const d of g.donations) addDonation(d);
      origDonationMapRef.current = origMap;
      setDonations(allDonations);
      const initialAiResults = new Map<string, AiResult>();
      for (const d of allDonations) {
        if ((d.aiCategories && d.aiCategories.length > 0) || (d.aiWarnings && d.aiWarnings.trim() !== "")) {
          initialAiResults.set(d.id, { donationId: d.id, categories: d.aiCategories || [], warnings: d.aiWarnings || "", requests: "", summary: "", donationType: d.donationType });
        }
      }
      if (initialAiResults.size > 0) setAiResults(initialAiResults);
      historyRef.current = [];
      historyIndexRef.current = -1;
      updateHistoryState();
      setLoading(false);

      try {
        const { job } = await fetchActiveJob(data.id);
        if (job) {
          activeJobIdsRef.current = [job.jobId];
          setAiRunning(true);
          setAiProgress({ done: job.processedDonations, total: job.totalDonations });
          setShowAiPanel(true);
          startPolling([job.jobId], allDonations);
        }
      } catch {}
    }).catch((err) => {
      setLoadError(err instanceof Error ? err.message : "Veriler yüklenirken bir hata oluştu");
      setLoading(false);
    });
  }, [params.id]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => { return () => { stopPolling(); }; }, [stopPolling]);

  const startPolling = useCallback((jobIds: string[], donationsList?: LocalDonation[]) => {
    stopPolling();
    const finishedJobs = new Set<string>();
    const jobProgressMap = new Map<string, { done: number; total: number }>();
    const jobErrorMap = new Map<string, number>();
    const jobBatchMap = new Map<string, number>();
    const allCollectedResults: { donationId: string; categories: string[]; warnings: string }[] = [];
    let isPolling = false;

    const poll = async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const activeIds = jobIds.filter(id => !finishedJobs.has(id));
        const statuses = await Promise.all(activeIds.map(id => fetchJobStatus(id).catch(() => null)));

        for (let i = 0; i < activeIds.length; i++) {
          const status = statuses[i];
          if (!status) continue;
          const jid = activeIds[i];

          const prev = jobProgressMap.get(jid);
          jobProgressMap.set(jid, {
            done: status.processedDonations,
            total: Math.max(status.totalDonations, prev?.total ?? 0),
          });

          if (status.failedBatchCount !== undefined) {
            jobErrorMap.set(jid, status.failedBatchCount);
          }
          if (status.totalBatches !== undefined) {
            jobBatchMap.set(jid, status.totalBatches);
          }

          if (status.results && status.results.length > 0) {
            const currentDonations = donationsList || donationsRef.current;
            const donationMap = new Map(currentDonations.map(d => [d.id, d]));
            setAiResults(prev => {
              const next = new Map(prev);
              for (const r of status.results!) {
                const donor = donationMap.get(r.donationId);
                const donationType = donor?.donationType || "";
                let warnings = r.warnings || "";
                if (warnings && donationType && r.categories) {
                  const dtLower = donationType.toLocaleLowerCase("tr");
                  const catsLower = r.categories.map(c => c.toLocaleLowerCase("tr"));
                  if (catsLower.includes(dtLower)) {
                    warnings = warnings
                      .split(/[.;]\s*/)
                      .filter(s => !s.toLocaleLowerCase("tr").includes(dtLower) || s.toLocaleLowerCase("tr").includes("tutarsız"))
                      .join(". ")
                      .trim();
                    if (warnings === "." || warnings === ",") warnings = "";
                  }
                }
                next.set(r.donationId, { ...r, warnings, donationType });
              }
              console.log(`[AI Poll] job=${jid} statusResults=${status.results!.length} mapSize=${next.size}`);
              return next;
            });
          }

          if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") {
            finishedJobs.add(jid);
            if (status.results && status.results.length > 0) {
              allCollectedResults.push(...status.results.map(r => ({ donationId: r.donationId, categories: r.categories || [], warnings: r.warnings || "" })));
            }
            if (status.status === "cancelled") {
              setAiStopped(true);
            }
            if (status.status === "failed") {
              toast({ title: "AI İşlemi Başarısız", description: status.error || "Bilinmeyen hata", variant: "destructive" });
            }
          }
        }

        let totalDone = 0;
        let totalAll = 0;
        for (const p of jobProgressMap.values()) {
          totalDone += p.done;
          totalAll += p.total;
        }
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

          const expectedTotal = Array.from(jobProgressMap.values()).reduce((s, p) => s + p.total, 0);
          if (allCollectedResults.length > 0 && allCollectedResults.length < expectedTotal) {
            console.warn(`[AI Reconciliation] Expected ${expectedTotal} results but got ${allCollectedResults.length} — ${expectedTotal - allCollectedResults.length} missing`);
            toast({ title: "Eksik sonuç", description: `${expectedTotal} bağışçıdan ${allCollectedResults.length} tanesi işlendi. ${expectedTotal - allCollectedResults.length} sonuç eksik.`, variant: "destructive" });
          }

          if (allCollectedResults.length > 0) {
            try {
              setAiSaveStatus("saving");
              const SAVE_CHUNK = 2000;
              for (let si = 0; si < allCollectedResults.length; si += SAVE_CHUNK) {
                await saveAiClassifications(allCollectedResults.slice(si, si + SAVE_CHUNK));
              }
              setAiSaveStatus("saved");
              const catMap = new Map(allCollectedResults.map(r => [r.donationId, r.categories]));
              setDonations(prev => prev.map(d => {
                const cats = catMap.get(d.id);
                return cats ? { ...d, aiCategories: cats } : d;
              }));
            } catch { setAiSaveStatus("error"); }
          }

          setShowAiReport(true);
          setAiReportCollapsed(false);
        }
      } catch {} finally { isPolling = false; }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 3000);
  }, [stopPolling, toast]);

  const filteredDonations = useMemo(() => {
    return donations.filter(d => {
      const notes = d.notes || "";
      if (hideEmptyNotes && notes.trim() === "") return false;
      if (aiCategoryFilter) {
        const aiResult = aiResults.get(d.id);
        if (!aiResult?.categories || !aiResult.categories.some(c => c.toLocaleLowerCase("tr") === aiCategoryFilter.toLocaleLowerCase("tr"))) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return notes.toLowerCase().includes(q) || (d.name || "").toLowerCase().includes(q) || (d.description || "").toLowerCase().includes(q);
    });
  }, [donations, hideEmptyNotes, searchQuery, aiCategoryFilter, aiResults]);

  const idToIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < donations.length; i++) {
      map.set(donations[i].id, i);
    }
    return map;
  }, [donations]);

  const filteredIdToIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < filteredDonations.length; i++) {
      map.set(filteredDonations[i].id, i);
    }
    return map;
  }, [filteredDonations]);

  const donationsTableRef = useRef<DonationsTableHandle>(null);

  const updateDonationsWithHistory = useCallback((updater: (prev: LocalDonation[]) => LocalDonation[]) => {
    setDonations(prev => { const next = updater(prev); pushHistory(prev, next); setDirty(true); return next; });
  }, [pushHistory]);

  const noteChangeBufferRef = useRef<LocalDonation[] | null>(null);

  const handleNoteChange = useCallback((id: string, value: string) => {
    setDonations(prev => {
      if (!noteChangeBufferRef.current) {
        noteChangeBufferRef.current = prev;
      }
      const idx = idToIndexMap.get(id);
      if (idx === undefined) return prev;
      const next = [...prev];
      next[idx] = { ...prev[idx], notes: value };
      return next;
    });
    setDirty(true);
  }, [idToIndexMap]);

  const commitNoteChange = useCallback((_id: string) => {
    setDonations(prev => {
      const before = noteChangeBufferRef.current;
      if (before) {
        pushHistory(before, prev);
        noteChangeBufferRef.current = null;
      }
      return prev;
    });
  }, [pushHistory]);

  const handleBulkReplace = () => {
    if (!findText.trim()) return;
    let count = 0;
    updateDonationsWithHistory(prev => prev.map(d => {
      const notes = d.notes || "";
      if (notes.includes(findText)) { count++; return { ...d, notes: notes.replaceAll(findText, replaceText) }; }
      return d;
    }));
    toast({ title: count > 0 ? "Değiştirildi" : "Bulunamadı", description: count > 0 ? `${count} bağışçıda "${findText}" → "${replaceText}" değiştirildi` : `"${findText}" metni hiçbir notta bulunamadı` });
  };

  const handleBulkDeleteNotes = () => {
    if (filteredDonations.filter(d => (d.notes || "").trim() !== "").length === 0) { toast({ title: "Silinecek not yok" }); return; }
    setDeleteConfirmOpen(true);
  };

  const confirmBulkDeleteNotes = () => {
    const targetIds = new Set(filteredDonations.map(d => d.id));
    updateDonationsWithHistory(prev => prev.map(d => targetIds.has(d.id) ? { ...d, notes: "" } : d));
    toast({ title: "Notlar silindi", description: `${targetIds.size} bağışçının notu temizlendi` });
  };

  const handleQuickClean = (pattern: string) => {
    let count = 0;
    updateDonationsWithHistory(prev => prev.map(d => {
      const notes = d.notes || "";
      if (notes.includes(pattern)) { count++; return { ...d, notes: notes.replaceAll(pattern, "").replace(/\s{2,}/g, " ").trim() }; }
      return d;
    }));
    toast({ title: count > 0 ? "Temizlendi" : "Bulunamadı", description: count > 0 ? `${count} bağışçıda "${pattern}" temizlendi` : `"${pattern}" metni hiçbir notta bulunamadı` });
  };

  const DONATION_TYPE_LABELS = ["adak", "akika", "vacip", "nafile"];

  const handleAddLabelsToDescriptions = () => {
    let count = 0;
    updateDonationsWithHistory(prev => prev.map(d => {
      const aiResult = aiResults.get(d.id);
      if (!aiResult?.categories || aiResult.categories.length === 0) return d;
      const labelsToAdd = aiResult.categories.filter(cat => {
        const catLower = cat.toLocaleLowerCase("tr");
        return !DONATION_TYPE_LABELS.some(dt => dt.toLocaleLowerCase("tr") === catLower);
      });
      if (labelsToAdd.length === 0) return d;
      const currentDesc = (d.description || "").trim();
      const descLower = currentDesc.toLocaleLowerCase("tr");
      const newLabels = labelsToAdd.filter(l => {
        const displayForm = l.replace(/_/g, " ").toLocaleLowerCase("tr");
        const rawForm = l.toLocaleLowerCase("tr");
        return !descLower.includes(displayForm) && !descLower.includes(rawForm);
      });
      if (newLabels.length === 0) return d;
      count++;
      const labelStr = newLabels.map(l => l.replace(/_/g, " ")).join(", ");
      return { ...d, description: currentDesc ? `${currentDesc} [${labelStr}]` : `[${labelStr}]` };
    }));
    toast({ title: count > 0 ? "Etiketler Eklendi" : "Eklenecek etiket yok", description: count > 0 ? `${count} bağışçının açıklamasına etiketler eklendi` : "Tüm etiketler zaten mevcut veya donationType ile eşleşiyor" });
  };

  const handleSave = async () => {
    if (!kesim) return;
    setSaving(true);
    try {
      const origMap = origDonationMapRef.current;
      const updates: { donationId: string; notes?: string; description?: string }[] = [];
      for (const d of donations) {
        const orig = origMap.get(d.id);
        if (!orig) continue;
        const entry: { donationId: string; notes?: string; description?: string } = { donationId: d.id };
        if (orig.notes !== d.notes) entry.notes = d.notes;
        if (orig.description !== (d.description || "")) entry.description = d.description;
        if (entry.notes !== undefined || entry.description !== undefined) updates.push(entry);
      }
      if (updates.length === 0) { toast({ title: "Değişiklik yok" }); setSaving(false); setDirty(false); return; }
      await bulkUpdateNotes(kesim.id, updates);
      setKesim(prev => {
        if (!prev) return prev;
        const updateMap = new Map(updates.map(u => [u.donationId, u]));
        const applyUpdate = <T extends { id: string; notes: string; description: string }>(d: T): T => {
          const u = updateMap.get(d.id);
          if (!u) return d;
          return {
            ...d,
            ...(u.notes !== undefined ? { notes: u.notes } : {}),
            ...(u.description !== undefined ? { description: u.description } : {}),
          };
        };
        return { ...prev, donations: prev.donations.map(applyUpdate), animalGroups: prev.animalGroups.map(g => ({ ...g, donations: g.donations.map(applyUpdate) })) };
      });
      for (const u of updates) {
        const existing = origDonationMapRef.current.get(u.donationId);
        if (existing) {
          origDonationMapRef.current.set(u.donationId, {
            notes: u.notes !== undefined ? u.notes : existing.notes,
            description: u.description !== undefined ? u.description : existing.description,
          });
        }
      }
      setDirty(false);
      const noteCount = updates.filter(u => u.notes !== undefined).length;
      const descCount = updates.filter(u => u.description !== undefined).length;
      const parts = [];
      if (noteCount > 0) parts.push(`${noteCount} not`);
      if (descCount > 0) parts.push(`${descCount} açıklama`);
      toast({ title: "Kaydedildi", description: `${parts.join(" ve ")} güncellendi` });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Kaydetme hatası", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const notesWithContent = useMemo(() => donations.filter(d => (d.notes || "").trim() !== ""), [donations]);

  const startAiClassification = async (resume = false) => {
    if (!kesim) return;
    setAiRunning(true); setAiStopped(false); setAiSaveStatus("idle"); setAiErrorBatches(0); setAiTotalBatches(0); setShowAiReport(false); setAiReportCollapsed(false);
    if (!resume) { setAiResults(new Map()); }
    let toProcess: LocalDonation[];
    if (rangeMode === "all") { toProcess = donations; } else { toProcess = donations.slice(Math.max(1, rangeStart) - 1, Math.min(donations.length, rangeEnd)); }
    let withNotes = toProcess.filter(d => (d.notes || "").trim() !== "");
    if (resume) {
      withNotes = withNotes.filter(d => !aiResults.has(d.id));
    }
    if (skipClassified) {
      const beforeCount = withNotes.length;
      withNotes = withNotes.filter(d => !d.aiCategories || d.aiCategories.length === 0);
      if (beforeCount > withNotes.length) {
        console.log(`[AI] Skipped ${beforeCount - withNotes.length} already classified donations`);
      }
    }
    if (withNotes.length === 0) { toast({ title: resume ? "Devam edilecek not yok" : "İşlenecek not yok", description: resume ? "Tüm bağışçılar zaten işlenmiş" : skipClassified ? "Tüm notlu bağışçılar zaten sınıflandırılmış" : "Notu olan bağışçı bulunamadı" }); setAiRunning(false); return; }
    console.log(`[AI Start] totalDonations=${toProcess.length} withNotes=${withNotes.length} resume=${resume}`);
    const previouslyDone = resume ? aiResults.size : 0;
    const totalToProcess = previouslyDone + withNotes.length;
    setAiProgress({ done: previouslyDone, total: totalToProcess });

    try {
      const { jobIds } = await classifyNotesAsyncChunked(
        withNotes.map(d => ({ id: d.id, name: d.name || d.description || "", donationType: d.donationType || "", vekalet: d.vekalet || "", notes: d.notes || "" })),
        kesim.id
      );
      activeJobIdsRef.current = jobIds;
      startPolling(jobIds);
    } catch (err) {
      if (err instanceof PartialChunkError && err.jobIds.length > 0) {
        activeJobIdsRef.current = err.jobIds;
        startPolling(err.jobIds);
        toast({ title: "Kısmi başlatma", description: `${err.message}. Başarılı parçalar işlenmeye devam ediyor.`, variant: "destructive" });
        return;
      }
      setAiRunning(false);
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      const details = err instanceof ApiFetchError ? err.details : undefined;
      const detailStr = details
        ? details.map(d => `${(d.path || []).join(".")}: ${d.message || ""}`).join(", ")
        : "";
      toast({ title: "AI Başlatılamadı", description: detailStr ? `${msg} (${detailStr})` : msg, variant: "destructive" });
    }
  };

  const stopAiClassification = async () => {
    const jobIds = activeJobIdsRef.current;
    if (jobIds.length > 0) {
      await Promise.all(jobIds.map(id => cancelJob(id).catch(() => {})));
    }
    setAiStopped(true);
  };

  const highlightRow = useCallback((donationId: string) => {
    setTimeout(() => {
      const row = document.querySelector(`[data-donation-id="${donationId}"]`);
      if (row) {
        row.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => { row.classList.remove("ring-2", "ring-primary", "ring-offset-2"); }, 2000);
      }
    }, 100);
  }, []);

  const pendingScrollRef = useRef<string | null>(null);

  useEffect(() => {
    if (pendingScrollRef.current) {
      const donationId = pendingScrollRef.current;
      const filteredIdx = filteredIdToIndexMap.get(donationId);
      if (filteredIdx !== undefined) {
        pendingScrollRef.current = null;
        donationsTableRef.current?.scrollToIndex(filteredIdx);
        highlightRow(donationId);
      }
    }
  }, [filteredIdToIndexMap, highlightRow]);

  const scrollToDonation = useCallback((donationId: string) => {
    const filteredIdx = filteredIdToIndexMap.get(donationId);
    if (filteredIdx !== undefined) {
      donationsTableRef.current?.scrollToIndex(filteredIdx);
      highlightRow(donationId);
      return;
    }

    pendingScrollRef.current = donationId;
    if (searchQuery) setSearchQuery("");
    if (hideEmptyNotes) setHideEmptyNotes(() => false);
    if (aiCategoryFilter) setAiCategoryFilter(null);
  }, [filteredIdToIndexMap, searchQuery, hideEmptyNotes, aiCategoryFilter, highlightRow, setAiCategoryFilter]);

  const aiReportStats = (() => {
    const results = Array.from(aiResults.values());
    const withWarnings = results.filter(r => r.warnings && r.warnings.trim() !== "");
    const withRequests = results.filter(r => r.requests && r.requests.trim() !== "");
    const categoryMap = new Map<string, number>();
    const categoryCanonical = new Map<string, string>();
    for (const r of results) {
      if (r.categories) for (const cat of r.categories) {
        const key = cat.toLocaleLowerCase("tr");
        if (!categoryCanonical.has(key)) categoryCanonical.set(key, cat);
        const canonical = categoryCanonical.get(key)!;
        categoryMap.set(canonical, (categoryMap.get(canonical) || 0) + 1);
      }
    }
    return { totalProcessed: results.length, warningDonors: withWarnings, warningCount: withWarnings.length, requestCount: withRequests.length, categoryDistribution: Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]), errorBatches: aiErrorBatches, totalBatches: aiTotalBatches };
  })();

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (loadError) return <div className="flex flex-col items-center justify-center h-screen gap-4"><AlertTriangle className="w-10 h-10 text-destructive" /><p className="text-sm text-muted-foreground">{loadError}</p><Button variant="outline" onClick={() => setLocation("/")}>Ana Sayfaya Dön</Button></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex flex-col gap-1 p-3">
          <nav className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
            <button onClick={() => setLocation("/")} className="flex items-center gap-1 hover:text-foreground transition-colors"><Home className="w-3 h-3" /><span>Ana Sayfa</span></button>
            {kesim?.projectId && projectName && (<><ChevronRight className="w-3 h-3" /><button onClick={() => setLocation(`/proje/${kesim.projectId}`)} className="hover:text-foreground transition-colors truncate max-w-[120px]">{projectName}</button></>)}
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => setLocation(`/kesim/${params.id}`)} className="hover:text-foreground transition-colors truncate max-w-[120px]">{kesim?.name || "Kesim Alanı"}</button>
            <ChevronRight className="w-3 h-3" /><span className="text-foreground font-medium">Notlar</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold truncate">Not Düzenleme</h1>
              <p className="text-xs text-muted-foreground truncate">
                {kesim?.name} — {donations.length} bağışçı, {notesWithContent.length} notu olan
                {saving && <span className="ml-2 text-primary">Kaydediliyor...</span>}
                {!saving && !dirty && <span className="ml-2 text-green-600">Kaydedildi</span>}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={undo} disabled={!historyState.canUndo} title="Geri Al (Ctrl+Z)"><Undo2 className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={redo} disabled={!historyState.canRedo} title="İleri Al (Ctrl+Y)"><Redo2 className="w-4 h-4" /></Button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setLocation(`/ai-prompt-ayarlari`)}><Settings2 className="w-4 h-4 mr-1" />AI Ayarları</Button>
              {dirty && <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Kaydet</Button>}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-6xl mx-auto space-y-4">
        <Card className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input placeholder="Notlarda ara..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setShowReplaceBar(!showReplaceBar)}><Replace className="w-4 h-4 mr-1" />Değiştir</Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickClean("- kk")} title="Tüm notlardan '- kk' kalıbını temizle"><Sparkles className="w-4 h-4 mr-1" />- kk</Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickClean("- hvl")} title="Tüm notlardan '- hvl' kalıbını temizle"><Sparkles className="w-4 h-4 mr-1" />- hvl</Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDeleteNotes}><Trash2 className="w-4 h-4 mr-1" />Notları Sil</Button>
          </div>
          {showReplaceBar && (
            <div className="flex items-center gap-2 pt-1">
              <Input placeholder="Bul..." value={findText} onChange={e => setFindText(e.target.value)} className="flex-1" />
              <Input placeholder="Değiştir..." value={replaceText} onChange={e => setReplaceText(e.target.value)} className="flex-1" />
              <Button size="sm" onClick={handleBulkReplace}>Tümünü Değiştir</Button>
            </div>
          )}
        </Card>

        <AiClassification
          donations={donations} notesWithContent={notesWithContent} aiRunning={aiRunning} aiStopped={aiStopped}
          aiResults={aiResults} aiProgress={aiProgress} showAiPanel={showAiPanel} setShowAiPanel={setShowAiPanel}
          rangeMode={rangeMode} setRangeMode={setRangeMode} rangeStart={rangeStart} setRangeStart={setRangeStart}
          rangeEnd={rangeEnd} setRangeEnd={setRangeEnd} batchSize={batchSize} setBatchSize={setBatchSize}
          startAiClassification={startAiClassification} stopAiClassification={stopAiClassification}
          skipClassified={skipClassified} setSkipClassified={setSkipClassified}
          showAiReport={showAiReport} setShowAiReport={setShowAiReport}
          aiReportCollapsed={aiReportCollapsed} setAiReportCollapsed={setAiReportCollapsed}
          aiReportStats={aiReportStats} scrollToDonation={scrollToDonation}
          aiCategoryFilter={aiCategoryFilter} setAiCategoryFilter={setAiCategoryFilter}
          handleAddLabelsToDescriptions={handleAddLabelsToDescriptions}
        />

        <DonationsTable
          ref={donationsTableRef}
          donations={donations} filteredDonations={filteredDonations} searchQuery={searchQuery}
          hideEmptyNotes={hideEmptyNotes} setHideEmptyNotes={setHideEmptyNotes}
          aiRunning={aiRunning} aiResults={aiResults}
          handleNoteChange={handleNoteChange} commitNoteChange={commitNoteChange}
          updateDonationsWithHistory={updateDonationsWithHistory}
          aiCategoryFilter={aiCategoryFilter} setAiCategoryFilter={setAiCategoryFilter}
          idToIndexMap={idToIndexMap}
        />
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notları Sil</AlertDialogTitle>
            <AlertDialogDescription>
              {searchQuery ? `Filtrelenmiş ${filteredDonations.filter(d => (d.notes || "").trim() !== "").length} bağışçının notu silinecek.` : `${notesWithContent.length} bağışçının tüm notları silinecek.`}
              Bu işlem geri alınabilir (Geri Al butonuyla veya Ctrl+Z ile geri alabilirsiniz).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={confirmBulkDeleteNotes}>Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
