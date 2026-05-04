import React from "react";
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
import { MoveRight, Loader2, Archive, Plus, Minus, ChevronDown } from "lucide-react";
import { createKesimAlani } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
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
  | "renameKesimDialogOpen" | "setRenameKesimDialogOpen" | "editingKesim" | "setEditingKesim" | "handleRenameKesim"
> & {
  projectName: string;
  projectId: string;
  onBulkSuccess?: () => void;
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
        projectId={props.projectId}
        onBulkSuccess={props.onBulkSuccess}
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
  editingKesim: { id: string; name: string; yetkili: string; displayName: string; maxVekalet: string; maxAnimal: string } | null;
  setEditingKesim: (v: { id: string; name: string; yetkili: string; displayName: string; maxVekalet: string; maxAnimal: string } | null) => void;
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Maks. Vekalet</label>
              <Input
                placeholder="Sınırsız"
                type="number"
                min={1}
                value={editingKesim?.maxVekalet ?? ""}
                onChange={e => set({ maxVekalet: e.target.value })}
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

type BulkItemPD = {
  id: string;
  name: string;
  autoName: string;
  yetkili: string;
  displayName: string;
  maxAnimalStr: string;
  expanded: boolean;
};

function CreateKesimAlaniDialog({
  dialogOpen, setDialogOpen, newKesimAdi, setNewKesimAdi, handleCreateKesimAlani, projectId, onBulkSuccess,
}: {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  newKesimAdi: string;
  setNewKesimAdi: (name: string) => void;
  handleCreateKesimAlani: (yetkili?: string, displayName?: string, maxVekalet?: number | null, maxAnimal?: number | null) => void;
  projectId: string;
  onBulkSuccess?: () => void;
}) {
  const [mode, setMode] = React.useState<"single" | "bulk">("single");
  const [yetkili, setYetkili] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [maxAnimalStr, setMaxAnimalStr] = React.useState("");
  const [baseName, setBaseName] = React.useState("Kesim Alanı");
  const [count, setCount] = React.useState(3);
  const [bulkItems, setBulkItems] = React.useState<BulkItemPD[]>([]);
  const [bulkLoading, setBulkLoading] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (mode !== "bulk") return;
    const base = baseName.trim() || "Kesim Alanı";
    setBulkItems(prev => {
      const result: BulkItemPD[] = [];
      for (let i = 0; i < count; i++) {
        const autoName = `${base} ${i + 1}`;
        const existing = prev[i];
        if (existing) {
          const wasAuto = existing.name === existing.autoName;
          result.push({ ...existing, autoName, name: wasAuto ? autoName : existing.name });
        } else {
          result.push({ id: crypto.randomUUID(), name: autoName, autoName, yetkili: "", displayName: "", maxAnimalStr: "", expanded: false });
        }
      }
      return result;
    });
  }, [baseName, count, mode]);

  const updateBulkItem = (id: string, patch: Partial<BulkItemPD>) =>
    setBulkItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));

  const reset = () => {
    setYetkili("");
    setDisplayName("");
    setMaxAnimalStr("");
    setMode("single");
    setBaseName("Kesim Alanı");
    setCount(3);
    setBulkItems([]);
    setBulkLoading(false);
  };

  const handleCreate = () => {
    const maxAnimal = maxAnimalStr.trim() ? parseInt(maxAnimalStr.trim(), 10) : null;
    handleCreateKesimAlani(yetkili || undefined, displayName || undefined, null, maxAnimal);
    setYetkili("");
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
          projectId: projectId || null,
          yetkili: item.yetkili.trim() || null,
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
    onBulkSuccess?.();
    toast({
      title: `${success} kesim alanı oluşturuldu`,
      ...(fail > 0 ? { description: `${fail} adet oluşturulamadı`, variant: "destructive" as const } : {}),
    });
    setDialogOpen(false);
    reset();
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) reset(); }}>
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
              placeholder="Kesim alanı adı"
              value={newKesimAdi}
              onChange={(e) => setNewKesimAdi(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <Input
              placeholder="Yetkili (isteğe bağlı)"
              value={yetkili}
              onChange={(e) => setYetkili(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Input
              placeholder="Çıktıda Görünecek İsim (isteğe bağlı)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Input
              type="number"
              min={1}
              placeholder="Maksimum Hayvan Sayısı (isteğe bağlı)"
              value={maxAnimalStr}
              onChange={(e) => setMaxAnimalStr(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button onClick={handleCreate} className="w-full" disabled={!newKesimAdi.trim()}>
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
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background hover:bg-accent transition-colors disabled:opacity-50"
                  onClick={() => setCount(c => Math.max(1, c - 1))}
                  disabled={count <= 1}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-bold text-sm tabular-nums">{count}</span>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background hover:bg-accent transition-colors disabled:opacity-50"
                  onClick={() => setCount(c => Math.min(50, c + 1))}
                  disabled={count >= 50}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

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
                        placeholder="Yetkili (isteğe bağlı)"
                        value={item.yetkili}
                        onChange={(e) => updateBulkItem(item.id, { yetkili: e.target.value })}
                      />
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
