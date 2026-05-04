import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Trash2, Upload, FolderPlus, Minus, ChevronDown, Loader2 } from "lucide-react";
import { createKesimAlani, invalidateHomeDataCache } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@/lib/types";
import type { HomeState } from "@/hooks/useHomeState";

type HomeDialogsProps = Pick<HomeState,
  | "importModeOpen" | "setImportModeOpen" | "pendingImportJson" | "setPendingImportJson"
  | "kesimAlanlari" | "executeImport"
  | "projectDialogOpen" | "setProjectDialogOpen" | "newProjectName" | "setNewProjectName" | "handleCreateProject"
  | "dialogOpen" | "setDialogOpen" | "newName" | "setNewName" | "createProjectId" | "setCreateProjectId" | "handleCreate" | "projects"
  | "editProjectDialogOpen" | "setEditProjectDialogOpen" | "editingProject" | "setEditingProject" | "handleUpdateProject"
  | "moveDialogOpen" | "setMoveDialogOpen" | "movingKesim" | "setMovingKesim" | "moveTargetProjectId" | "setMoveTargetProjectId" | "handleMoveKesimAlani"
  | "deleteConfirm" | "setDeleteConfirm" | "executeDelete"
  | "permanentDeleteConfirm" | "setPermanentDeleteConfirm" | "executePermanentDelete"
  | "permanentDeleteProjectConfirm" | "setPermanentDeleteProjectConfirm" | "executePermanentDeleteProject"
  | "deleteProjectConfirm" | "setDeleteProjectConfirm" | "handleDeleteProject"
  | "renameKesimDialogOpen" | "setRenameKesimDialogOpen" | "editingKesim" | "setEditingKesim" | "handleRenameKesim"
> & {
  onBulkSuccess?: () => void;
};

export function HomeDialogs(props: HomeDialogsProps) {
  return (
    <>
      <ImportModeDialog
        importModeOpen={props.importModeOpen}
        setImportModeOpen={props.setImportModeOpen}
        pendingImportJson={props.pendingImportJson}
        setPendingImportJson={props.setPendingImportJson}
        kesimAlanlariCount={props.kesimAlanlari.length}
        executeImport={props.executeImport}
      />

      <div className="flex gap-2 mb-6 flex-wrap">
        <CreateProjectDialog
          projectDialogOpen={props.projectDialogOpen}
          setProjectDialogOpen={props.setProjectDialogOpen}
          newProjectName={props.newProjectName}
          setNewProjectName={props.setNewProjectName}
          handleCreateProject={props.handleCreateProject}
        />

        <CreateKesimAlaniDialog
          dialogOpen={props.dialogOpen}
          setDialogOpen={props.setDialogOpen}
          newName={props.newName}
          setNewName={props.setNewName}
          createProjectId={props.createProjectId}
          setCreateProjectId={props.setCreateProjectId}
          handleCreate={props.handleCreate}
          projects={props.projects}
          onBulkSuccess={props.onBulkSuccess}
        />
      </div>

      <EditProjectDialog
        editProjectDialogOpen={props.editProjectDialogOpen}
        setEditProjectDialogOpen={props.setEditProjectDialogOpen}
        editingProject={props.editingProject}
        setEditingProject={props.setEditingProject}
        handleUpdateProject={props.handleUpdateProject}
      />

      <MoveKesimAlaniDialog
        moveDialogOpen={props.moveDialogOpen}
        setMoveDialogOpen={props.setMoveDialogOpen}
        movingKesim={props.movingKesim}
        setMovingKesim={props.setMovingKesim}
        moveTargetProjectId={props.moveTargetProjectId}
        setMoveTargetProjectId={props.setMoveTargetProjectId}
        handleMoveKesimAlani={props.handleMoveKesimAlani}
        projects={props.projects}
      />

      <DeleteKesimAlaniAlert
        deleteConfirm={props.deleteConfirm}
        setDeleteConfirm={props.setDeleteConfirm}
        executeDelete={props.executeDelete}
      />

      <PermanentDeleteAlert
        permanentDeleteConfirm={props.permanentDeleteConfirm}
        setPermanentDeleteConfirm={props.setPermanentDeleteConfirm}
        executePermanentDelete={props.executePermanentDelete}
      />

      <PermanentDeleteProjectAlert
        permanentDeleteProjectConfirm={props.permanentDeleteProjectConfirm}
        setPermanentDeleteProjectConfirm={props.setPermanentDeleteProjectConfirm}
        executePermanentDeleteProject={props.executePermanentDeleteProject}
      />

      <DeleteProjectAlert
        deleteProjectConfirm={props.deleteProjectConfirm}
        setDeleteProjectConfirm={props.setDeleteProjectConfirm}
        handleDeleteProject={props.handleDeleteProject}
      />

      <RenameKesimAlaniDialog
        open={props.renameKesimDialogOpen}
        setOpen={props.setRenameKesimDialogOpen}
        editingKesim={props.editingKesim}
        setEditingKesim={props.setEditingKesim}
        onConfirm={props.handleRenameKesim}
      />
    </>
  );
}

