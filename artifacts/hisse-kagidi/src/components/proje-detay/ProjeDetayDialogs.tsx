import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { MoveRight, Loader2, Archive } from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import type { ConflictEntry } from "@/lib/api";
import type { ProjeDetayState } from "@/hooks/useProjeDetayState";

type ProjeDetayDialogsProps = Pick<ProjeDetayState,
  | "dialogOpen" | "setDialogOpen" | "newKesimAdi" | "setNewKesimAdi" | "handleCreateKesimAlani"
  | "editProjectDialogOpen" | "setEditProjectDialogOpen" | "editProjectName" | "setEditProjectName" | "handleUpdateProject"
  | "deleteConfirm" | "setDeleteConfirm" | "executeDelete"
  | "deleteProjectConfirm" | "setDeleteProjectConfirm" | "handleDeleteProject"
  | "archiveConfirm" | "setArchiveConfirm" | "archiving" | "handleArchiveProject"
  | "transferDialog" | "setTransferDialog" | "targetKesimAlaniId" | "setTargetKesimAlaniId"
  | "transferAnimal" | "setTransferAnimal" | "transferring" | "executeTransfer"
  | "allKesimAlanlari"
> & {
  projectName: string;
};

export function ProjeDetayDialogs(props: ProjeDetayDialogsProps) {
  return (
    <>
      <CreateKesimAlaniDialog
        dialogOpen={props.dialogOpen}
        setDialogOpen={props.setDialogOpen}
        newKesimAdi={props.newKesimAdi}
        setNewKesimAdi={props.setNewKesimAdi}
        handleCreateKesimAlani={props.handleCreateKesimAlani}
      />

      <EditProjectDialog
        editProjectDialogOpen={props.editProjectDialogOpen}
        setEditProjectDialogOpen={props.setEditProjectDialogOpen}
        editProjectName={props.editProjectName}
        setEditProjectName={props.setEditProjectName}
        handleUpdateProject={props.handleUpdateProject}
      />

      <TransferDialog
        transferDialog={props.transferDialog}
        setTransferDialog={props.setTransferDialog}
        targetKesimAlaniId={props.targetKesimAlaniId}
        setTargetKesimAlaniId={props.setTargetKesimAlaniId}
        transferAnimal={props.transferAnimal}
        setTransferAnimal={props.setTransferAnimal}
        transferring={props.transferring}
        executeTransfer={props.executeTransfer}
        allKesimAlanlari={props.allKesimAlanlari}
      />

      <DeleteKesimAlaniAlert
        deleteConfirm={props.deleteConfirm}
        setDeleteConfirm={props.setDeleteConfirm}
        executeDelete={props.executeDelete}
      />

      <DeleteProjectAlert
        deleteProjectConfirm={props.deleteProjectConfirm}
        setDeleteProjectConfirm={props.setDeleteProjectConfirm}
        handleDeleteProject={props.handleDeleteProject}
        projectName={props.projectName}
      />

      <ArchiveProjectAlert
        archiveConfirm={props.archiveConfirm}
        setArchiveConfirm={props.setArchiveConfirm}
        archiving={props.archiving}
        handleArchiveProject={props.handleArchiveProject}
        projectName={props.projectName}
      />
    </>
  );
}

function CreateKesimAlaniDialog({
  dialogOpen, setDialogOpen, newKesimAdi, setNewKesimAdi, handleCreateKesimAlani,
}: {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  newKesimAdi: string;
  setNewKesimAdi: (name: string) => void;
  handleCreateKesimAlani: () => void;
}) {
  return (
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
  );
}

function EditProjectDialog({
  editProjectDialogOpen, setEditProjectDialogOpen, editProjectName, setEditProjectName, handleUpdateProject,
}: {
  editProjectDialogOpen: boolean;
  setEditProjectDialogOpen: (open: boolean) => void;
  editProjectName: string;
  setEditProjectName: (name: string) => void;
  handleUpdateProject: () => void;
}) {
  return (
    <Dialog open={editProjectDialogOpen} onOpenChange={setEditProjectDialogOpen}>
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
  );
}

function TransferDialog({
  transferDialog, setTransferDialog, targetKesimAlaniId, setTargetKesimAlaniId,
  transferAnimal, setTransferAnimal, transferring, executeTransfer, allKesimAlanlari,
}: {
  transferDialog: { entry: ConflictEntry; conflict: { displayName: string } } | null;
  setTransferDialog: (dialog: null) => void;
  targetKesimAlaniId: string;
  setTargetKesimAlaniId: (id: string) => void;
  transferAnimal: boolean;
  setTransferAnimal: (transfer: boolean) => void;
  transferring: boolean;
  executeTransfer: () => void;
  allKesimAlanlari: KesimAlani[];
}) {
  return (
    <Dialog open={transferDialog !== null} onOpenChange={(open) => { if (!open) setTransferDialog(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bağışçı Taşıma</DialogTitle>
        </DialogHeader>
        {transferDialog && (
          <div className="space-y-4 pt-2">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-300">{transferDialog.entry.donationName}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{transferDialog.entry.kesimAlaniName} — {transferDialog.entry.donationDescription}</p>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5">Hedef Kesim Alanı</label>
              <Select value={targetKesimAlaniId} onValueChange={setTargetKesimAlaniId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seçin..." />
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
  );
}

function DeleteProjectAlert({
  deleteProjectConfirm, setDeleteProjectConfirm, handleDeleteProject, projectName,
}: {
  deleteProjectConfirm: boolean;
  setDeleteProjectConfirm: (confirm: boolean) => void;
  handleDeleteProject: () => void;
  projectName: string;
}) {
  return (
    <AlertDialog open={deleteProjectConfirm} onOpenChange={(open) => { if (!open) setDeleteProjectConfirm(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Projeyi Sil</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>&quot;{projectName}&quot;</strong> projesi silinecek.
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

function ArchiveProjectAlert({
  archiveConfirm, setArchiveConfirm, archiving, handleArchiveProject, projectName,
}: {
  archiveConfirm: boolean;
  setArchiveConfirm: (confirm: boolean) => void;
  archiving: boolean;
  handleArchiveProject: () => void;
  projectName: string;
}) {
  return (
    <AlertDialog open={archiveConfirm} onOpenChange={(open) => { if (!open) setArchiveConfirm(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Projeyi Arşivle</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>&quot;{projectName}&quot;</strong> projesi arşivlenecek.
            Projedeki tüm kesim alanları arşive taşınacak ve aktif listeden kaldırılacak.
            Arşivden geri yükleme her zaman mümkündür.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archiving}>İptal</AlertDialogCancel>
          <AlertDialogAction
            disabled={archiving}
            onClick={handleArchiveProject}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            {archiving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
            Arşivle
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
