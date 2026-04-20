import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Trash2,
  FolderOpen,
  RotateCcw,
  Eye,
  Loader2,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";
import type { KesimAlani, Project } from "@/lib/types";
import { formatDateTime } from "@/lib/formatting";
import {
  fetchDeletedKesimAlanlari,
  fetchDeletedProjects,
  fetchKesimAlani,
  apiRestoreKesimAlani,
  apiPermanentDeleteKesimAlani,
  restoreProject,
  permanentDeleteProject,
  invalidateHomeDataCache,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function CopKutusuPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [deletedKesimAlanlari, setDeletedKesimAlanlari] = useState<KesimAlani[]>([]);
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletedKADetails, setDeletedKADetails] = useState<Record<string, KesimAlani>>({});
  const [deletedKALoadingIds, setDeletedKALoadingIds] = useState<Set<string>>(new Set());

  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState<{ id: string; name: string; type: "ka" | "proj" } | null>(null);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const deletedKARef = useRef(deletedKesimAlanlari);
  deletedKARef.current = deletedKesimAlanlari;
  const deletedProjRef = useRef(deletedProjects);
  deletedProjRef.current = deletedProjects;

  const loadData = useCallback(async () => {
    setLoading(true);
    setSelectedKeys(new Set());
    try {
      const [kas, projs] = await Promise.all([
        fetchDeletedKesimAlanlari(),
        fetchDeletedProjects(),
      ]);
      setDeletedKesimAlanlari(kas);
      setDeletedProjects(projs);
    } catch (err) {
      toast({
        title: "Çöp kutusu yüklenemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const allKeys = [
    ...deletedProjects.map(p => `proj-${p.id}`),
    ...deletedKesimAlanlari.map(k => `ka-${k.id}`),
  ];
  const totalCount = allKeys.length;
  const allSelected = totalCount > 0 && selectedKeys.size === totalCount;
  const someSelected = selectedKeys.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(allKeys));
    }
  }, [allSelected, allKeys]);

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleFetchDetail = useCallback(async (id: string) => {
    if (deletedKADetails[id] || deletedKALoadingIds.has(id)) return;
    setDeletedKALoadingIds(prev => new Set(prev).add(id));
    try {
      const data = await fetchKesimAlani(id);
      if (data) {
        setDeletedKADetails(prev => ({ ...prev, [id]: data }));
      }
    } catch {
    } finally {
      setDeletedKALoadingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [deletedKADetails, deletedKALoadingIds]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => {
      if (prev === id) return null;
      handleFetchDetail(id);
      return id;
    });
  }, [handleFetchDetail]);

  const handleRestoreKA = useCallback(async (id: string) => {
    try {
      const restored = await apiRestoreKesimAlani(id);
      invalidateHomeDataCache();
      setDeletedKesimAlanlari(prev => prev.filter(k => k.id !== id));
      setSelectedKeys(prev => { const n = new Set(prev); n.delete(`ka-${id}`); return n; });
      toast({ title: "Geri yüklendi", description: `"${restored.name}" başarıyla geri yüklendi.` });
    } catch (err) {
      toast({
        title: "Geri yükleme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleRestoreProject = useCallback(async (id: string) => {
    try {
      const restored = await restoreProject(id);
      invalidateHomeDataCache();
      setDeletedProjects(prev => prev.filter(p => p.id !== id));
      setSelectedKeys(prev => { const n = new Set(prev); n.delete(`proj-${id}`); return n; });
      toast({ title: "Proje geri yüklendi", description: restored.name });
    } catch (err) {
      toast({
        title: "Geri yükleme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [toast]);

  const requestPermanentDelete = useCallback((id: string) => {
    const target = deletedKARef.current.find(k => k.id === id);
    if (!target) return;
    setPermanentDeleteConfirm({ id, name: target.name, type: "ka" });
  }, []);

  const requestPermanentDeleteProject = useCallback((id: string) => {
    const target = deletedProjRef.current.find(p => p.id === id);
    if (!target) return;
    setPermanentDeleteConfirm({ id, name: target.name, type: "proj" });
  }, []);

  const executePermanentDelete = useCallback(async () => {
    if (!permanentDeleteConfirm) return;
    try {
      if (permanentDeleteConfirm.type === "ka") {
        await apiPermanentDeleteKesimAlani(permanentDeleteConfirm.id);
        setDeletedKesimAlanlari(prev => prev.filter(k => k.id !== permanentDeleteConfirm.id));
        setSelectedKeys(prev => { const n = new Set(prev); n.delete(`ka-${permanentDeleteConfirm.id}`); return n; });
        toast({ title: "Kalıcı olarak silindi", description: `"${permanentDeleteConfirm.name}" tamamen silindi.` });
      } else {
        await permanentDeleteProject(permanentDeleteConfirm.id);
        setDeletedProjects(prev => prev.filter(p => p.id !== permanentDeleteConfirm.id));
        setDeletedKesimAlanlari(prev => prev.filter(k => k.projectId !== permanentDeleteConfirm.id));
        setSelectedKeys(prev => { const n = new Set(prev); n.delete(`proj-${permanentDeleteConfirm.id}`); return n; });
        toast({ title: "Kalıcı olarak silindi", description: `"${permanentDeleteConfirm.name}" projesi tamamen silindi.` });
      }
      invalidateHomeDataCache();
    } catch (err) {
      toast({
        title: "Kalıcı silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setPermanentDeleteConfirm(null);
  }, [permanentDeleteConfirm, toast]);

  const executeBulkPermanentDelete = useCallback(async () => {
    setBulkDeleting(true);
    const kaIds = [...selectedKeys].filter(k => k.startsWith("ka-")).map(k => k.slice(3));
    const projIds = [...selectedKeys].filter(k => k.startsWith("proj-")).map(k => k.slice(5));
    try {
      await Promise.all([
        ...kaIds.map(id => apiPermanentDeleteKesimAlani(id)),
        ...projIds.map(id => permanentDeleteProject(id)),
      ]);
      setDeletedKesimAlanlari(prev => {
        const toRemove = new Set(kaIds);
        const removedProjIds = new Set(projIds);
        return prev.filter(k => !toRemove.has(k.id) && !removedProjIds.has(k.projectId ?? ""));
      });
      setDeletedProjects(prev => {
        const toRemove = new Set(projIds);
        return prev.filter(p => !toRemove.has(p.id));
      });
      setSelectedKeys(new Set());
      invalidateHomeDataCache();
      toast({
        title: "Kalıcı olarak silindi",
        description: `${kaIds.length + projIds.length} öğe kalıcı olarak silindi.`,
      });
    } catch (err) {
      toast({
        title: "Kalıcı silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
      setBulkDeleteConfirm(false);
    }
  }, [selectedKeys, toast]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate("/")}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Trash2 className="w-6 h-6 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Çöp Kutusu</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Silinen kesim alanları ve projeler
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Yükleniyor...</span>
          </div>
        ) : totalCount === 0 ? (
          <Card className="p-12 text-center">
            <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Çöp kutusu boş</h3>
            <p className="text-muted-foreground">Silinen öğeler burada görünür.</p>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
                Tümünü seç
                {selectedKeys.size > 0 && (
                  <span className="text-foreground font-medium">({selectedKeys.size} seçili)</span>
                )}
              </label>
              {selectedKeys.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setBulkDeleteConfirm(true)}
                  disabled={bulkDeleting}
                >
                  {bulkDeleting ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3 mr-1" />
                  )}
                  Kalıcı Sil ({selectedKeys.size})
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {deletedProjects.map(p => {
                const key = `proj-${p.id}`;
                return (
                  <Card
                    key={key}
                    className={`p-3 cursor-pointer transition-colors ${selectedKeys.has(key) ? "bg-muted/60" : ""}`}
                    onClick={() => toggleKey(key)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedKeys.has(key)}
                        onCheckedChange={() => toggleKey(key)}
                        onClick={e => e.stopPropagation()}
                        className="flex-shrink-0"
                      />
                      <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.name}{" "}
                          <span className="text-xs text-muted-foreground">(Proje)</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Silinme: {p.deletedAt ? formatDateTime(p.deletedAt) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleRestoreProject(p.id)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Geri Al
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive"
                          onClick={() => requestPermanentDeleteProject(p.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {deletedKesimAlanlari.map(k => {
                const key = `ka-${k.id}`;
                const isExpanded = expandedId === k.id;
                const isLoading = deletedKALoadingIds.has(k.id);
                const detail = deletedKADetails[k.id];

                return (
                  <Card
                    key={key}
                    className={`p-3 cursor-pointer transition-colors ${selectedKeys.has(key) ? "bg-muted/60" : ""}`}
                    onClick={() => toggleKey(key)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedKeys.has(key)}
                        onCheckedChange={() => toggleKey(key)}
                        onClick={e => e.stopPropagation()}
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{k.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {k.projectName && <span>Proje: {k.projectName} · </span>}
                          Silinme: {k.deletedAt ? formatDateTime(k.deletedAt) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => handleToggleExpand(k.id)}
                          title="İçeriği önizle"
                        >
                          {isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleRestoreKA(k.id)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Geri Al
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive"
                          onClick={() => requestPermanentDelete(k.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-border" onClick={e => e.stopPropagation()}>
                        {isLoading && !detail ? (
                          <p className="text-[11px] text-muted-foreground">Yükleniyor...</p>
                        ) : detail ? (
                          <div className="space-y-1">
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">{detail.donations.length}</span> bağışçı
                              {detail.animalGroups.length > 0 && (
                                <span>
                                  {" · "}
                                  <span className="font-medium text-foreground">{detail.animalGroups.length}</span> hayvan grubu
                                </span>
                              )}
                              {detail.teams && detail.teams.length > 0 && (
                                <span>
                                  {" · "}
                                  <span className="font-medium text-foreground">{detail.teams.length}</span> ekip
                                </span>
                              )}
                            </p>
                            {detail.donations.length > 0 && (
                              <div className="max-h-28 overflow-y-auto space-y-0.5">
                                {detail.donations.slice(0, 10).map(d => (
                                  <p key={d.id} className="text-[11px] text-muted-foreground truncate">
                                    {d.name || <span className="italic">İsimsiz</span>}
                                    {d.shareCount > 1 && (
                                      <span className="text-[10px] ml-1">×{d.shareCount}</span>
                                    )}
                                  </p>
                                ))}
                                {detail.donations.length > 10 && (
                                  <p className="text-[10px] text-muted-foreground italic">
                                    +{detail.donations.length - 10} daha...
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">Detay yüklenemedi.</p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AlertDialog
        open={!!permanentDeleteConfirm}
        onOpenChange={open => { if (!open) setPermanentDeleteConfirm(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kalıcı Olarak Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{permanentDeleteConfirm?.name}"</strong>{" "}
              {permanentDeleteConfirm?.type === "proj"
                ? "projesi ve içindeki tüm kesim listeleri"
                : "kesim alanı"}{" "}
              kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executePermanentDelete}
            >
              Kalıcı Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteConfirm}
        onOpenChange={open => { if (!open && !bulkDeleting) setBulkDeleteConfirm(false); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Toplu Kalıcı Silme</AlertDialogTitle>
            <AlertDialogDescription>
              Seçilen <strong>{selectedKeys.size}</strong> öğe kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executeBulkPermanentDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Kalıcı Sil ({selectedKeys.size})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