function RenameKesimAlaniDialog({
  open, setOpen, editingKesim, setEditingKesim, onConfirm,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  editingKesim: { id: string; name: string; yetkili: string; displayName: string; maxAnimal: string } | null;
  setEditingKesim: (v: { id: string; name: string; yetkili: string; displayName: string; maxAnimal: string } | null) => void;
  onConfirm: () => void;
}) {
  const set = (patch: Partial<typeof editingKesim>) =>
    editingKesim && setEditingKesim({ ...editingKesim, ...patch } as NonNullable<typeof editingKesim>);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Kesim Alanını Düzenle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Ad *</label>
            <Input
              placeholder="Kesim alanı adı"
              value={editingKesim?.name ?? ""}
              onChange={e => set({ name: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Yetkili</label>
            <Input
              placeholder="Yetkili kişi adı"
              value={editingKesim?.yetkili ?? ""}
              onChange={e => set({ yetkili: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Yazdırma Adı</label>
            <Input
              placeholder="Kağıtta görünecek ad"
              value={editingKesim?.displayName ?? ""}
              onChange={e => set({ displayName: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Maks. Hayvan</label>
            <Input
              placeholder="Sınırsız"
              type="number"
              min={1}
              value={editingKesim?.maxAnimal ?? ""}
              onChange={e => set({ maxAnimal: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={onConfirm} disabled={!editingKesim?.name.trim()}>Kaydet</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportModeDialog({
  importModeOpen, setImportModeOpen, pendingImportJson, setPendingImportJson, kesimAlanlariCount, executeImport,
}: {
  importModeOpen: boolean;
  setImportModeOpen: (open: boolean) => void;
  pendingImportJson: string | null;
  setPendingImportJson: (json: string | null) => void;
  kesimAlanlariCount: number;
  executeImport: (json: string, mode: "replace" | "merge") => Promise<void>;
}) {
  return (
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
            Mevcut {kesimAlanlariCount} kesim alanınız var. Yedek dosyasını nasıl yüklemek istersiniz?
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
  );
}

function CreateProjectDialog({
  projectDialogOpen, setProjectDialogOpen, newProjectName, setNewProjectName, handleCreateProject,
}: {
  projectDialogOpen: boolean;
  setProjectDialogOpen: (open: boolean) => void;
  newProjectName: string;
  setNewProjectName: (name: string) => void;
  handleCreateProject: () => void;
}) {
  return (
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
  );
}

type BulkItem = {
  id: string;
  name: string;
  autoName: string;
  displayName: string;
  maxAnimalStr: string;
  expanded: boolean;
};

function CreateKesimAlaniDialog({
  dialogOpen, setDialogOpen, newName, setNewName, createProjectId, setCreateProjectId, handleCreate, projects, onBulkSuccess,
}: {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  newName: string;
  setNewName: (name: string) => void;
  createProjectId: string | null;
  setCreateProjectId: (id: string | null) => void;
  handleCreate: (displayName?: string, maxVekalet?: number | null, maxAnimal?: number | null) => void;
  projects: Project[];
  onBulkSuccess?: () => void;
}) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [displayName, setDisplayName] = useState("");
  const [maxAnimalStr, setMaxAnimalStr] = useState("");
  const [baseName, setBaseName] = useState("Kesim Alanı");
  const [count, setCount] = useState(3);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (mode !== "bulk") return;
    const base = baseName.trim() || "Kesim Alanı";
    setBulkItems(prev => {
      const result: BulkItem[] = [];
      for (let i = 0; i < count; i++) {
        const autoName = `${base} ${i + 1}`;
        const existing = prev[i];
        if (existing) {
          const wasAuto = existing.name === existing.autoName;
          result.push({ ...existing, autoName, name: wasAuto ? autoName : existing.name });
        } else {
          result.push({ id: crypto.randomUUID(), name: autoName, autoName, displayName: "", maxAnimalStr: "", expanded: false });
        }
      }
      return result;
    });
  }, [baseName, count, mode]);

  const updateBulkItem = (id: string, patch: Partial<BulkItem>) =>
    setBulkItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));

  const reset = () => {
    setDisplayName("");
    setMaxAnimalStr("");
    setMode("single");
    setBaseName("Kesim Alanı");
    setCount(3);
    setBulkItems([]);
    setBulkLoading(false);
  };

  const doCreate = () => {
    const maxAnimal = maxAnimalStr.trim() ? parseInt(maxAnimalStr.trim(), 10) : null;
    handleCreate(displayName || undefined, null, maxAnimal);
    setDisplayName("");
    setMaxAnimalStr("");
  };

  const doBulkCreate = async () => {
    if (bulkItems.length === 0 || bulkLoading) return;
    setBulkLoading(true);
    let success = 0;
    let fail = 0;
    for (const item of bulkItems) {
      if (!item.name.trim()) { fail++; continue; }
      try {
        await createKesimAlani({
          id: crypto.randomUUID(),
          name: item.name.trim(),
          donations: [],
          animalGroups: [],
          createdAt: new Date().toISOString(),
          projectId: createProjectId,
          displayName: item.displayName.trim() || null,
          maxVekalet: null,
          maxAnimal: item.maxAnimalStr.trim() ? parseInt(item.maxAnimalStr.trim(), 10) : null,
        });
        success++;
      } catch {
        fail++;
      }
    }
    setBulkLoading(false);
    invalidateHomeDataCache();
    onBulkSuccess?.();
    toast({
      title: `${success} kesim alanı oluşturuldu`,
      ...(fail > 0 ? { description: `${fail} adet oluşturulamadı`, variant: "destructive" as const } : {}),
    });
    setDialogOpen(false);
    setCreateProjectId(null);
    reset();
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setCreateProjectId(null); reset(); } }}>
      <DialogTrigger asChild>
        <Button size="default">
          <Plus className="w-4 h-4 mr-2" />
          Yeni Kesim Alanı
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Kesim Alanı</DialogTitle>
        </DialogHeader>

        <div className="flex rounded-lg border p-1 bg-muted/30 gap-1">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${mode === "single" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Tekli
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${mode === "bulk" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Toplu
          </button>
        </div>

        {mode === "single" ? (
          <div className="space-y-3">
            <Input
              placeholder="Kesim alanı adı (örn: Ankara Merkez)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doCreate()}
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
            <Input
              placeholder="Çıktıda Görünecek İsim (isteğe bağlı)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doCreate()}
            />
            <Input
              type="number"
              min={1}
              placeholder="Maksimum Hayvan Sayısı (isteğe bağlı)"
              value={maxAnimalStr}
              onChange={(e) => setMaxAnimalStr(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && doCreate()}
            />
            <Button onClick={doCreate} className="w-full" disabled={!newName.trim()}>
              Oluştur
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Temel ad (örn: Kesim Alanı)"
                value={baseName}
                onChange={(e) => setBaseName(e.target.value)}
                autoFocus
              />
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => setCount(c => Math.max(1, c - 1))} disabled={count <= 1}>
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-8 text-center font-bold text-sm tabular-nums">{count}</span>
                <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => setCount(c => Math.min(50, c + 1))} disabled={count >= 50}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {projects.length > 0 && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Proje (isteğe bağlı) — tümüne uygulanır</label>
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

            <div className="max-h-64 overflow-y-auto space-y-2 pr-0.5">
              {bulkItems.map((item, idx) => (
                <div key={item.id} className="rounded-lg border bg-muted/20 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 text-right">{idx + 1}</span>
                    <Input
                      className="h-7 text-sm border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 flex-1"
                      value={item.name}
                      onChange={(e) => updateBulkItem(item.id, { name: e.target.value })}
                      placeholder="Kesim alanı adı"
                    />
                    <button
                      type="button"
                      onClick={() => updateBulkItem(item.id, { expanded: !item.expanded })}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      title="Detayları göster / gizle"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${item.expanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  {item.expanded && (
                    <div className="px-3 pb-3 space-y-2 border-t pt-2 bg-muted/10">
                      <Input
                        className="h-7 text-xs"
                        placeholder="Çıktıda görünecek isim (isteğe bağlı)"
                        value={item.displayName}
                        onChange={(e) => updateBulkItem(item.id, { displayName: e.target.value })}
                      />
                      <Input
                        className="h-7 text-xs"
                        type="number"
                        min={1}
                        placeholder="Maks. hayvan sayısı (isteğe bağlı)"
                        value={item.maxAnimalStr}
                        onChange={(e) => updateBulkItem(item.id, { maxAnimalStr: e.target.value.replace(/[^0-9]/g, "") })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={doBulkCreate}
              className="w-full"
              disabled={bulkItems.length === 0 || bulkItems.every(i => !i.name.trim()) || bulkLoading}
            >
              {bulkLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Oluşturuluyor…</>
              ) : (
                <>{count} Kesim Alanı Oluştur</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditProjectDialog({
  editProjectDialogOpen, setEditProjectDialogOpen, editingProject, setEditingProject, handleUpdateProject,
}: {
  editProjectDialogOpen: boolean;
  setEditProjectDialogOpen: (open: boolean) => void;
  editingProject: { id: string; name: string } | null;
  setEditingProject: (proj: { id: string; name: string } | null) => void;
  handleUpdateProject: () => void;
}) {
  return (
    <Dialog open={editProjectDialogOpen} onOpenChange={(open) => { setEditProjectDialogOpen(open); if (!open) setEditingProject(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Projeyi Düzenle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <Input
            value={editingProject?.name || ""}
            onChange={(e) => setEditingProject(editingProject ? { ...editingProject, name: e.target.value } : null)}
            onKeyDown={(e) => e.key === "Enter" && handleUpdateProject()}
            autoFocus
          />
          <Button onClick={handleUpdateProject} className="w-full" disabled={!editingProject?.name.trim()}>
            Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MoveKesimAlaniDialog({
  moveDialogOpen, setMoveDialogOpen, movingKesim, setMovingKesim, moveTargetProjectId, setMoveTargetProjectId, handleMoveKesimAlani, projects,
}: {
  moveDialogOpen: boolean;
  setMoveDialogOpen: (open: boolean) => void;
  movingKesim: { id: string; name: string; currentProjectId: string | null } | null;
  setMovingKesim: (kesim: { id: string; name: string; currentProjectId: string | null } | null) => void;
  moveTargetProjectId: string;
  setMoveTargetProjectId: (id: string) => void;
  handleMoveKesimAlani: () => void;
  projects: Project[];
}) {
  return (
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
  );
}

function DeleteKesimAlaniAlert({
  deleteConfirm, setDeleteConfirm, executeDelete,
}: {
  deleteConfirm: { id: string; name: string; hasDonations: boolean } | null;
  setDeleteConfirm: (confirm: { id: string; name: string; hasDonations: boolean } | null) => void;
  executeDelete: () => void;
}) {
  return (
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
  );
}

function PermanentDeleteAlert({
  permanentDeleteConfirm, setPermanentDeleteConfirm, executePermanentDelete,
}: {
  permanentDeleteConfirm: { id: string; name: string } | null;
  setPermanentDeleteConfirm: (confirm: { id: string; name: string } | null) => void;
  executePermanentDelete: () => void;
}) {
  return (
    <AlertDialog open={permanentDeleteConfirm !== null} onOpenChange={(open) => { if (!open) setPermanentDeleteConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kalıcı Olarak Sil</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>"{permanentDeleteConfirm?.name}"</strong> kalıcı olarak silinecek.
            Bu işlem geri alınamaz!
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>İptal</AlertDialogCancel>
          <AlertDialogAction onClick={executePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Kalıcı Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PermanentDeleteProjectAlert({
  permanentDeleteProjectConfirm, setPermanentDeleteProjectConfirm, executePermanentDeleteProject,
}: {
  permanentDeleteProjectConfirm: { id: string; name: string } | null;
  setPermanentDeleteProjectConfirm: (confirm: { id: string; name: string } | null) => void;
  executePermanentDeleteProject: () => void;
}) {
  return (
    <AlertDialog open={permanentDeleteProjectConfirm !== null} onOpenChange={(open) => { if (!open) setPermanentDeleteProjectConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Projeyi Kalıcı Olarak Sil</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>&quot;{permanentDeleteProjectConfirm?.name}&quot;</strong> projesi ve altındaki tüm kesim listeleri kalıcı olarak silinecek.
            Bu işlem geri alınamaz!
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>İptal</AlertDialogCancel>
          <AlertDialogAction onClick={executePermanentDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Kalıcı Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteProjectAlert({
  deleteProjectConfirm, setDeleteProjectConfirm, handleDeleteProject,
}: {
  deleteProjectConfirm: { id: string; name: string } | null;
  setDeleteProjectConfirm: (confirm: { id: string; name: string } | null) => void;
  handleDeleteProject: () => void;
}) {
  return (
    <AlertDialog open={deleteProjectConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteProjectConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Projeyi Sil</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>"{deleteProjectConfirm?.name}"</strong> projesi çöp kutusuna taşınacak.
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
  );
}
