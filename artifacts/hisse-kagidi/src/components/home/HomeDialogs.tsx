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
import { Plus, Trash2, Upload, FolderPlus } from "lucide-react";
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
  | "deleteProjectConfirm" | "setDeleteProjectConfirm" | "handleDeleteProject"
>;

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

      <DeleteProjectAlert
        deleteProjectConfirm={props.deleteProjectConfirm}
        setDeleteProjectConfirm={props.setDeleteProjectConfirm}
        handleDeleteProject={props.handleDeleteProject}
      />
    </>
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

function CreateKesimAlaniDialog({
  dialogOpen, setDialogOpen, newName, setNewName, createProjectId, setCreateProjectId, handleCreate, projects,
}: {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  newName: string;
  setNewName: (name: string) => void;
  createProjectId: string | null;
  setCreateProjectId: (id: string | null) => void;
  handleCreate: () => void;
  projects: Project[];
}) {
  return (
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
