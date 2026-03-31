import { useState, useEffect, useRef, useCallback } from "react";
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
  classifyNotesAsync,
  fetchJobStatus,
  cancelJob,
  fetchActiveJob,
  saveAiClassifications,
  API_BASE,
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
import type { LocalDonation, AiResult } from "./types";
import { MAX_HISTORY } from "./types";
import { AiClassification } from "./AiClassification";
import { DonationsTable } from "./DonationsTable";

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
  const [showAiReport, setShowAiReport] = useState(false);
  const [aiReportCollapsed, setAiReportCollapsed] = useState(false);
  const [aiCategoryFilter, setAiCategoryFilter] = useState<string | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const computeUpdates = useCallback(() => {
    const currentKesim = kesimRef.current;
    const currentDonations = donationsRef.current;
    if (!currentKesim) return null;
    const updates: { donationId: string; notes?: string; description?: string }[] = [];
    for (const d of currentDonations) {
      const orig = currentKesim.donations.find(x => x.id === d.id) || currentKesim.animalGroups.flatMap(g => g.donations).find(x => x.id === d.id);
      if (!orig) continue;
      const entry: { donationId: string; notes?: string; description?: string } = { donationId: d.id };
      if (orig.notes !== d.notes) entry.notes = d.notes;
      if ((orig.description || "") !== (d.description || "")) entry.description = d.description;
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
          try {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", `${API_BASE}/ai-notes/bulk-update`, false);
            xhr.setRequestHeader("Content-Type", "application/json");
            const apiKey = getApiKey();
            if (apiKey) xhr.setRequestHeader("X-API-Key", apiKey);
            xhr.send(JSON.stringify({ kesimAlaniId: data.kesimAlaniId, updates: data.updates }));
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
      for (const d of data.donations) {
        if (!allDonations.find(x => x.id === d.id)) {
          allDonations.push({ id: d.id, name: d.name || "", description: d.description || "", donationType: d.donationType || "", vekalet: d.vekalet || "", notes: d.notes || "", aiCategories: d.aiCategories, aiWarnings: d.aiWarnings });
        }
      }
      for (const g of data.animalGroups) {
        for (const d of g.donations) {
          if (!allDonations.find(x => x.id === d.id)) {
            allDonations.push({ id: d.id, name: d.name || "", description: d.description || "", donationType: d.donationType || "", vekalet: d.vekalet || "", notes: d.notes || "", aiCategories: d.aiCategories, aiWarnings: d.aiWarnings });
          }
        }
      }
      setDonations(allDonations);
      const initialAiResults = new Map<string, AiResult>();
      for (const d of allDonations) {
        if ((d.aiCategories && d.aiCategories.length > 0) || (d.aiWarnings && d.aiWarnings.trim() !== "")) {
          initialAiResults.set(d.id, { donationId: d.id, categories: d.aiCategories || [], warnings: d.aiWarnings || "", requests: "", summary: "", donationType: d.donationType });
        }
      }
      if (initialAiResults.size > 0) setAiResults(initialAiResults);
      historyRef.current = [allDonations];
      historyIndexRef.current = 0;
      updateHistoryState();
      setLoading(false);

      try {
        const { job } = await fetchActiveJob(data.id);
        if (job) {
          activeJobIdRef.current = job.jobId;
          setAiRunning(true);
          setAiProgress({ done: job.processedDonations, total: job.totalDonations });
          setShowAiPanel(true);
          startPolling(job.jobId, allDonations);
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

  const startPolling = useCallback((jobId: string, donationsList?: LocalDonation[]) => {
    stopPolling();

    const poll = async () => {
      try {
        const status = await fetchJobStatus(jobId);
        setAiProgress({ done: status.processedDonations, total: status.totalDonations });

        if (status.results && status.results.length > 0) {
          const currentDonations = donationsList || donationsRef.current;
          setAiResults(prev => {
            const next = new Map(prev);
            for (const r of status.results!) {
              const donor = currentDonations.find(d => d.id === r.donationId);
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
            return next;
          });
        }

        if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") {
          stopPolling();
          setAiRunning(false);
          activeJobIdRef.current = null;

          if (status.status === "cancelled") {
            setAiStopped(true);
          }

          if (status.results && status.results.length > 0) {
            try {
              setAiSaveStatus("saving");
              await saveAiClassifications(status.results.map(r => ({ donationId: r.donationId, categories: r.categories || [], warnings: r.warnings || "" })));
              setAiSaveStatus("saved");
            } catch { setAiSaveStatus("error"); }
          }

          setShowAiReport(true);
          setAiReportCollapsed(false);

          if (status.status === "failed") {
            toast({ title: "AI İşlemi Başarısız", description: status.error || "Bilinmeyen hata", variant: "destructive" });
          }
        }
      } catch {}
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 3000);
  }, [stopPolling, toast]);

  const filteredDonations = donations.filter(d => {
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

  const updateDonationsWithHistory = useCallback((updater: (prev: LocalDonation[]) => LocalDonation[]) => {
    setDonations(prev => { const next = updater(prev); pushHistory(next); setDirty(true); return next; });
  }, [pushHistory]);

  const handleNoteChange = (id: string, value: string) => { setDonations(prev => prev.map(d => d.id === id ? { ...d, notes: value } : d)); setDirty(true); };
  const commitNoteChange = useCallback((_id: string) => { setDonations(prev => { pushHistory(prev); return prev; }); }, [pushHistory]);

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
      const updates: { donationId: string; notes?: string; description?: string }[] = [];
      for (const d of donations) {
        const orig = kesim.donations.find(x => x.id === d.id) || kesim.animalGroups.flatMap(g => g.donations).find(x => x.id === d.id);
        if (!orig) continue;
        const entry: { donationId: string; notes?: string; description?: string } = { donationId: d.id };
        if (orig.notes !== d.notes) entry.notes = d.notes;
        if ((orig.description || "") !== (d.description || "")) entry.description = d.description;
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

  const notesWithContent = donations.filter(d => (d.notes || "").trim() !== "");

  const startAiClassification = async (resume = false) => {
    if (!kesim) return;
    setAiRunning(true); setAiStopped(false); setAiSaveStatus("idle"); setAiErrorBatches(0); setShowAiReport(false); setAiReportCollapsed(false);
    if (!resume) { setAiResults(new Map()); }
    let toProcess: LocalDonation[];
    if (rangeMode === "all") { toProcess = donations; } else { toProcess = donations.slice(Math.max(1, rangeStart) - 1, Math.min(donations.length, rangeEnd)); }
    let withNotes = toProcess.filter(d => (d.notes || "").trim() !== "");
    if (resume) {
      withNotes = withNotes.filter(d => !aiResults.has(d.id));
    }
    if (withNotes.length === 0) { toast({ title: resume ? "Devam edilecek not yok" : "İşlenecek not yok", description: resume ? "Tüm bağışçılar zaten işlenmiş" : "Notu olan bağışçı bulunamadı" }); setAiRunning(false); return; }
    const previouslyDone = resume ? aiResults.size : 0;
    const totalToProcess = previouslyDone + withNotes.length;
    setAiProgress({ done: previouslyDone, total: totalToProcess });

    try {
      const { jobId } = await classifyNotesAsync(
        withNotes.map(d => ({ id: d.id, name: d.name || d.description, donationType: d.donationType, vekalet: d.vekalet, notes: d.notes })),
        kesim.id
      );
      activeJobIdRef.current = jobId;
      startPolling(jobId);
    } catch (err) {
      setAiRunning(false);
      toast({ title: "AI Başlatılamadı", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  };

  const stopAiClassification = async () => {
    const jobId = activeJobIdRef.current;
    if (jobId) {
      try {
        await cancelJob(jobId);
      } catch {}
    }
    setAiStopped(true);
  };

  const scrollToDonation = (donationId: string) => {
    let row = document.querySelector(`[data-donation-id="${donationId}"]`);
    if (!row && searchQuery) {
      setSearchQuery("");
      requestAnimationFrame(() => { setTimeout(() => { row = document.querySelector(`[data-donation-id="${donationId}"]`); if (row) { row.scrollIntoView({ behavior: "smooth", block: "center" }); row.classList.add("ring-2", "ring-primary", "ring-offset-2"); setTimeout(() => { row!.classList.remove("ring-2", "ring-primary", "ring-offset-2"); }, 2000); } }, 100); });
      return;
    }
    if (row) { row.scrollIntoView({ behavior: "smooth", block: "center" }); row.classList.add("ring-2", "ring-primary", "ring-offset-2"); setTimeout(() => { row!.classList.remove("ring-2", "ring-primary", "ring-offset-2"); }, 2000); }
  };

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
    return { totalProcessed: results.length, warningDonors: withWarnings, warningCount: withWarnings.length, requestCount: withRequests.length, categoryDistribution: Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]), errorBatches: aiErrorBatches };
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
          showAiReport={showAiReport} setShowAiReport={setShowAiReport}
          aiReportCollapsed={aiReportCollapsed} setAiReportCollapsed={setAiReportCollapsed}
          aiReportStats={aiReportStats} scrollToDonation={scrollToDonation}
          aiCategoryFilter={aiCategoryFilter} setAiCategoryFilter={setAiCategoryFilter}
          handleAddLabelsToDescriptions={handleAddLabelsToDescriptions}
        />

        <DonationsTable
          donations={donations} filteredDonations={filteredDonations} searchQuery={searchQuery}
          hideEmptyNotes={hideEmptyNotes} setHideEmptyNotes={setHideEmptyNotes}
          aiRunning={aiRunning} aiResults={aiResults}
          handleNoteChange={handleNoteChange} commitNoteChange={commitNoteChange}
          updateDonationsWithHistory={updateDonationsWithHistory}
          aiCategoryFilter={aiCategoryFilter} setAiCategoryFilter={setAiCategoryFilter}
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
