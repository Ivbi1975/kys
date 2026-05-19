import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMinLoadingTime } from "@/hooks/useMinLoadingTime";
import { useKesimAlaniActions } from "@/hooks/useKesimAlaniActions";
import type { KesimAlani, Project } from "@/lib/types";
import {
  fetchKesimAlanlari,
  createKesimAlani,
  fetchProject,
  updateProject,
  deleteProject,
  archiveProject,
  fetchCatismaTespiti,
  transferDonation,
  undoTransfer,
  fetchTransferLog,
  fetchConflictLog,
  fetchPendingEditRequests,
  splitKesimAlani,
  invalidateHomeDataCache,
  renameKesimAlani,
} from "@/lib/api";
import { makeUndoToastAction } from "@/hooks/makeUndoToastAction";
import type { PendingEditRequest, Conflict, ConflictEntry, DonationTransferEntry, ConflictLogEntry } from "@/lib/api";
import { getTotalShares, getRequiredAnimals } from "@/lib/grouping";

export function useProjeDetayState() {
  const { id: projectId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [rawLoading, setRawLoading] = useState(true);
  const loading = useMinLoadingTime(rawLoading);
  const [project, setProject] = useState<Project | null>(null);
  const [kesimAlanlari, setKesimAlanlari] = useState<KesimAlani[]>([]);
  const [allKesimAlanlari, setAllKesimAlanlari] = useState<KesimAlani[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKesimAdi, setNewKesimAdi] = useState("");

  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false);
  const [editProjectName, setEditProjectName] = useState("");

  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [totalConflicts, setTotalConflicts] = useState(0);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictSearchQuery, setConflictSearchQuery] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [showConflicts, setShowConflicts] = useState(false);

  const showConflictsRef = useRef(showConflicts);
  showConflictsRef.current = showConflicts;

  const onTokenGenerated = useCallback((kesimId: string, token: string) => {
    setKesimAlanlari(prev => prev.map(ka => ka.id === kesimId ? { ...ka, trackingToken: token } : ka));
  }, []);

  const loadDataFn = useCallback(async () => {
    setRawLoading(true);
    try {
      const [proj, kaRes] = await Promise.all([
        fetchProject(projectId),
        fetchKesimAlanlari(projectId),
      ]);
      setProject(proj);
      setAllKesimAlanlari(kaRes);
      setKesimAlanlari(kaRes);
      if (proj) {
        setEditProjectName(proj.name);
      }
    } catch (err) {
      toast({
        title: "Veri yüklenemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setRawLoading(false);
    }
  }, [projectId, toast]);

  const loadConflicts = useCallback(async () => {
    setConflictLoading(true);
    try {
      const result = await fetchCatismaTespiti(projectId);
      setConflicts(result.conflicts);
      setTotalConflicts(result.totalConflicts);
    } catch (err) {
      toast({
        title: "Çatışma verileri yüklenemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setConflictLoading(false);
    }
  }, [projectId, toast]);

  const onDeleted = useCallback(async () => {
    invalidateHomeDataCache();
    await loadDataFn();
    if (showConflictsRef.current) await loadConflicts();
  }, [loadDataFn, loadConflicts]);

  const findKesimAlani = useCallback((id: string) => {
    return kesimAlanlari.find(k => k.id === id);
  }, [kesimAlanlari]);

  const kesimActions = useKesimAlaniActions({
    onTokenGenerated,
    onDeleted,
    findKesimAlani,
  });

  const [transferLog, setTransferLog] = useState<DonationTransferEntry[]>([]);
  const [transferLogLoading, setTransferLogLoading] = useState(false);
  const [showTransferLog, setShowTransferLog] = useState(false);

  const [conflictLog, setConflictLog] = useState<ConflictLogEntry[]>([]);
  const [conflictLogLoading, setConflictLogLoading] = useState(false);
  const [showConflictLog, setShowConflictLog] = useState(false);

  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  const [pendingEditCount, setPendingEditCount] = useState(0);
  const [pendingEditRequests, setPendingEditRequests] = useState<PendingEditRequest[]>([]);
  const [pendingEditLoading, setPendingEditLoading] = useState(false);

  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitTarget, setSplitTarget] = useState<KesimAlani | null>(null);
  const [renameKesimDialogOpen, setRenameKesimDialogOpen] = useState(false);
  const [editingKesim, setEditingKesim] = useState<{ id: string; name: string; yetkili: string; displayName: string; maxAnimal: string } | null>(null);

  const [transferDialog, setTransferDialog] = useState<{
    entry: ConflictEntry;
    conflict: Conflict;
  } | null>(null);
  const [targetKesimAlaniId, setTargetKesimAlaniId] = useState("");
  const [transferAnimal, setTransferAnimal] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const loadPendingEditRequests = useCallback(async () => {
    if (!projectId) return;
    setPendingEditLoading(true);
    try {
      const result = await fetchPendingEditRequests(projectId);
      setPendingEditCount(result.count);
      setPendingEditRequests(result.requests);
    } catch {
    } finally {
      setPendingEditLoading(false);
    }
  }, [projectId]);

  const loadTransferLog = useCallback(async () => {
    if (!projectId) return;
    setTransferLogLoading(true);
    try {
      const log = await fetchTransferLog(projectId);
      setTransferLog(log);
    } catch {
    } finally {
      setTransferLogLoading(false);
    }
  }, [projectId]);

  const loadConflictLog = useCallback(async () => {
    if (!projectId) return;
    setConflictLogLoading(true);
    try {
      const log = await fetchConflictLog(projectId);
      setConflictLog(log);
    } catch {
    } finally {
      setConflictLogLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDataFn();
    loadPendingEditRequests();
  }, [projectId, loadDataFn, loadPendingEditRequests]);

  useEffect(() => {
    if (showConflicts) {
      loadConflicts();
    }
  }, [showConflicts, projectId, loadConflicts]);

  useEffect(() => {
    if (showTransferLog) {
      loadTransferLog();
    }
  }, [showTransferLog, projectId, loadTransferLog]);

  useEffect(() => {
    if (showConflictLog) {
      loadConflictLog();
    }
  }, [showConflictLog, projectId, loadConflictLog]);

  const handleCreateKesimAlani = useCallback(async (yetkili?: string, displayName?: string, maxVekalet?: number | null, maxAnimal?: number | null) => {
    if (!newKesimAdi.trim()) return;
    try {
      const newKA: KesimAlani = {
        id: crypto.randomUUID(),
        name: newKesimAdi.trim(),
        donations: [],
        animalGroups: [],
        createdAt: new Date().toISOString(),
        projectId: projectId,
        yetkili: yetkili?.trim() || null,
        displayName: displayName?.trim() || null,
        maxVekalet: maxVekalet ?? null,
        maxAnimal: maxAnimal ?? null,
      };
      await createKesimAlani(newKA);
      setNewKesimAdi("");
      setDialogOpen(false);
      toast({ title: "Kesim alanı oluşturuldu" });
      await loadDataFn();
    } catch (err) {
      toast({
        title: "Oluşturma hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [newKesimAdi, projectId, toast, loadDataFn]);

  const handleUpdateProject = useCallback(async () => {
    if (!editProjectName.trim() || !projectId) return;
    try {
      await updateProject(projectId, editProjectName.trim());
      setEditProjectDialogOpen(false);
      toast({ title: "Proje güncellendi" });
      await loadDataFn();
    } catch (err) {
      toast({
        title: "Güncelleme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [editProjectName, projectId, toast, loadDataFn]);

  const handleDeleteProject = useCallback(async () => {
    if (!projectId) return;
    try {
      await deleteProject(projectId);
      toast({ title: "Proje silindi" });
      setLocation("/");
    } catch (err) {
      toast({
        title: "Silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setDeleteProjectConfirm(false);
  }, [projectId, toast, setLocation]);

  const handleArchiveProject = useCallback(async () => {
    setArchiving(true);
    try {
      await archiveProject(projectId);
      toast({ title: "Proje arşivlendi" });
      setLocation("/");
    } catch (err) {
      toast({ title: "Arşivleme başarısız", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    } finally {
      setArchiving(false);
      setArchiveConfirm(false);
    }
  }, [projectId, toast, setLocation]);


  const handleRenameKesim = useCallback(async () => {
    if (!editingKesim || !editingKesim.name.trim()) return;
    const maxAnimal = editingKesim.maxAnimal.trim() ? parseInt(editingKesim.maxAnimal.trim(), 10) : null;
    try {
      await renameKesimAlani(
        editingKesim.id,
        editingKesim.name.trim(),
        editingKesim.yetkili.trim() || null,
        editingKesim.displayName.trim() || null,
        maxAnimal,
      );
      const patch = {
        name: editingKesim.name.trim(),
        yetkili: editingKesim.yetkili.trim() || null,
        displayName: editingKesim.displayName.trim() || null,
        maxAnimal,
      };
      setKesimAlanlari(prev => prev.map(k => k.id === editingKesim.id ? { ...k, ...patch } : k));
      setAllKesimAlanlari(prev => prev.map(k => k.id === editingKesim.id ? { ...k, ...patch } : k));
      setRenameKesimDialogOpen(false);
      setEditingKesim(null);
      toast({ title: "Kesim alanı güncellendi" });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }, [editingKesim, toast]);

  const openSplitModal = useCallback((ka: KesimAlani) => {
    setSplitTarget(ka);
    setSplitModalOpen(true);
  }, []);

  const handleSplit = useCallback(async (targets: { name: string; kesimListeId: string; hayvanSayisi: number }[]) => {
    if (!splitTarget) return;
    try {
      await splitKesimAlani(splitTarget.id, targets);
      toast({ title: "Liste parçalandı", description: `${splitTarget.name} başarıyla ${targets.length} alt listeye parçalandı.` });
      setSplitModalOpen(false);
      setSplitTarget(null);
      await loadDataFn();
    } catch (err) {
      toast({
        title: "Parçalama hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
      throw err;
    }
  }, [splitTarget, toast, loadDataFn]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const filteredConflicts = useMemo(() => {
    const q = conflictSearchQuery.toLowerCase();
    if (!q) return conflicts;
    return conflicts.filter(c =>
      c.displayName.toLowerCase().includes(q) ||
      c.entries.some(e =>
        e.kesimAlaniName.toLowerCase().includes(q) ||
        e.donationDescription.toLowerCase().includes(q)
      )
    );
  }, [conflicts, conflictSearchQuery]);

  const openTransferDialog = useCallback((entry: ConflictEntry, conflict: Conflict) => {
    setTransferDialog({ entry, conflict });
    setTargetKesimAlaniId("");
    setTransferAnimal(false);
  }, []);

  const executeTransfer = useCallback(async () => {
    if (!transferDialog || !targetKesimAlaniId) return;
    setTransferring(true);
    try {
      const { entry } = transferDialog;
      const fromKaId = entry.kesimAlaniId;
      const toKaId = targetKesimAlaniId;
      const result = await transferDonation({
        donationId: entry.donationId,
        sourceKesimAlaniId: fromKaId,
        targetKesimAlaniId: toKaId,
        transferAnimal: transferAnimal && !!entry.animalGroupId,
        animalGroupId: entry.animalGroupId ?? undefined,
      });
      const batchId = result?.batchId;
      const undoAction = batchId ? makeUndoToastAction(async () => {
        try {
          await undoTransfer({ batchId, projectId: projectId! });
          await loadDataFn();
          await loadConflicts();
          toast({ title: "Taşıma geri alındı" });
        } catch {
          toast({ title: "Geri alma başarısız", variant: "destructive" });
        }
      }) : undefined;
      toast({
        title: "Taşıma başarılı",
        description: `${entry.donationName} başarıyla taşındı.`,
        action: undoAction,
        duration: 10000,
      });
      setTransferDialog(null);
      await loadDataFn();
      await loadConflicts();
    } catch (err) {
      toast({
        title: "Taşıma hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setTransferring(false);
    }
  }, [transferDialog, targetKesimAlaniId, transferAnimal, toast, loadDataFn, loadConflicts, projectId]);


  const totals = useMemo(() =>
    kesimAlanlari.reduce(
      (acc, k) => {
        const shares = getTotalShares(k.donations);
        const animals = getRequiredAnimals(k.donations);
        const activeDonors = k.donations.filter(d => !d.excluded).length;
        const totalSlots = k.animalGroups.length * 7;
        const filledSlots = k.animalGroups.reduce(
          (s, g) => s + g.donations.filter(d => d.name.trim() !== "").length,
          0
        );
        const kesildi = k.animalGroups.filter(g => g.kesildi).length;
        return {
          donors: acc.donors + activeDonors,
          shares: acc.shares + shares,
          animals: acc.animals + animals,
          grouped: acc.grouped + k.animalGroups.length,
          totalSlots: acc.totalSlots + totalSlots,
          filledSlots: acc.filledSlots + filledSlots,
          kesildi: acc.kesildi + kesildi,
        };
      },
      { donors: 0, shares: 0, animals: 0, grouped: 0, totalSlots: 0, filledSlots: 0, kesildi: 0 }
    ),
    [kesimAlanlari]
  );

  const occupancy = useMemo(
    () => totals.totalSlots > 0 ? Math.round((totals.filledSlots / totals.totalSlots) * 100) : 0,
    [totals.totalSlots, totals.filledSlots]
  );

  return {
    projectId,
    setLocation,
    loading,
    project,
    kesimAlanlari,
    refreshData: loadDataFn,
    allKesimAlanlari,
    dialogOpen,
    setDialogOpen,
    newKesimAdi,
    setNewKesimAdi,
    editProjectDialogOpen,
    setEditProjectDialogOpen,
    editProjectName,
    setEditProjectName,
    deleteProjectConfirm,
    setDeleteProjectConfirm,
    archiveConfirm,
    setArchiveConfirm,
    archiving,
    deleteConfirm: kesimActions.deleteConfirm,
    setDeleteConfirm: kesimActions.setDeleteConfirm,
    conflicts,
    totalConflicts,
    conflictLoading,
    conflictSearchQuery,
    setConflictSearchQuery,
    expandedKeys,
    showConflicts,
    setShowConflicts,
    qrModalOpen: kesimActions.qrModalOpen,
    setQrModalOpen: kesimActions.setQrModalOpen,
    qrUrl: kesimActions.qrUrl,
    qrTitle: kesimActions.qrTitle,
    transferLog,
    transferLogLoading,
    showTransferLog,
    setShowTransferLog,
    conflictLog,
    conflictLogLoading,
    showConflictLog,
    setShowConflictLog,
    globalSearchOpen,
    setGlobalSearchOpen,
    pendingEditCount,
    pendingEditRequests,
    pendingEditLoading,
    transferDialog,
    setTransferDialog,
    targetKesimAlaniId,
    setTargetKesimAlaniId,
    transferAnimal,
    setTransferAnimal,
    transferring,
    totals,
    occupancy,
    filteredConflicts,
    handleCreateKesimAlani,
    handleUpdateProject,
    handleDeleteProject,
    handleArchiveProject,
    requestDelete: kesimActions.requestDelete,
    executeDelete: kesimActions.executeDelete,
    toggleExpand,
    openTransferDialog,
    executeTransfer,
    handleCopyTrackingLink: kesimActions.handleCopyTrackingLink,
    handleOpenTrackingPage: kesimActions.handleOpenTrackingPage,
    handleShowQrCode: kesimActions.handleShowQrCode,
    splitModalOpen,
    setSplitModalOpen: (open: boolean) => {
      setSplitModalOpen(open);
      if (!open) setSplitTarget(null);
    },
    splitTarget,
    openSplitModal,
    handleSplit,
    renameKesimDialogOpen,
    setRenameKesimDialogOpen,
    editingKesim,
    setEditingKesim,
    handleRenameKesim,
  };
}

export type ProjeDetayState = ReturnType<typeof useProjeDetayState>;
