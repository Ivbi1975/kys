import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronRight,
  Scissors,
  Pencil,
  PieChart,
  Calendar,
  FolderOpen,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Search,
  Users,
  ChevronDown,
  ChevronUp,
  MoveRight,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { KesimAlani, Project } from "@/lib/types";
import {
  fetchKesimAlanlari,
  createKesimAlani,
  apiDeleteKesimAlani,
  fetchProjects,
  updateProject,
  deleteProject,
  fetchCatismaTespiti,
  transferDonation,
} from "@/lib/api";
import type { Conflict, ConflictEntry } from "@/lib/api";
import { getTotalShares, getRequiredAnimals } from "@/lib/grouping";

export default function ProjeDetayPage() {
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

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    if (showConflicts) {
      loadConflicts();
    }
  }, [showConflicts, projectId]);

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

  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  function timeSince(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Bugün";
      if (diffDays === 1) return "Dün";
      if (diffDays < 7) return `${diffDays} gün önce`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} ay önce`;
      return `${Math.floor(diffDays / 365)} yıl önce`;
    } catch {
      return "";
    }
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
      return {
        donors: acc.donors + activeDonors,
        shares: acc.shares + shares,
        animals: acc.animals + animals,
        grouped: acc.grouped + k.animalGroups.length,
        totalSlots: acc.totalSlots + totalSlots,
        filledSlots: acc.filledSlots + filledSlots,
      };
    },
    { donors: 0, shares: 0, animals: 0, grouped: 0, totalSlots: 0, filledSlots: 0 }
  );
  const occupancy = totals.totalSlots > 0 ? Math.round((totals.filledSlots / totals.totalSlots) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Proje Bulunamadı</h2>
          <p className="text-muted-foreground mb-4">Bu proje mevcut değil veya silinmiş olabilir.</p>
          <Button onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Ana Sayfaya Dön
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-primary" />
              {project.name}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {kesimAlanlari.length} kesim alanı
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              title="Yeni Kesim Alanı Ekle"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Yeni Kesim Alanı
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Düzenle"
              onClick={() => {
                setEditProjectName(project.name);
                setEditProjectDialogOpen(true);
              }}
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Sil"
              onClick={() => setDeleteProjectConfirm(true)}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>

        <Card className="p-4 mb-6 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Genel Özet</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-primary">{totals.donors}</div>
              <div className="text-xs text-muted-foreground">Aktif Bağışçı</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-primary">{totals.shares}</div>
              <div className="text-xs text-muted-foreground">Toplam Hisse</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-primary">{totals.animals}</div>
              <div className="text-xs text-muted-foreground">Gereken Hayvan</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-primary">{totals.grouped}</div>
              <div className="text-xs text-muted-foreground">Gruplandırılmış</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-primary">%{occupancy}</div>
              <div className="text-xs text-muted-foreground">Doluluk Oranı</div>
            </div>
          </div>
        </Card>

        {kesimAlanlari.length === 0 ? (
          <Card className="p-12 text-center">
            <Scissors className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Henüz kesim alanı yok</h2>
            <p className="text-muted-foreground mb-4">Bu projeye yeni bir kesim alanı ekleyin.</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Yeni Kesim Alanı
            </Button>
          </Card>
        ) : (
          <div className="space-y-3 mb-6">
            {kesimAlanlari.map(k => {
              const shares = getTotalShares(k.donations);
              const animals = getRequiredAnimals(k.donations);
              const activeDonors = k.donations.filter(d => !d.excluded).length;
              const totalSlots = k.animalGroups.length * 7;
              const filledSlots = k.animalGroups.reduce(
                (s, g) => s + g.donations.filter(d => d.name.trim() !== "").length,
                0
              );
              const occ = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
              return (
                <Card
                  key={k.id}
                  className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/kesim/${k.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">{k.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(k.createdAt)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          ({timeSince(k.createdAt)})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDelete(k.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                    <div>
                      <div className="text-sm font-bold text-primary">{activeDonors}</div>
                      <div className="text-[10px] text-muted-foreground">Bağışçı</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-primary">{shares}</div>
                      <div className="text-[10px] text-muted-foreground">Hisse</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-primary">{animals}</div>
                      <div className="text-[10px] text-muted-foreground">Hayvan</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-primary">{k.animalGroups.length}</div>
                      <div className="text-[10px] text-muted-foreground">Grup</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-primary">%{occ}</div>
                      <div className="text-[10px] text-muted-foreground">Doluluk</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-6">
          <Button
            variant={showConflicts ? "default" : "outline"}
            onClick={() => setShowConflicts(!showConflicts)}
            className="mb-4"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Çatışma Tespiti
            {showConflicts && totalConflicts > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
                {totalConflicts}
              </span>
            )}
          </Button>

          {showConflicts && (
            <div className="space-y-4">
              {conflictLoading ? (
                <div className="text-center py-8">
                  <Scissors className="w-8 h-8 text-primary mx-auto mb-3 animate-pulse" />
                  <p className="text-muted-foreground text-sm">Çatışmalar taranıyor...</p>
                </div>
              ) : totalConflicts === 0 ? (
                <Card className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-foreground mb-1">Çatışma Bulunamadı</h3>
                  <p className="text-muted-foreground text-sm">
                    Farklı kesim alanlarında tekrarlanan kayıt tespit edilmedi.
                  </p>
                </Card>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Bağışçı adı veya kesim alanı ara..."
                        value={conflictSearchQuery}
                        onChange={e => setConflictSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{filteredConflicts.length} çatışma</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadConflicts}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {filteredConflicts.map(conflict => {
                      const isExpanded = expandedKeys.has(conflict.key);
                      const entriesByKA: Record<string, typeof conflict.entries> = {};
                      for (const entry of conflict.entries) {
                        if (!entriesByKA[entry.kesimAlaniId]) entriesByKA[entry.kesimAlaniId] = [];
                        entriesByKA[entry.kesimAlaniId].push(entry);
                      }
                      const kaColumns = Object.entries(entriesByKA);
                      return (
                        <Card key={conflict.key} className="overflow-hidden border-l-4 border-l-red-500">
                          <div
                            className="p-4 cursor-pointer flex items-center gap-3"
                            onClick={() => toggleExpand(conflict.key)}
                          >
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-500" />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-foreground flex items-center gap-2">
                                {conflict.displayName}
                                {conflict.matchField === "description" && (
                                  <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                    Açıklama eşleşmesi
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                <span className="text-red-600 dark:text-red-400 font-medium">
                                  {conflict.kesimAlanCount} farklı kesim alanında
                                </span>
                                · {conflict.totalEntries} kayıt
                                {conflict.hasNoteWarnings && (
                                  <span className="text-orange-600 dark:text-orange-400 font-medium flex items-center gap-0.5">
                                    <AlertTriangle className="w-3 h-3" />
                                    Not uyarısı
                                  </span>
                                )}
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>

                          {isExpanded && (
                            <div className="border-t bg-muted/20 p-4">
                              <div className={`grid gap-4 ${kaColumns.length === 2 ? "grid-cols-2" : kaColumns.length >= 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1"}`}>
                                {kaColumns.map(([kaId, entries]) => (
                                  <div key={kaId} className="bg-background rounded-lg border p-3 space-y-2">
                                    <div className="text-xs font-semibold px-2 py-1 rounded bg-primary/10 text-primary text-center">
                                      {entries[0].kesimAlaniName}
                                    </div>
                                    {entries.map((entry, idx) => (
                                      <div
                                        key={`${entry.donationId}-${entry.animalGroupId ?? "nogroup"}-${idx}`}
                                        className="p-2 rounded border bg-muted/30 space-y-1"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-sm font-medium text-foreground truncate">{entry.donationName}</span>
                                          {entry.animalGroupId && entry.animalGroupNo != null && (
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                                              Hayvan #{entry.animalGroupNo}
                                            </span>
                                          )}
                                        </div>
                                        {entry.donationDescription && (
                                          <p className="text-xs text-muted-foreground">
                                            Vekaleti veren: {entry.donationDescription}
                                          </p>
                                        )}
                                        {entry.donationNotes && (
                                          <p className={`text-xs italic ${entry.hasNoteWarning ? "text-orange-600 dark:text-orange-400 font-medium" : "text-muted-foreground"}`}>
                                            {entry.hasNoteWarning && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                                            Not: {entry.donationNotes}
                                          </p>
                                        )}
                                        <div className="pt-1">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-7 text-xs"
                                            onClick={() => openTransferDialog(entry, conflict)}
                                          >
                                            <MoveRight className="w-3 h-3 mr-1" />
                                            Taşı
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Kesim Alanı</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Kesim alanı adı"
              value={newKesimAdi}
              onChange={(e) => setNewKesimAdi(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateKesimAlani()}
              autoFocus
            />
            <Button onClick={handleCreateKesimAlani} className="w-full" disabled={!newKesimAdi.trim()}>
              Oluştur
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editProjectDialogOpen} onOpenChange={(open) => { setEditProjectDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Projeyi Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUpdateProject()}
              autoFocus
            />
            <Button onClick={handleUpdateProject} className="w-full" disabled={!editProjectName.trim()}>
              Kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={transferDialog !== null} onOpenChange={open => { if (!open) setTransferDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bağışçı Taşı</DialogTitle>
          </DialogHeader>
          {transferDialog && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-semibold">{transferDialog.entry.donationName}</p>
                {transferDialog.entry.donationDescription && (
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {transferDialog.entry.donationDescription}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">
                    {transferDialog.entry.kesimAlaniName}
                  </span>
                  {transferDialog.entry.animalGroupId && transferDialog.entry.animalGroupNo != null && (
                    <span className="text-muted-foreground">Hayvan #{transferDialog.entry.animalGroupNo}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Hedef Kesim Alanı</label>
                <Select value={targetKesimAlaniId} onValueChange={setTargetKesimAlaniId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kesim alanı seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allKesimAlanlari
                      .filter(k => k.id !== transferDialog.entry.kesimAlaniId)
                      .map(k => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {transferDialog.entry.animalGroupId && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Taşıma Kapsamı</label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="transferScope"
                        checked={!transferAnimal}
                        onChange={() => setTransferAnimal(false)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">Sadece bu bağışçıyı taşı</p>
                        <p className="text-xs text-muted-foreground">
                          Bağışçı hayvan grubundan çıkarılır ve hedef kesim alanına eklenir.
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="transferScope"
                        checked={transferAnimal}
                        onChange={() => setTransferAnimal(true)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">Tüm hayvanı taşı</p>
                        <p className="text-xs text-muted-foreground">
                          Hayvan #{transferDialog.entry.animalGroupNo} ve içindeki{" "}
                          {(transferDialog.entry.siblingsInGroup.length + 1)} kişi birlikte taşınır.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {targetKesimAlaniId && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-blue-700 dark:text-blue-300 mb-1">
                    <MoveRight className="w-4 h-4" />
                    Taşıma Özeti
                  </div>
                  {transferAnimal && transferDialog.entry.animalGroupId ? (
                    <p className="text-muted-foreground text-xs">
                      Hayvan #{transferDialog.entry.animalGroupNo} ({transferDialog.entry.siblingsInGroup.length + 1} kişi){" "}
                      <strong>{transferDialog.entry.kesimAlaniName}</strong>&apos;dan{" "}
                      <strong>{allKesimAlanlari.find(k => k.id === targetKesimAlaniId)?.name}</strong>&apos;a taşınacak.
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      <strong>{transferDialog.entry.donationName}</strong>{" "}
                      <strong>{transferDialog.entry.kesimAlaniName}</strong>&apos;dan{" "}
                      <strong>{allKesimAlanlari.find(k => k.id === targetKesimAlaniId)?.name}</strong>&apos;a taşınacak.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setTransferDialog(null)}
                  disabled={transferring}
                >
                  İptal
                </Button>
                <Button
                  className="flex-1"
                  disabled={!targetKesimAlaniId || transferring}
                  onClick={executeTransfer}
                >
                  {transferring ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Taşınıyor...
                    </>
                  ) : (
                    <>
                      <MoveRight className="w-4 h-4 mr-1" />
                      Taşı
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kesim Alanını Sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.hasDonations ? (
                <>
                  <strong>&quot;{deleteConfirm.name}&quot;</strong> kesim alanında bağışçılar bulunuyor.
                  Bu alan çöp kutusuna taşınacak.
                </>
              ) : (
                <>
                  <strong>&quot;{deleteConfirm?.name}&quot;</strong> kesim alanı çöp kutusuna taşınacak.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteProjectConfirm} onOpenChange={(open) => { if (!open) setDeleteProjectConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projeyi Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>&quot;{project.name}&quot;</strong> projesi silinecek.
              Projedeki kesim alanları silinmez, &quot;Projesiz&quot; olarak kalır.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
