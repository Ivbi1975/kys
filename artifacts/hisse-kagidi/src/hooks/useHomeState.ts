import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import type { KesimAlani, CustomTag, TagCategory, Project } from "@/lib/types";
import {
  fetchHomeData,
  invalidateHomeDataCache,
  fetchKesimAlanlari,
  fetchKesimAlani,
  createKesimAlani,
  apiPermanentDeleteKesimAlani,
  apiRestoreKesimAlani,
  fetchDeletedKesimAlanlari,
  createTag,
  updateTag,
  deleteTagApi,
  fetchTagCategories,
  createTagCategory,
  updateTagCategory,
  deleteTagCategoryApi,
  saveLogoApi,
  deleteLogoApi,
  exportBackupApi,
  importBackupApi,
  migrateLocalStorageToApi,
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  permanentDeleteProject,
  restoreProject,
  unarchiveProject,
  moveKesimAlani,
  renameKesimAlani,
  downloadCsvExport,
  runIntegrityCheck,
  repairIntegrity,
  type IntegrityReport,
} from "@/lib/api";
import { useTheme } from "@/lib/useTheme";
import { useToast } from "@/hooks/use-toast";
import { useMinLoadingTime } from "@/hooks/useMinLoadingTime";
import { useKesimAlaniActions } from "@/hooks/useKesimAlaniActions";
import { turkishTitleCase, sortTagsTr } from "@/lib/formatting";

