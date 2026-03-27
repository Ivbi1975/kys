import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { KesimAlani, Project } from "@/lib/types";
import {
  fetchKesimAlanlari,
  createKesimAlani,
  apiDeleteKesimAlani,
  fetchProjects,
  updateProject,
  deleteProject,
  archiveProject,
  fetchCatismaTespiti,
  transferDonation,
  fetchTransferLog,
  fetchPendingEditRequests,
} from "@/lib/api";
import type { PendingEditRequest, Conflict, ConflictEntry, DonationTransferEntry } from "@/lib/api";
import { getTotalShares, getRequiredAnimals } from "@/lib/grouping";
import { useTrackingActions } from "@/hooks/useTrackingActions";

export function useProjeDetayState() {
  const { id: projectId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
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

  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
    hasDonations: boolean;
  } | null>(null);

  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [totalConflicts, setTotalConflicts] = useState(0);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictSearchQuery, setConflictSearchQuery] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [showConflicts, setShowConflicts] = useState(false);

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [qrTitle, setQrTitle] = useState("");
  const { handleCopyTrackingLink, handleOpenTrackingPage, resolveToken, buildTrackingUrl } = useTrackingActions({
    onTokenGenerated: (kesimId, token) => {
      setKesimAlanlari(prev => prev.map(ka => ka.id === kesimId ? { ...ka, trackingToken: token } : ka));
    },
  });

  const [transferLog, setTransferLog] = useState<DonationTransferEntry[]>([]);
  const [transferLogLoading, setTransferLogLoading] = useState(false);
  const [showTransferLog, setShowTransferLog] = useState(false);

  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  const [pendingEditCount, setPendingEditCount] = useState(0);
  const [pendingEditRequests, setPendingEditRequests] = useState<PendingEditRequest[]>([]);
  const [pendingEditLoading, setPendingEditLoading] = useState(false);

  const [transferDialog, setTransferDialog] = useState<{
    entry: ConflictEntry;
    conflict: Conflict;
  } | null>(null);
  const [targetKesimAlaniId, setTargetKesimAlaniId] = useState("");
  const [transferAnimal, setTransferAnimal] = useState(false);
  const [transferring, setTransferring] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [projectsRes, kaRes] = await Promise.all([
        fetchProjects(),
        fetchKesimAlanlari(),
      ]);
      const proj = projectsRes.find(p => p.id === projectId) || null;
      setProject(proj);
      setAllKesimAlanlari(kaRes);
      setKesimAlanlari(kaRes.filter(k => k.projectId === projectId));
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
      setLoading(false);
    }
  }

  async function loadConflicts() {
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
  }

  async function loadPendingEditRequests() {
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
  }

  async function loadTransferLog() {
    if (!projectId) return;
    setTransferLogLoading(true);
    try {
      const log = await fetchTransferLog(projectId);
      setTransferLog(log);
    } catch {
    } finally {
      setTransferLogLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    loadPendingEditRequests();
  }, [projectId]);

  useEffect(() => {
    if (showConflicts) {
      loadConflicts();
    }
  }, [showConflicts, projectId]);

  useEffect(() => {
    if (showTransferLog) {
      loadTransferLog();
    }
  }, [showTransferLog, projectId]);

  async function handleCreateKesimAlani() {
    if (!newKesimAdi.trim()) return;
    try {
      const newKA: KesimAlani = {
        id: crypto.randomUUID(),
        name: newKesimAdi.trim(),
        donations: [],
        animalGroups: [],
        createdAt: new Date().toISOString(),
        projectId: projectId,
      };
      await createKesimAlani(newKA);
      setNewKesimAdi("");
      setDialogOpen(false);
      toast({ title: "Kesim alanı oluşturuldu" });
      await loadData();
    } catch (err) {
      toast({
        title: "Oluşturma hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  async function handleUpdateProject() {
    if (!editProjectName.trim() || !projectId) return;
    try {
      await updateProject(projectId, editProjectName.trim());
      setEditProjectDialogOpen(false);
      toast({ title: "Proje güncellendi" });
      await loadData();
    } catch (err) {
      toast({
        title: "Güncelleme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteProject() {
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
  }

  async function handleArchiveProject() {
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
  }

  function requestDelete(id: string) {
    const k = kesimAlanlari.find(ka => ka.id === id);
    if (!k) return;
    setDeleteConfirm({
      id: k.id,
      name: k.name,
      hasDonations: k.donations.length > 0,
    });
  }

  async function executeDelete() {
    if (!deleteConfirm) return;
    try {
      await apiDeleteKesimAlani(deleteConfirm.id);
      toast({ title: "Kesim alanı silindi" });
      await loadData();
      if (showConflicts) await loadConflicts();
    } catch (err) {
      toast({
        title: "Silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setDeleteConfirm(null);
  }

  function toggleExpand(key: string) {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filteredConflicts = conflicts.filter(c => {
    const q = conflictSearchQuery.toLowerCase();
    if (!q) return true;
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.entries.some(e =>
        e.kesimAlaniName.toLowerCase().includes(q) ||
        e.donationDescription.toLowerCase().includes(q)
      )
    );
  });

  function openTransferDialog(entry: ConflictEntry, conflict: Conflict) {
    setTransferDialog({ entry, conflict });
    setTargetKesimAlaniId("");
    setTransferAnimal(false);
  }

  async function executeTransfer() {
    if (!transferDialog || !targetKesimAlaniId) return;
    setTransferring(true);
    try {
      const { entry } = transferDialog;
      await transferDonation({
        donationId: entry.donationId,
        sourceKesimAlaniId: entry.kesimAlaniId,
        targetKesimAlaniId,
        transferAnimal: transferAnimal && !!entry.animalGroupId,
        animalGroupId: entry.animalGroupId ?? undefined,
      });
      toast({ title: "Taşıma başarılı", description: `${entry.donationName} başarıyla taşındı.` });
      setTransferDialog(null);
      await loadData();
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
  }

  async function handleShowQrCode(e: React.MouseEvent, k: KesimAlani) {
    e.stopPropagation();
    try {
      const token = await resolveToken(k);
      const url = buildTrackingUrl(token);
      setQrUrl(url);
      setQrTitle(k.name);
      setQrModalOpen(true);
    } catch {
      toast({ title: "Hata", description: "QR kod oluşturulamadı.", variant: "destructive" });
    }
  }

  const totals = kesimAlanlari.reduce(
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
  );
  const occupancy = totals.totalSlots > 0 ? Math.round((totals.filledSlots / totals.totalSlots) * 100) : 0;

  return {
    projectId,
    setLocation,
    loading,
    project,
    kesimAlanlari,
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
    deleteConfirm,
    setDeleteConfirm,
    conflicts,
    totalConflicts,
    conflictLoading,
    conflictSearchQuery,
    setConflictSearchQuery,
    expandedKeys,
    showConflicts,
    setShowConflicts,
    qrModalOpen,
    setQrModalOpen,
    qrUrl,
    qrTitle,
    transferLog,
    transferLogLoading,
    showTransferLog,
    setShowTransferLog,
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
    requestDelete,
    executeDelete,
    toggleExpand,
    openTransferDialog,
    executeTransfer,
    handleCopyTrackingLink,
    handleOpenTrackingPage,
    handleShowQrCode,
  };
}

export type ProjeDetayState = ReturnType<typeof useProjeDetayState>;
