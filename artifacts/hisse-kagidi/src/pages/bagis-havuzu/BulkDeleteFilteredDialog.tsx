import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";
import type { BulkDeletePreviewResult } from "@/lib/api";

interface BulkDeleteFilteredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: BulkDeletePreviewResult | null;
  loading: boolean;
  deleting: boolean;
  onConfirm: () => void;
}

export function BulkDeleteFilteredDialog({
  open,
  onOpenChange,
  preview,
  loading,
  deleting,
  onConfirm,
}: BulkDeleteFilteredDialogProps) {
  const hasKesimListesi = (preview?.inKesimListesi ?? 0) > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {hasKesimListesi ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <Trash2 className="w-5 h-5 text-destructive" />
            )}
            Filtredeki Bağışları Sil
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-foreground">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Kontrol ediliyor...
                </div>
              ) : preview ? (
                <>
                  <p className="text-muted-foreground">
                    Mevcut filtreyle eşleşen{" "}
                    <span className="font-semibold text-foreground">{preview.total} bağış</span>{" "}
                    kalıcı olarak silinecek. Bu işlem geri alınamaz.
                  </p>

                  {hasKesimListesi && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4" />
                        Kesim Listesinde Bağış Var
                      </div>
                      <p className="text-amber-800 dark:text-amber-300 text-xs">
                        Bu bağışlardan{" "}
                        <span className="font-semibold">{preview.inKesimListesi} tanesi</span>{" "}
                        aşağıdaki kesim listelerinde yer alıyor ve oradan da silinecek:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {preview.kesimListeleri.map((ka) => (
                          <Badge
                            key={ka.id}
                            variant="outline"
                            className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs"
                          >
                            {ka.name} ({ka.count})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-muted-foreground text-xs">
                    Silme işlemi havuzdan ve tüm kesim listelerinden kalıcı olarak kaldırır.
                  </p>
                </>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading || deleting || !preview || preview.total === 0}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Siliniyor...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-1.5" />
                {preview && preview.total > 0
                  ? `${preview.total} Bağışı Sil`
                  : "Sil"}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
