import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";

interface TrashDialogProps {
  trashOpen: boolean;
  setTrashOpen: (val: boolean) => void;
  trashItems: any[];
  trashLoading: boolean;
  trashPermanentConfirm: string | null;
  setTrashPermanentConfirm: (val: string | null) => void;
  restoreDonation: (id: string) => void;
  permanentDeleteDonation: (id: string) => void;
  bulkPermanentDeleteDonations?: (ids: string[]) => Promise<void>;
}

export default function TrashDialog({
  trashOpen,
  setTrashOpen,
  trashItems,
  trashLoading,
  trashPermanentConfirm,
  setTrashPermanentConfirm,
  restoreDonation,
  permanentDeleteDonation,
  bulkPermanentDeleteDonations,
}: TrashDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  useEffect(() => {
    if (!trashOpen) setSelectedIds(new Set());
  }, [trashOpen]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [trashItems.length]);

  const allSelected = trashItems.length > 0 && selectedIds.size === trashItems.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(trashItems.map((i) => i.id)));
    }
  }, [allSelected, trashItems]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (!bulkPermanentDeleteDonations) return;
    setBulkProcessing(true);
    try {
      await bulkPermanentDeleteDonations([...selectedIds]);
      setSelectedIds(new Set());
    } finally {
      setBulkProcessing(false);
      setBulkConfirm(false);
    }
  }, [bulkPermanentDeleteDonations, selectedIds]);

  return (
    <>
      <Dialog open={trashOpen} onOpenChange={setTrashOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Çöp Kutusu — Silinen Bağışçılar
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-2 flex flex-col min-h-0">
            {trashLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : trashItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Çöp kutusu boş</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border mb-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                    />
                    Tümünü seç
                    {selectedIds.size > 0 && (
                      <span className="text-foreground font-medium">({selectedIds.size} seçili)</span>
                    )}
                  </label>
                  {selectedIds.size > 0 && bulkPermanentDeleteDonations && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setBulkConfirm(true)}
                      disabled={bulkProcessing}
                    >
                      {bulkProcessing ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3 mr-1" />
                      )}
                      Kalıcı Sil ({selectedIds.size})
                    </Button>
                  )}
                </div>
                <div className="space-y-1 overflow-y-auto">
                  {trashItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                        selectedIds.has(item.id) ? "bg-muted/70" : "bg-muted/40 hover:bg-muted/60"
                      }`}
                      onClick={() => toggleOne(item.id)}
                    >
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleOne(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{item.description || item.name || "—"}</span>
                          {item.name && item.name !== item.description && (
                            <span className="text-xs text-muted-foreground truncate">({item.name})</span>
                          )}
                          {item.donationType && (
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.donationType}</span>
                          )}
                          {item.shareCount > 1 && (
                            <span className="text-xs text-muted-foreground">{item.shareCount} hisse</span>
                          )}
                        </div>
                        {item.deletedAt && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Silindi: {new Date(item.deletedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => restoreDonation(item.id)}
                          title="Geri Yükle"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Geri Yükle
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setTrashPermanentConfirm(item.id)}
                          title="Kalıcı Sil"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!trashPermanentConfirm} onOpenChange={(open) => { if (!open) setTrashPermanentConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kalıcı olarak sil?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu bağışçı kalıcı olarak silinecek ve geri alınamaz. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => trashPermanentConfirm && permanentDeleteDonation(trashPermanentConfirm)}
            >
              Kalıcı Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirm} onOpenChange={(open) => { if (!open) setBulkConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Toplu kalıcı silme</AlertDialogTitle>
            <AlertDialogDescription>
              Seçilen <strong>{selectedIds.size}</strong> bağışçı kalıcı olarak silinecek ve geri alınamaz. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkProcessing}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Kalıcı Sil ({selectedIds.size})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
