import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, AlertTriangle, MoveRight } from "lucide-react";

export interface TransferConflictItem {
  donationId: string;
  donationName: string;
  vekalet: string;
  existingVekaletDonationId?: string;
  existingVekaletName?: string;
}

interface MoveDonationConflictModalProps {
  open: boolean;
  conflicts: TransferConflictItem[];
  sourceKesimAlaniName: string;
  targetKesimAlaniName: string;
  onProceed: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MoveDonationConflictModal({
  open,
  conflicts,
  sourceKesimAlaniName,
  targetKesimAlaniName,
  onProceed,
  onCancel,
  isLoading,
}: MoveDonationConflictModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <ShieldAlert className="h-5 w-5" />
            Çakışan Vekalet Numaraları Tespit Edildi
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm">
                Taşınmak istenen <span className="font-semibold">{conflicts.length}</span> bağışın vekalet numarası,
                hedef listede (<span className="font-semibold">{targetKesimAlaniName}</span>) zaten kayıtlı.
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-2 text-center">
                  <div className="text-2xl font-bold text-amber-600">{conflicts.length}</div>
                  <div className="text-amber-600/70 text-xs">Çakışan Kayıt</div>
                </div>
                <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-2 flex items-center justify-center gap-2">
                  <div className="text-xs text-center text-blue-700 dark:text-blue-400">
                    <div className="font-semibold truncate">{sourceKesimAlaniName}</div>
                    <MoveRight className="w-3 h-3 mx-auto my-0.5" />
                    <div className="font-semibold truncate">{targetKesimAlaniName}</div>
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Taşınan Bağış</th>
                <th className="py-2 pr-3 font-medium">Vekalet No</th>
                <th className="py-2 font-medium">Hedefte Mevcut</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((row, idx) => (
                <tr
                  key={`${row.donationId}-${idx}`}
                  className="border-b border-amber-100 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30"
                >
                  <td className="py-1.5 pr-3 text-xs font-medium">{row.donationName || "—"}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                    {row.vekalet}
                  </td>
                  <td className="py-1.5 text-xs text-muted-foreground">
                    {row.existingVekaletName || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 mt-3 p-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Yine de devam ederseniz bu bağışlar taşınacak ve hedef listede aynı vekalet numarasından iki kayıt oluşacak.
          </p>
        </div>

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel onClick={onCancel}>İptal</AlertDialogCancel>
          <Button
            onClick={onProceed}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isLoading ? "Taşınıyor..." : "Yine de Taşı"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
