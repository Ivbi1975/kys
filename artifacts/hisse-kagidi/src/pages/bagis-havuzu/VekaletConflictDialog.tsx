import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Ban, ShieldAlert } from "lucide-react";
import type { VekaletConflict } from "@/lib/api";

export interface ConflictRow {
  vekalet: string;
  existingName: string;
  newName: string;
  kesimAlaniName: string;
  isExactMatch: boolean;
}

interface VekaletConflictDialogProps {
  open: boolean;
  conflicts: ConflictRow[];
  willImportCount: number;
  onProceed: () => void;
  onCancel: () => void;
}

export function categorizeConflicts(
  apiConflicts: VekaletConflict[],
  importDonations: Array<{ vekalet: string; name: string }>,
): ConflictRow[] {
  const importMap = new Map<string, string>();
  for (const d of importDonations) {
    if (d.vekalet) importMap.set(d.vekalet, d.name);
  }

  return apiConflicts.map((c) => {
    const newName = importMap.get(c.vekalet) ?? "";
    const existingNorm = (c.name ?? "").trim().toLowerCase();
    const newNorm = newName.trim().toLowerCase();
    return {
      vekalet: c.vekalet,
      existingName: c.name ?? "",
      newName,
      kesimAlaniName: c.kesimAlaniName ?? "",
      isExactMatch: existingNorm === newNorm && existingNorm !== "",
    };
  });
}

export function VekaletConflictDialog({
  open,
  conflicts,
  willImportCount,
  onProceed,
  onCancel,
}: VekaletConflictDialogProps) {
  const uniqueVekalets = new Set(conflicts.map((c) => c.vekalet));
  const skippedCount = uniqueVekalets.size;

  const sorted = [...conflicts].sort((a, b) => {
    if (a.isExactMatch !== b.isExactMatch) return a.isExactMatch ? -1 : 1;
    return a.vekalet.localeCompare(b.vekalet);
  });

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="h-5 w-5" />
            Tekrarlı Vekalet Numaraları Atlandı
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm">
                Aşağıdaki {skippedCount} vekalet numarası sistemde zaten kayıtlı olduğundan
                <span className="font-semibold text-red-600"> kesinlikle eklenemez</span>.
                {willImportCount > 0
                  ? ` Geri kalan ${willImportCount} kayıt eklenecektir.`
                  : " Aktarılacak başka kayıt bulunmuyor."}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-center dark:border-red-900 dark:bg-red-950">
                  <div className="text-2xl font-bold text-red-600">{skippedCount}</div>
                  <div className="text-red-600/70">Atlanan (Tekrarlı)</div>
                </div>
                <div className="rounded-md border border-green-200 bg-green-50 p-2 text-center dark:border-green-900 dark:bg-green-950">
                  <div className="text-2xl font-bold text-green-600">{willImportCount}</div>
                  <div className="text-green-600/70">Eklenecek</div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Vekalet No</th>
                <th className="py-2 pr-2 font-medium">Mevcut Kayıt (sistemde)</th>
                <th className="py-2 pr-2 font-medium">Dosyadaki Kayıt (atlandı)</th>
                <th className="py-2 font-medium">Bulunduğu Yer</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr
                  key={`${row.vekalet}-${idx}`}
                  className="bg-red-50 dark:bg-red-950/40 border-b border-red-100 dark:border-red-900"
                >
                  <td className="py-1.5 pr-2 font-mono text-xs font-bold text-red-700 dark:text-red-400">
                    {row.vekalet}
                  </td>
                  <td className="py-1.5 pr-2 text-xs">{row.existingName}</td>
                  <td className="py-1.5 pr-2 text-xs line-through text-muted-foreground">{row.newName}</td>
                  <td className="py-1.5 text-muted-foreground text-xs">
                    {row.kesimAlaniName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel onClick={onCancel}>
            <Ban className="h-4 w-4 mr-1" />
            İptal
          </AlertDialogCancel>
          {willImportCount > 0 && (
            <AlertDialogAction
              onClick={onProceed}
              className="bg-green-600 hover:bg-green-700"
            >
              {willImportCount} Kaydı Ekle
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
