import { Button } from "@/components/ui/button";
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
}: TrashDialogProps) {
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
          <div className="flex-1 overflow-y-auto mt-2">
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
              <div className="space-y-1">
                {trashItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                  >
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
                    <div className="flex items-center gap-1 flex-shrink-0">
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
    </>
  );
}