export function useHomeState() {
  const [, setLocation] = useLocation();
  const [kesimAlanlari, setKesimAlanlari] = useState<KesimAlani[]>([]);
  const [deletedKesimAlanlari, setDeletedKesimAlanlari] = useState<KesimAlani[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
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
  const [tagCategories, setTagCategories] = useState<TagCategory[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");
  const [editTagVekaletId, setEditTagVekaletId] = useState("");
  const [editTagNotes, setEditTagNotes] = useState("");
  const [editTagAiNotes, setEditTagAiNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const showSkeleton = useMinLoadingTime(loading);
  const [migrationDone, setMigrationDone] = useState(false);
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<{ id: string; name: string } | null>(null);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ id: string; name: string } | null>(null);
  const [permanentDeleteProjectConfirm, setPermanentDeleteProjectConfirm] = useState<{ id: string; name: string } | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingKesim, setMovingKesim] = useState<{ id: string; name: string; currentProjectId: string | null } | null>(null);
  const [moveTargetProjectId, setMoveTargetProjectId] = useState<string>("__none__");
  const [renameKesimDialogOpen, setRenameKesimDialogOpen] = useState(false);
  const [editingKesim, setEditingKesim] = useState<{ id: string; name: string; yetkili: string; displayName: string; maxAnimal: string } | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const { toast } = useToast();

  const onTokenGenerated = useCallback((kesimId: string, token: string) => {
    setKesimAlanlari(prev => prev.map(ka => ka.id === kesimId ? { ...ka, trackingToken: token } : ka));
  }, []);

  const onDeleted = useCallback((id: string) => {
    invalidateHomeDataCache();
    setKesimAlanlari(prev => {
      const deletedItem = prev.find(k => k.id === id);
      if (deletedItem) {
        setDeletedKesimAlanlari(old => [...old, { ...deletedItem, deletedAt: new Date().toISOString() }]);
      }
      return prev.filter(k => k.id !== id);
    });
  }, []);

  const findKesimAlani = useCallback((id: string) => {
    return kesimAlanlari.find(k => k.id === id);
  }, [kesimAlanlari]);

  const kesimActions = useKesimAlaniActions({
    onTokenGenerated,
    onDeleted,
    findKesimAlani,
  });

  const [csvExporting, setCsvExporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState({ received: 0, total: 0 });
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [integrityChecking, setIntegrityChecking] = useState(false);
  const [integrityRepairing, setIntegrityRepairing] = useState(false);

  const [importModeOpen, setImportModeOpen] = useState(false);
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [homeData, categories] = await Promise.all([
        fetchHomeData(),
        fetchTagCategories().catch(() => [] as TagCategory[]),
      ]);
      setKesimAlanlari(homeData.kesimAlanlari);
      setGlobalTags(sortTagsTr(homeData.tags));
      setTagCategories(categories);
      setLogoPreview(homeData.logo);
      setProjects(homeData.projects);
      setDeletedKesimAlanlari(homeData.deletedKesimAlanlari);
      setDeletedProjects(homeData.deletedProjects);
      setArchivedProjects(homeData.archivedProjects);
    } catch (err) {
      toast({
        title: "Veri yüklenemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    async function init() {
      const MIGRATION_FLAG = "hisse-kagidi-migrated-to-db";
      if (!localStorage.getItem(MIGRATION_FLAG)) {
        try {
          const migrated = await migrateLocalStorageToApi();
          if (migrated) setMigrationDone(true);
        } catch {}
      }
      await refreshData();
      setLoading(false);
    }
    init();
  }, []);

  const handleAddTag = useCallback(async (extra?: { vekaletId?: string; notes?: string; aiNotes?: string }) => {
    if (!newTagName.trim()) return;
    const tag: CustomTag = {
      id: crypto.randomUUID(),
      name: turkishTitleCase(newTagName.trim()),
      color: newTagColor,
      vekaletId: extra?.vekaletId?.trim() || null,
      notes: extra?.notes?.trim() || null,
      aiNotes: extra?.aiNotes?.trim() || null,
    };
    try {
      await createTag(tag);
      invalidateHomeDataCache();
      setGlobalTags(prev => [...prev, tag]);
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
  }, [newTagName, newTagColor, toast]);

  const handleDeleteTag = useCallback(async (id: string) => {
    const tag = globalTags.find(t => t.id === id);
    try {
      await deleteTagApi(id);
      invalidateHomeDataCache();
      setGlobalTags(prev => prev.filter(t => t.id !== id));
      toast({ title: "Etiket silindi", description: tag?.name || "" });
    } catch (err) {
      toast({
        title: "Etiket silinemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [globalTags, toast]);

  const cancelEditTag = useCallback(() => {
    setEditingTagId(null);
    setEditTagName("");
    setEditTagColor("");
    setEditTagVekaletId("");
    setEditTagNotes("");
    setEditTagAiNotes("");
  }, []);

  const startEditTag = useCallback((tag: CustomTag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setEditTagVekaletId(tag.vekaletId || "");
    setEditTagNotes(tag.notes || "");
    setEditTagAiNotes(tag.aiNotes || "");
  }, []);

  const commitEditTag = useCallback(async () => {
    if (!editingTagId || !editTagName.trim()) {
      setEditingTagId(null);
      return;
    }
    const updated: CustomTag = {
      id: editingTagId,
      name: turkishTitleCase(editTagName.trim()),
      color: editTagColor,
      vekaletId: editTagVekaletId.trim() || null,
      notes: editTagNotes.trim() || null,
      aiNotes: editTagAiNotes.trim() || null,
      categoryId: globalTags.find(t => t.id === editingTagId)?.categoryId ?? null,
    };
    try {
      await updateTag(updated);
      invalidateHomeDataCache();
      setGlobalTags(prev => prev.map(t =>
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
  }, [editingTagId, editTagName, editTagColor, editTagVekaletId, editTagNotes, editTagAiNotes, globalTags, toast]);

  const handleAssignTagCategory = useCallback(async (tagId: string, categoryId: string | null) => {
    const tag = globalTags.find(t => t.id === tagId);
    if (!tag) return;
    const updated: CustomTag = { ...tag, categoryId };
    try {
      await updateTag(updated);
      invalidateHomeDataCache();
      setGlobalTags(prev => prev.map(t => t.id === tagId ? updated : t));
    } catch (err) {
      toast({
        title: "Etiket kategorisi güncellenemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [globalTags, toast]);

  const handleAddCategory = useCallback(async (name: string) => {
    if (!name.trim()) return;
    const category: TagCategory = {
      id: crypto.randomUUID(),
      name: name.trim(),
      sortOrder: tagCategories.length,
    };
    try {
      await createTagCategory(category);
      setTagCategories(prev => [...prev, category]);
      toast({ title: "Kategori oluşturuldu", description: category.name });
      return category;
    } catch (err) {
      toast({
        title: "Kategori oluşturulamadı",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
      return null;
    }
  }, [tagCategories, toast]);

  const handleRenameCategory = useCallback(async (id: string, name: string) => {
    if (!name.trim()) return;
    const category = tagCategories.find(c => c.id === id);
    if (!category) return;
    const updated: TagCategory = { ...category, name: name.trim() };
    try {
      await updateTagCategory(updated);
      setTagCategories(prev => prev.map(c => c.id === id ? updated : c));
      toast({ title: "Kategori yeniden adlandırıldı" });
    } catch (err) {
      toast({
        title: "Kategori adlandırılamadı",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [tagCategories, toast]);

  const handleDeleteCategory = useCallback(async (id: string) => {
    const category = tagCategories.find(c => c.id === id);
    try {
      await deleteTagCategoryApi(id);
      setTagCategories(prev => prev.filter(c => c.id !== id));
      setGlobalTags(prev => prev.map(t => t.categoryId === id ? { ...t, categoryId: null } : t));
      toast({ title: "Kategori silindi", description: category?.name || "" });
    } catch (err) {
      toast({
        title: "Kategori silinemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [tagCategories, toast]);

  const handleCreate = useCallback(async (displayName?: string, maxVekalet?: number | null, maxAnimal?: number | null) => {
    if (!newName.trim()) return;
    const newKesim: KesimAlani & { projectId?: string | null } = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      donations: [],
      animalGroups: [],
      createdAt: new Date().toISOString(),
      projectId: createProjectId,
      displayName: displayName?.trim() || null,
      maxVekalet: maxVekalet ?? null,
      maxAnimal: maxAnimal ?? null,
    };
    try {
      await createKesimAlani(newKesim);
      invalidateHomeDataCache();
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
  }, [newName, createProjectId, toast, setLocation]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    try {
      const proj = await createProject(newProjectName.trim());
      invalidateHomeDataCache();
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
  }, [newProjectName, toast]);

  const handleUpdateProject = useCallback(async () => {
    if (!editingProject || !editingProject.name.trim()) return;
    try {
      const updated = await updateProject(editingProject.id, editingProject.name.trim());
      invalidateHomeDataCache();
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
  }, [editingProject, toast]);

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
      invalidateHomeDataCache();
      setKesimAlanlari(prev => prev.map(k => k.id === editingKesim.id ? {
        ...k,
        name: editingKesim.name.trim(),
        yetkili: editingKesim.yetkili.trim() || null,
        displayName: editingKesim.displayName.trim() || null,
        maxAnimal,
      } : k));
      setRenameKesimDialogOpen(false);
      setEditingKesim(null);
      toast({ title: "Kesim alanı güncellendi" });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }, [editingKesim, toast]);

  const handleDeleteProject = useCallback(async () => {
    if (!deleteProjectConfirm) return;
    try {
      await deleteProject(deleteProjectConfirm.id);
      invalidateHomeDataCache();
      const deletedProj = projects.find(p => p.id === deleteProjectConfirm.id);
      setProjects(prev => prev.filter(p => p.id !== deleteProjectConfirm.id));
      if (deletedProj) {
        setDeletedProjects(prev => [...prev, { ...deletedProj, deletedAt: new Date().toISOString() }]);
      }
      toast({ title: "Proje silindi", description: `"${deleteProjectConfirm.name}" çöp kutusuna taşındı.` });
    } catch (err) {
      toast({
        title: "Proje silinemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setDeleteProjectConfirm(null);
  }, [deleteProjectConfirm, projects, toast]);

  const handleRestoreProject = useCallback(async (id: string) => {
    try {
      const restored = await restoreProject(id);
      invalidateHomeDataCache();
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
  }, [toast]);

  const handleUnarchiveProject = useCallback(async (id: string) => {
    try {
      const restored = await unarchiveProject(id);
      invalidateHomeDataCache();
      setArchivedProjects(prev => prev.filter(p => p.id !== id));
      setProjects(prev => [...prev, restored]);
      const freshKesimAlanlari = await fetchKesimAlanlari();
      setKesimAlanlari(freshKesimAlanlari);
      toast({ title: "Proje arşivden çıkarıldı", description: restored.name });
    } catch (err) {
      toast({
        title: "Arşivden çıkarma hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleMoveKesimAlani = useCallback(async () => {
    if (!movingKesim) return;
    const targetId = moveTargetProjectId === "__none__" ? null : moveTargetProjectId;
    try {
      const updated = await moveKesimAlani(movingKesim.id, targetId);
      invalidateHomeDataCache();
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
  }, [movingKesim, moveTargetProjectId, projects, toast]);


  const handleRestore = useCallback(async (id: string) => {
    try {
      const restored = await apiRestoreKesimAlani(id);
      invalidateHomeDataCache();
      setDeletedKesimAlanlari(prev => prev.filter(k => k.id !== id));
      setKesimAlanlari(prev => [...prev, restored]);
      toast({ title: "Geri yüklendi", description: `"${restored.name}" başarıyla geri yüklendi.` });
    } catch (err) {
      toast({
        title: "Geri yükleme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [toast]);

  const deletedKesimAlanlariRef = useRef(deletedKesimAlanlari);
  deletedKesimAlanlariRef.current = deletedKesimAlanlari;

  const requestPermanentDelete = useCallback((id: string) => {
    const target = deletedKesimAlanlariRef.current.find(k => k.id === id);
    if (!target) return;
    setPermanentDeleteConfirm({ id, name: target.name });
  }, []);

  const executePermanentDelete = useCallback(async () => {
    if (!permanentDeleteConfirm) return;
    try {
      await apiPermanentDeleteKesimAlani(permanentDeleteConfirm.id);
      invalidateHomeDataCache();
      setDeletedKesimAlanlari(prev => prev.filter(k => k.id !== permanentDeleteConfirm.id));
      toast({ title: "Kalıcı olarak silindi", description: `"${permanentDeleteConfirm.name}" tamamen silindi.` });
    } catch (err) {
      toast({
        title: "Kalıcı silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setPermanentDeleteConfirm(null);
  }, [permanentDeleteConfirm, toast]);

  const deletedProjectsRef = useRef(deletedProjects);
  deletedProjectsRef.current = deletedProjects;

  const requestPermanentDeleteProject = useCallback((id: string) => {
    const target = deletedProjectsRef.current.find(p => p.id === id);
    if (!target) return;
    setPermanentDeleteProjectConfirm({ id, name: target.name });
  }, []);

  const executePermanentDeleteProject = useCallback(async () => {
    if (!permanentDeleteProjectConfirm) return;
    try {
      await permanentDeleteProject(permanentDeleteProjectConfirm.id);
      invalidateHomeDataCache();
      setDeletedProjects(prev => prev.filter(p => p.id !== permanentDeleteProjectConfirm.id));
      setDeletedKesimAlanlari(prev => prev.filter(k => k.projectId !== permanentDeleteProjectConfirm.id));
      setKesimAlanlari(prev => prev.filter(k => k.projectId !== permanentDeleteProjectConfirm.id));
      toast({ title: "Kalıcı olarak silindi", description: `"${permanentDeleteProjectConfirm.name}" projesi ve tüm kesim listeleri tamamen silindi.` });
    } catch (err) {
      toast({
        title: "Kalıcı silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setPermanentDeleteProjectConfirm(null);
  }, [permanentDeleteProjectConfirm, toast]);

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        invalidateHomeDataCache();
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
  }, [toast]);

  const handleDeleteLogo = useCallback(async () => {
    try {
      await deleteLogoApi();
      invalidateHomeDataCache();
      setLogoPreview(null);
      toast({ title: "Logo kaldırıldı" });
    } catch (err) {
      toast({
        title: "Logo silinemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleExportBackup = useCallback(async () => {
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
  }, [toast]);

  const handleExportCsv = useCallback(async () => {
    setCsvExporting(true);
    setCsvProgress({ received: 0, total: 0 });
    try {
      const blob = await downloadCsvExport(undefined, (received, total) => {
        setCsvProgress({ received, total });
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bagisci_listesi_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV indirildi" });
    } catch (err) {
      toast({
        title: "CSV export hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setCsvExporting(false);
    }
  }, [toast]);

  const executeImport = useCallback(async (json: string, mode: "replace" | "merge") => {
    const result = await importBackupApi(json, mode);
    if (result.success) {
      invalidateHomeDataCache();
      const homeData = await fetchHomeData();
      setKesimAlanlari(homeData.kesimAlanlari);
      setLogoPreview(homeData.logo);
      setGlobalTags(sortTagsTr(homeData.tags));
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
  }, [toast]);

  const kesimAlanlariRef = useRef(kesimAlanlari);
  kesimAlanlariRef.current = kesimAlanlari;

  const handleImportBackup = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const json = evt.target?.result as string;
      if (kesimAlanlariRef.current.length > 0) {
        setPendingImportJson(json);
        setImportModeOpen(true);
      } else {
        await executeImport(json, "replace");
      }
    };
    reader.readAsText(file);
    if (backupInputRef.current) backupInputRef.current.value = "";
  }, [executeImport]);

  const toggleProjectCollapse = useCallback((projectId: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  const openMoveDialog = useCallback((k: KesimAlani) => {
    setMovingKesim({ id: k.id, name: k.name, currentProjectId: k.projectId || null });
    setMoveTargetProjectId(k.projectId || "__none__");
    setMoveDialogOpen(true);
  }, []);


  const [deletedKADetails, setDeletedKADetails] = useState<Record<string, KesimAlani>>({});
  const [deletedKALoadingIds, setDeletedKALoadingIds] = useState<Set<string>>(new Set());

  const handleFetchDeletedKADetail = useCallback(async (id: string) => {
    if (deletedKADetails[id] || deletedKALoadingIds.has(id)) return;
    setDeletedKALoadingIds(prev => new Set(prev).add(id));
    try {
      const data = await fetchKesimAlani(id);
      if (data) {
        setDeletedKADetails(prev => ({ ...prev, [id]: data }));
      } else {
        toast({
          title: "Detay yüklenemedi",
          description: "Veri alınamadı.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Detay yüklenemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setDeletedKALoadingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [deletedKADetails, deletedKALoadingIds, toast]);

  const handleIntegrityCheck = useCallback(async () => {
    setIntegrityChecking(true);
    try {
      const report = await runIntegrityCheck();
      setIntegrityReport(report);
      if (report.totalIssues === 0) {
        toast({ title: "Veri tutarlı", description: "Herhangi bir sorun bulunamadı." });
      }
    } catch (err) {
      toast({ title: "Kontrol hatası", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    } finally {
      setIntegrityChecking(false);
    }
  }, [toast]);

  const handleIntegrityRepair = useCallback(async () => {
    setIntegrityRepairing(true);
    try {
      const result = await repairIntegrity();
      toast({
        title: "Onarım tamamlandı",
        description: `${result.repairs.length} onarım yapıldı, ${result.remainingIssues} sorun kaldı.`,
      });
      setIntegrityReport({
        checkedAt: result.repairedAt,
        totalIssues: result.remainingIssues,
        issues: result.remainingDetails,
      });
    } catch (err) {
      toast({ title: "Onarım hatası", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    } finally {
      setIntegrityRepairing(false);
    }
  }, [toast]);

  const deletedProjectIds = useMemo(
    () => new Set(deletedProjects.map(p => p.id)),
    [deletedProjects]
  );

  const unassignedKesimAlanlari = useMemo(
    () => kesimAlanlari.filter(k => !k.projectId || deletedProjectIds.has(k.projectId)),
    [kesimAlanlari, deletedProjectIds]
  );

  return {
    setLocation,
    kesimAlanlari,
    deletedKesimAlanlari,
    projects,
    deletedProjects,
    archivedProjects,
    archiveOpen,
    setArchiveOpen,
    trashOpen,
    setTrashOpen,
    newName,
    setNewName,
    dialogOpen,
    setDialogOpen,
    createProjectId,
    setCreateProjectId,
    settingsOpen,
    setSettingsOpen,
    logoPreview,
    logoInputRef,
    backupInputRef,
    isDark,
    themeMode,
    toggleTheme,
    setThemeMode,
    globalTags,
    newTagName,
    setNewTagName,
    newTagColor,
    setNewTagColor,
    editingTagId,
    editTagName,
    setEditTagName,
    editTagColor,
    setEditTagColor,
    editTagVekaletId,
    setEditTagVekaletId,
    editTagNotes,
    setEditTagNotes,
    editTagAiNotes,
    setEditTagAiNotes,
    showSkeleton,
    migrationDone,
    deleteConfirm: kesimActions.deleteConfirm,
    setDeleteConfirm: kesimActions.setDeleteConfirm,
    permanentDeleteConfirm,
    setPermanentDeleteConfirm,
    projectDialogOpen,
    setProjectDialogOpen,
    newProjectName,
    setNewProjectName,
    editProjectDialogOpen,
    setEditProjectDialogOpen,
    editingProject,
    setEditingProject,
    deleteProjectConfirm,
    setDeleteProjectConfirm,
    permanentDeleteProjectConfirm,
    setPermanentDeleteProjectConfirm,
    moveDialogOpen,
    setMoveDialogOpen,
    movingKesim,
    setMovingKesim,
    moveTargetProjectId,
    setMoveTargetProjectId,
    collapsedProjects,
    qrModalOpen: kesimActions.qrModalOpen,
    setQrModalOpen: kesimActions.setQrModalOpen,
    qrUrl: kesimActions.qrUrl,
    qrTitle: kesimActions.qrTitle,
    globalSearchOpen,
    setGlobalSearchOpen,
    unassignedKesimAlanlari,
    csvExporting,
    csvProgress,
    integrityReport,
    integrityChecking,
    integrityRepairing,
    importModeOpen,
    setImportModeOpen,
    pendingImportJson,
    setPendingImportJson,
    tagCategories,
    handleAddTag,
    handleDeleteTag,
    cancelEditTag,
    startEditTag,
    commitEditTag,
    handleAssignTagCategory,
    handleAddCategory,
    handleRenameCategory,
    handleDeleteCategory,
    handleCreate,
    handleCreateProject,
    handleUpdateProject,
    handleDeleteProject,
    handleRestoreProject,
    handleUnarchiveProject,
    handleMoveKesimAlani,
    requestDelete: kesimActions.requestDelete,
    executeDelete: kesimActions.executeDelete,
    handleRestore,
    requestPermanentDelete,
    executePermanentDelete,
    requestPermanentDeleteProject,
    executePermanentDeleteProject,
    handleLogoUpload,
    handleDeleteLogo,
    handleExportBackup,
    handleExportCsv,
    handleImportBackup,
    executeImport,
    toggleProjectCollapse,
    renameKesimDialogOpen,
    setRenameKesimDialogOpen,
    editingKesim,
    setEditingKesim,
    handleRenameKesim,
    openMoveDialog,
    handleShowQrCode: kesimActions.handleShowQrCode,
    handleCopyTrackingLink: kesimActions.handleCopyTrackingLink,
    handleOpenTrackingPage: kesimActions.handleOpenTrackingPage,
    handleIntegrityCheck,
    handleIntegrityRepair,
    deletedKADetails,
    deletedKALoadingIds,
    handleFetchDeletedKADetail,
    refreshData,
  };
}

export type HomeState = ReturnType<typeof useHomeState>;
