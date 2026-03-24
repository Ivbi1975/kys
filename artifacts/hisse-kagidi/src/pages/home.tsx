import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Trash2, ChevronRight, ChevronDown, Scissors, Settings, ImagePlus, X, Sun, Moon, Monitor, Download, Upload, Tag, Pencil, PieChart, RotateCcw, Clock, Calendar, FolderOpen, FolderPlus, MoveRight, AlertTriangle } from "lucide-react";
import type { KesimAlani, CustomTag, Project } from "@/lib/types";
import {
  fetchKesimAlanlari,
  createKesimAlani,
  apiDeleteKesimAlani,
  apiPermanentDeleteKesimAlani,
  apiRestoreKesimAlani,
  fetchDeletedKesimAlanlari,
  fetchTags,
  createTag,
  updateTag,
  deleteTagApi,
  fetchLogo,
  saveLogoApi,
  deleteLogoApi,
  exportBackupApi,
  importBackupApi,
  migrateLocalStorageToApi,
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  restoreProject,
  fetchDeletedProjects,
  moveKesimAlani,
  fetchCatismaTespiti,
} from "@/lib/api";
import { useTheme } from "@/lib/useTheme";
import type { ThemeMode } from "@/lib/useTheme";
import { getTotalShares, getRequiredAnimals } from "@/lib/grouping";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const [kesimAlanlari, setKesimAlanlari] = useState<KesimAlani[]>([]);
  const [deletedKesimAlanlari, setDeletedKesimAlanlari] = useState<KesimAlani[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [trashOpen, setTrashOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createProjectId, setCreateProjectId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const { isDark, mode: themeMode, toggle: toggleTheme, setThemeMode } = useTheme();
  const [globalTags, setGlobalTags] = useState<CustomTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");
  const [loading, setLoading] = useState(true);
  const [migrationDone, setMigrationDone] = useState(false);
  const [conflictCount, setConflictCount] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; hasDonations: boolean } | null>(null);
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<{ id: string; name: string } | null>(null);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ id: string; name: string } | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingKesim, setMovingKesim] = useState<{ id: string; name: string; currentProjectId: string | null } | null>(null);
  const [moveTargetProjectId, setMoveTargetProjectId] = useState<string>("__none__");
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const TAG_COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  ];

  useEffect(() => {
    async function init() {
      try {
        const migrated = await migrateLocalStorageToApi();
        if (migrated) setMigrationDone(true);
        const [ka, tags, logo, projs] = await Promise.all([
          fetchKesimAlanlari(),
          fetchTags(),
          fetchLogo(),
          fetchProjects(),
        ]);
        setKesimAlanlari(ka);
        setGlobalTags(tags);
        setLogoPreview(logo);
        setProjects(projs);
        try {
          const catisma = await fetchCatismaTespiti();
          setConflictCount(catisma.totalConflicts);
        } catch {}
        try {
          const [deleted, deletedProjs] = await Promise.all([
            fetchDeletedKesimAlanlari(),
            fetchDeletedProjects(),
          ]);
          setDeletedKesimAlanlari(deleted);
          setDeletedProjects(deletedProjs);
        } catch (delErr) {
          console.warn("Silinen öğeler yüklenemedi:", delErr instanceof Error ? delErr.message : delErr);
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
    init();
  }, []);

  async function handleAddTag() {
    if (!newTagName.trim()) return;
    const tag: CustomTag = {
      id: crypto.randomUUID(),
      name: newTagName.trim(),
      color: newTagColor,
    };
    try {
      await createTag(tag);
      setGlobalTags([...globalTags, tag]);
      setNewTagName("");
      setNewTagColor("#3b82f6");
      toast({ title: "Etiket oluşturuldu", description: tag.name });
    } catch (err) {
      toast({
        title: "Etiket oluşturulamadı",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteTag(id: string) {
    const tag = globalTags.find(t => t.id === id);
    try {
      await deleteTagApi(id);
      setGlobalTags(globalTags.filter(t => t.id !== id));
      toast({ title: "Etiket silindi", description: tag?.name || "" });
    } catch (err) {
      toast({
        title: "Etiket silinemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  function startEditTag(tag: CustomTag) {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  }

  async function commitEditTag() {
    if (!editingTagId || !editTagName.trim()) {
      setEditingTagId(null);
      return;
    }
    const updated = { id: editingTagId, name: editTagName.trim(), color: editTagColor };
    try {
      await updateTag(updated);
      setGlobalTags(globalTags.map(t =>
        t.id === editingTagId ? updated : t
      ));
      toast({ title: "Etiket güncellendi" });
    } catch (err) {
      toast({
        title: "Etiket güncellenemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setEditingTagId(null);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const newKesim: KesimAlani & { projectId?: string | null } = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      donations: [],
      animalGroups: [],
      createdAt: new Date().toISOString(),
      projectId: createProjectId,
    };
    try {
      await createKesimAlani(newKesim);
      setNewName("");
      setDialogOpen(false);
      setCreateProjectId(null);
      toast({ title: "Kesim alanı oluşturuldu", description: newKesim.name });
      setLocation(`/kesim/${newKesim.id}`);
    } catch (err) {
      toast({
        title: "Oluşturma hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    try {
      const proj = await createProject(newProjectName.trim());
      setProjects(prev => [...prev, proj]);
      setNewProjectName("");
      setProjectDialogOpen(false);
      toast({ title: "Proje oluşturuldu", description: proj.name });
    } catch (err) {
      toast({
        title: "Proje oluşturulamadı",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  async function handleUpdateProject() {
    if (!editingProject || !editingProject.name.trim()) return;
    try {
      const updated = await updateProject(editingProject.id, editingProject.name.trim());
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditProjectDialogOpen(false);
      setEditingProject(null);
      toast({ title: "Proje güncellendi" });
    } catch (err) {
      toast({
        title: "Proje güncellenemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteProject() {
    if (!deleteProjectConfirm) return;
    try {
      await deleteProject(deleteProjectConfirm.id);
      const deletedProj = projects.find(p => p.id === deleteProjectConfirm.id);
      setProjects(prev => prev.filter(p => p.id !== deleteProjectConfirm.id));
      if (deletedProj) {
        setDeletedProjects(prev => [...prev, { ...deletedProj, deletedAt: new Date().toISOString() }]);
      }
      setKesimAlanlari(prev => prev.map(k =>
        k.projectId === deleteProjectConfirm.id ? { ...k, projectId: null } : k
      ));
      toast({ title: "Proje silindi", description: `"${deleteProjectConfirm.name}" çöp kutusuna taşındı.` });
    } catch (err) {
      toast({
        title: "Proje silinemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setDeleteProjectConfirm(null);
  }

  async function handleRestoreProject(id: string) {
    try {
      const restored = await restoreProject(id);
      setDeletedProjects(prev => prev.filter(p => p.id !== id));
      setProjects(prev => [...prev, restored]);
      toast({ title: "Proje geri yüklendi", description: restored.name });
    } catch (err) {
      toast({
        title: "Geri yükleme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  async function handleMoveKesimAlani() {
    if (!movingKesim) return;
    const targetId = moveTargetProjectId === "__none__" ? null : moveTargetProjectId;
    try {
      const updated = await moveKesimAlani(movingKesim.id, targetId);
      setKesimAlanlari(prev => prev.map(k => k.id === updated.id ? updated : k));
      const targetName = targetId ? projects.find(p => p.id === targetId)?.name : "Projesiz";
      toast({ title: "Taşındı", description: `"${movingKesim.name}" → ${targetName}` });
      setMoveDialogOpen(false);
      setMovingKesim(null);
      const projs = await fetchProjects();
      setProjects(projs);
    } catch (err) {
      toast({
        title: "Taşıma hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  function requestDelete(id: string) {
    const target = kesimAlanlari.find(k => k.id === id);
    if (!target) return;
    setDeleteConfirm({
      id,
      name: target.name,
      hasDonations: target.donations.length > 0,
    });
  }

  async function executeDelete() {
    if (!deleteConfirm) return;
    try {
      await apiDeleteKesimAlani(deleteConfirm.id);
      const deletedItem = kesimAlanlari.find(k => k.id === deleteConfirm.id);
      setKesimAlanlari(kesimAlanlari.filter(k => k.id !== deleteConfirm.id));
      if (deletedItem) {
        setDeletedKesimAlanlari(prev => [...prev, { ...deletedItem, deletedAt: new Date().toISOString() }]);
      }
      toast({
        title: "Kesim alanı silindi",
        description: `"${deleteConfirm.name}" çöp kutusuna taşındı.`,
      });
    } catch (err) {
      toast({
        title: "Silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setDeleteConfirm(null);
  }

  async function handleRestore(id: string) {
    try {
      const restored = await apiRestoreKesimAlani(id);
      setDeletedKesimAlanlari(deletedKesimAlanlari.filter(k => k.id !== id));
      setKesimAlanlari(prev => [...prev, restored]);
      toast({ title: "Geri yüklendi", description: `"${restored.name}" başarıyla geri yüklendi.` });
    } catch (err) {
      toast({
        title: "Geri yükleme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  function requestPermanentDelete(id: string) {
    const target = deletedKesimAlanlari.find(k => k.id === id);
    if (!target) return;
    setPermanentDeleteConfirm({ id, name: target.name });
  }

  async function executePermanentDelete() {
    if (!permanentDeleteConfirm) return;
    try {
      await apiPermanentDeleteKesimAlani(permanentDeleteConfirm.id);
      setDeletedKesimAlanlari(deletedKesimAlanlari.filter(k => k.id !== permanentDeleteConfirm.id));
      toast({ title: "Kalıcı olarak silindi", description: `"${permanentDeleteConfirm.name}" tamamen silindi.` });
    } catch (err) {
      toast({
        title: "Kalıcı silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setPermanentDeleteConfirm(null);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Geçersiz dosya", description: "Lütfen bir resim dosyası seçin.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Dosya çok büyük", description: "Logo dosyası 5MB'dan küçük olmalıdır.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      try {
        await saveLogoApi(base64);
        setLogoPreview(base64);
        toast({ title: "Logo yüklendi" });
      } catch (err) {
        toast({
          title: "Logo yüklenemedi",
          description: err instanceof Error ? err.message : "Bilinmeyen hata",
          variant: "destructive",
        });
      }
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function handleDeleteLogo() {
    try {
      await deleteLogoApi();
      setLogoPreview(null);
      toast({ title: "Logo kaldırıldı" });
    } catch (err) {
      toast({
        title: "Logo silinemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  async function handleExportBackup() {
    try {
      const json = await exportBackupApi();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kurban_yedek_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Yedek indirildi" });
    } catch (err) {
      toast({
        title: "Yedekleme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  const [importModeOpen, setImportModeOpen] = useState(false);
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);

  async function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const json = evt.target?.result as string;
      if (kesimAlanlari.length > 0) {
        setPendingImportJson(json);
        setImportModeOpen(true);
      } else {
        await executeImport(json, "replace");
      }
    };
    reader.readAsText(file);
    if (backupInputRef.current) backupInputRef.current.value = "";
  }

  async function executeImport(json: string, mode: "replace" | "merge") {
    const result = await importBackupApi(json, mode);
    if (result.success) {
      const ka = await fetchKesimAlanlari();
      setKesimAlanlari(ka);
      const logo = await fetchLogo();
      setLogoPreview(logo);
      const tags = await fetchTags();
      setGlobalTags(tags);
      toast({
        title: "Yedek başarıyla yüklendi",
        description: `${result.count} kesim alanı ${mode === "merge" ? "birleştirildi" : "değiştirildi"}`,
      });
    } else {
      toast({
        title: "Yedek yükleme hatası",
        description: result.error || "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setPendingImportJson(null);
    setImportModeOpen(false);
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

  function formatDateTime(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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

  function toggleProjectCollapse(projectId: string) {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function openMoveDialog(k: KesimAlani) {
    setMovingKesim({ id: k.id, name: k.name, currentProjectId: k.projectId || null });
    setMoveTargetProjectId(k.projectId || "__none__");
    setMoveDialogOpen(true);
  }

  function renderKesimCard(k: KesimAlani) {
    const shares = getTotalShares(k.donations);
    const animals = getRequiredAnimals(k.donations);
    const activeDonors = k.donations.filter(d => !d.excluded).length;
    const totalSlots = k.animalGroups.length * 7;
    const filledSlots = k.animalGroups.reduce(
      (s, g) => s + g.donations.filter(d => d.name.trim() !== "").length, 0
    );
    const occupancy = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
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
              title="Taşı"
              onClick={(e) => {
                e.stopPropagation();
                openMoveDialog(k);
              }}
            >
              <MoveRight className="w-4 h-4 text-muted-foreground" />
            </Button>
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
            <div className="text-sm font-bold text-primary">%{occupancy}</div>
            <div className="text-[10px] text-muted-foreground">Doluluk</div>
          </div>
        </div>
      </Card>
    );
  }

  const unassignedKesimAlanlari = kesimAlanlari.filter(k => !k.projectId);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        {migrationDone && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-sm text-green-800 dark:text-green-200">
            Mevcut verileriniz veritabanına başarıyla aktarıldı. Artık verileriniz kalıcı olarak saklanmaktadır.
          </div>
        )}
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <Scissors className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Kurban Hisse Kağıdı
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Kesim alanı oluşturun, bağışçıları ekleyin ve hisse kağıtlarını
              yazdırın
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleTheme} title={themeMode === "light" ? "Açık" : themeMode === "dark" ? "Koyu" : "Sistem"}>
            {themeMode === "light" ? <Sun className="w-5 h-5" /> : themeMode === "dark" ? <Moon className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </Button>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-1" />
                Ayarlar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ayarlar</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Kesim Kağıdı Logosu
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Yazdırma sayfasında tablonun üst kısmında görünecek logo.
                  </p>

                  {logoPreview ? (
                    <div className="space-y-3">
                      <div className="border rounded-lg p-4 bg-muted/30 flex items-center justify-center">
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="max-h-24 max-w-full object-contain"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => logoInputRef.current?.click()}
                        >
                          <ImagePlus className="w-4 h-4 mr-1" />
                          Değiştir
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteLogo}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Kaldır
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <ImagePlus className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium">Logo yüklemek için tıklayın</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG desteklenir (Maks. 5MB)</p>
                    </div>
                  )}

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm font-medium mb-2 block">
                    Veri Yedekleme
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Tüm kesim alanları ve logo dahil JSON olarak yedekleyin veya geri yükleyin.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={handleExportBackup}>
                      <Download className="w-4 h-4 mr-1" />
                      Yedekle
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => backupInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-1" />
                      Geri Yükle
                    </Button>
                  </div>
                  <input
                    ref={backupInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportBackup}
                  />
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm font-medium mb-2 block">
                    Tema
                  </label>
                  <div className="flex gap-2">
                    {([
                      { value: "light" as ThemeMode, label: "Açık", icon: <Sun className="w-4 h-4" /> },
                      { value: "dark" as ThemeMode, label: "Koyu", icon: <Moon className="w-4 h-4" /> },
                      { value: "system" as ThemeMode, label: "Sistem", icon: <Monitor className="w-4 h-4" /> },
                    ]).map(opt => (
                      <Button
                        key={opt.value}
                        variant={themeMode === opt.value ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setThemeMode(opt.value)}
                      >
                        {opt.icon}
                        <span className="ml-1">{opt.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm font-medium mb-2 block">
                    <Tag className="w-4 h-4 inline mr-1" />
                    Etiketler
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Bağışçılara atayabileceğiniz özel etiketler tanımlayın (VIP, Ödenmedi, Teslim Edildi vb.)
                  </p>

                  {globalTags.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {globalTags.map(tag => (
                        <div key={tag.id} className="flex items-center gap-2">
                          {editingTagId === tag.id ? (
                            <>
                              <div className="flex gap-1 flex-shrink-0">
                                {TAG_COLORS.map(c => (
                                  <button
                                    key={c}
                                    className={`w-5 h-5 rounded-full border-2 ${editTagColor === c ? "ring-2 ring-offset-1 ring-primary" : "border-transparent"}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => setEditTagColor(c)}
                                  />
                                ))}
                              </div>
                              <Input
                                className="h-7 text-sm flex-1"
                                value={editTagName}
                                onChange={(e) => setEditTagName(e.target.value)}
                                onBlur={commitEditTag}
                                onKeyDown={(e) => e.key === "Enter" && commitEditTag()}
                                autoFocus
                              />
                            </>
                          ) : (
                            <>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white flex-1"
                                style={{ backgroundColor: tag.color }}
                              >
                                {tag.name}
                              </span>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEditTag(tag)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleDeleteTag(tag.id)}>
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1 flex-shrink-0">
                      {TAG_COLORS.slice(0, 5).map(c => (
                        <button
                          key={c}
                          className={`w-5 h-5 rounded-full border-2 ${newTagColor === c ? "ring-2 ring-offset-1 ring-primary" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setNewTagColor(c)}
                        />
                      ))}
                    </div>
                    <Input
                      className="h-7 text-sm flex-1"
                      placeholder="Yeni etiket adı"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    />
                    <Button variant="outline" size="sm" onClick={handleAddTag} disabled={!newTagName.trim()}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={importModeOpen} onOpenChange={(open) => {
          setImportModeOpen(open);
          if (!open) setPendingImportJson(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yedek Yükleme Modu</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Mevcut {kesimAlanlari.length} kesim alanınız var. Yedek dosyasını nasıl yüklemek istersiniz?
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => pendingImportJson && executeImport(pendingImportJson, "merge")}
                >
                  <div>
                    <div className="font-semibold flex items-center gap-1.5">
                      <Upload className="w-4 h-4" />
                      Birleştir
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-normal">
                      Yedekteki yeni kesim alanlarını mevcut verilere ekler. Aynı ID&apos;li veriler atlanır.
                    </p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 border-destructive/50"
                  onClick={() => pendingImportJson && executeImport(pendingImportJson, "replace")}
                >
                  <div>
                    <div className="font-semibold flex items-center gap-1.5 text-destructive">
                      <Trash2 className="w-4 h-4" />
                      Değiştir (Üzerine Yaz)
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-normal">
                      Tüm mevcut verileri siler ve yedekteki verilerle değiştirir. Bu işlem geri alınamaz!
                    </p>
                  </div>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground italic">
                İpucu: Değiştirmeden önce Ayarlar &gt; Yedekle ile mevcut verilerinizi yedekleyin.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex gap-2 mb-6 flex-wrap">
          <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="default">
                <FolderPlus className="w-4 h-4 mr-2" />
                Yeni Proje
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Proje Oluştur</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Proje adı (örn: 2025 Kurban)"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                  autoFocus
                />
                <Button onClick={handleCreateProject} className="w-full" disabled={!newProjectName.trim()}>
                  Oluştur
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setCreateProjectId(null); }}>
            <DialogTrigger asChild>
              <Button size="default">
                <Plus className="w-4 h-4 mr-2" />
                Yeni Kesim Alanı
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Kesim Alanı</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Kesim alanı adı (örn: Ankara Merkez)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
                {projects.length > 0 && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Proje (isteğe bağlı)</label>
                    <Select value={createProjectId || "__none__"} onValueChange={(v) => setCreateProjectId(v === "__none__" ? null : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Projesiz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Projesiz</SelectItem>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleCreate} className="w-full" disabled={!newName.trim()}>
                  Oluştur
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="default"
            className="relative"
            onClick={() => setLocation("/catisma-tespiti")}
          >
            <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
            Çatışma Tespiti
            {conflictCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {conflictCount}
              </span>
            )}
          </Button>
        </div>

        {kesimAlanlari.length === 0 && projects.length === 0 ? (
          <Card className="p-12 text-center">
            <Scissors className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Henüz proje veya kesim alanı yok
            </h3>
            <p className="text-muted-foreground mb-4">
              Bir proje veya kesim alanı oluşturarak başlayın
            </p>
            <div className="text-sm text-muted-foreground space-y-2 max-w-md mx-auto text-left">
              <p className="font-medium text-foreground">Nasıl çalışır?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Bir proje oluşturun (örn: "2025 Kurban")</li>
                <li>Projenin içine kesim alanları ekleyin</li>
                <li>Bağışçıları tek tek veya Excel'den toplu ekleyin</li>
                <li>Otomatik gruplama ile hayvan gruplarını oluşturun</li>
                <li>Kesim kağıtlarını yazdırın veya Excel'e aktarın</li>
              </ol>
            </div>
          </Card>
        ) : (
          <>
            {kesimAlanlari.length >= 1 && (() => {
              const totals = kesimAlanlari.reduce((acc, k) => {
                const shares = getTotalShares(k.donations);
                const animals = getRequiredAnimals(k.donations);
                const activeDonors = k.donations.filter(d => !d.excluded).length;
                const totalSlots = k.animalGroups.length * 7;
                const filledSlots = k.animalGroups.reduce(
                  (s, g) => s + g.donations.filter(d => d.name.trim() !== "").length, 0
                );
                return {
                  donors: acc.donors + activeDonors,
                  shares: acc.shares + shares,
                  animals: acc.animals + animals,
                  grouped: acc.grouped + k.animalGroups.length,
                  totalSlots: acc.totalSlots + totalSlots,
                  filledSlots: acc.filledSlots + filledSlots,
                };
              }, { donors: 0, shares: 0, animals: 0, grouped: 0, totalSlots: 0, filledSlots: 0 });
              const occupancy = totals.totalSlots > 0 ? Math.round((totals.filledSlots / totals.totalSlots) * 100) : 0;
              return (
                <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
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
              );
            })()}

            {projects.map(project => {
              const projectKesimAlanlari = kesimAlanlari.filter(k => k.projectId === project.id);
              const isCollapsed = collapsedProjects.has(project.id);
              const projTotals = projectKesimAlanlari.reduce((acc, k) => {
                const shares = getTotalShares(k.donations);
                const activeDonors = k.donations.filter(d => !d.excluded).length;
                return {
                  donors: acc.donors + activeDonors,
                  shares: acc.shares + shares,
                  areas: acc.areas + 1,
                  groups: acc.groups + k.animalGroups.length,
                };
              }, { donors: 0, shares: 0, areas: 0, groups: 0 });

              return (
                <div key={project.id} className="mb-6">
                  <Card className="p-3 bg-muted/30 border-primary/10">
                    <div
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => setLocation(`/proje/${project.id}`)}
                    >
                      <FolderOpen className="w-5 h-5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-foreground text-lg">{project.name}</h2>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{projTotals.areas} kesim alanı</span>
                          <span>{projTotals.donors} bağışçı</span>
                          <span>{projTotals.shares} hisse</span>
                          <span>{projTotals.groups} grup</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </Card>
                </div>
              );
            })}

            {unassignedKesimAlanlari.length > 0 && (
              <div className="mb-6">
                {projects.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <Scissors className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Projesiz Kesim Alanları</h3>
                  </div>
                )}
                <div className="space-y-3">
                  {unassignedKesimAlanlari.map(k => renderKesimCard(k))}
                </div>
              </div>
            )}
          </>
        )}

        {(deletedKesimAlanlari.length > 0 || deletedProjects.length > 0) && (
          <div className="mt-6">
            <button
              type="button"
              className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3 hover:text-foreground transition-colors"
              onClick={() => setTrashOpen(!trashOpen)}
            >
              {trashOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Trash2 className="w-4 h-4" />
              Çöp Kutusu ({deletedKesimAlanlari.length + deletedProjects.length})
            </button>
            {trashOpen && (
              <div className="space-y-2">
                {deletedProjects.map(p => (
                  <Card key={`proj-${p.id}`} className="p-3">
                    <div className="flex items-center gap-3">
                      <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name} <span className="text-xs text-muted-foreground">(Proje)</span></p>
                        <p className="text-[10px] text-muted-foreground">
                          Silinme: {p.deletedAt ? formatDateTime(p.deletedAt) : "—"}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleRestoreProject(p.id)}>
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Geri Al
                      </Button>
                    </div>
                  </Card>
                ))}
                {deletedKesimAlanlari.map(k => (
                  <Card key={k.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{k.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Silinme: {k.deletedAt ? formatDateTime(k.deletedAt) : "—"}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleRestore(k.id)}>
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Geri Al
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => requestPermanentDelete(k.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={editProjectDialogOpen} onOpenChange={(open) => { setEditProjectDialogOpen(open); if (!open) setEditingProject(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Projeyi Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              value={editingProject?.name || ""}
              onChange={(e) => setEditingProject(prev => prev ? { ...prev, name: e.target.value } : null)}
              onKeyDown={(e) => e.key === "Enter" && handleUpdateProject()}
              autoFocus
            />
            <Button onClick={handleUpdateProject} className="w-full" disabled={!editingProject?.name.trim()}>
              Kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={moveDialogOpen} onOpenChange={(open) => { setMoveDialogOpen(open); if (!open) setMovingKesim(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kesim Alanını Taşı</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              <strong>"{movingKesim?.name}"</strong> kesim alanını hangi projeye taşımak istiyorsunuz?
            </p>
            <Select value={moveTargetProjectId} onValueChange={setMoveTargetProjectId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Projesiz</SelectItem>
                {projects
                  .filter(p => p.id !== movingKesim?.currentProjectId)
                  .map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleMoveKesimAlani}
              className="w-full"
              disabled={moveTargetProjectId === (movingKesim?.currentProjectId || "__none__")}
            >
              Taşı
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kesim Alanını Sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.hasDonations ? (
                <>
                  <strong>"{deleteConfirm.name}"</strong> kesim alanında bağışçılar bulunuyor.
                  Bu alan çöp kutusuna taşınacak ve daha sonra ana sayfadaki çöp kutusundan geri yükleyebilirsiniz.
                  <br /><br />
                  Silmeden önce Ayarlar &gt; Yedekle ile yedek almanız önerilir.
                </>
              ) : (
                <>
                  <strong>"{deleteConfirm?.name}"</strong> kesim alanı çöp kutusuna taşınacak.
                  Daha sonra ana sayfadaki çöp kutusundan geri yükleyebilirsiniz.
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

      <AlertDialog open={permanentDeleteConfirm !== null} onOpenChange={(open) => { if (!open) setPermanentDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kalıcı Olarak Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{permanentDeleteConfirm?.name}"</strong> kesim alanı kalıcı olarak silinecek.
              Bu işlem geri alınamaz!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={executePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Kalıcı Olarak Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteProjectConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteProjectConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projeyi Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{deleteProjectConfirm?.name}"</strong> projesi silinecek.
              Projedeki kesim alanları silinmez, "Projesiz" olarak kalır.
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
