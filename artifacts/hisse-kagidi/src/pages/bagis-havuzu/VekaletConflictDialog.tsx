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
import { AlertTriangle, Ban } from "lucide-react";
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
  onProceed,
  onCancel,
}: VekaletConflictDialogProps) {
  const uniqueVekalets = new Set(conflicts.map((c) => c.vekalet));
  const uniqueExact = new Set(
    conflicts.filter((c) => c.isExactMatch).map((c) => c.vekalet),
  );
  const uniquePartial = new Set(
    conflicts.filter((c) => !c.isExactMatch).map((c) => c.vekalet),
  );
  const totalCount = uniqueVekalets.size;
  const exactCount = uniqueExact.size;
  const partialCount = uniquePartial.size;

  const sorted = [...conflicts].sort((a, b) => {
    if (a.isExactMatch !== b.isExactMatch) return a.isExactMatch ? -1 : 1;
    return a.vekalet.localeCompare(b.vekalet);
  });

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Vekalet Çakışması Tespit Edildi
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                İçe aktarılmak istenen verilerde mevcut kayıtlarla çakışan
                vekalet numaraları bulundu.
              </p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-md border p-2 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {totalCount}
                  </div>
                  <div className="text-muted-foreground">Toplam Çakışma</div>
                </div>
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-center dark:border-red-900 dark:bg-red-950">
                  <div className="text-2xl font-bold text-red-600">
                    {exactCount}
                  </div>
                  <div className="text-red-600/70">Tam Eşleşme</div>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-center dark:border-amber-900 dark:bg-amber-950">
                  <div className="text-2xl font-bold text-amber-600">
                    {partialCount}
                  </div>
                  <div className="text-amber-600/70">Kısmi Eşleşme</div>
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
                <th className="py-2 pr-2 font-medium">Mevcut Kayıt</th>
                <th className="py-2 pr-2 font-medium">Yeni Kayıt</th>
                <th className="py-2 font-medium">Kesim Alanı</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr
                  key={`${row.vekalet}-${idx}`}
                  className={
                    row.isExactMatch
                      ? "bg-red-50 dark:bg-red-950/40 border-b border-red-100 dark:border-red-900"
                      : "border-b"
                  }
                >
                  <td className="py-1.5 pr-2 font-mono text-xs">
                    {row.vekalet}
                  </td>
                  <td className="py-1.5 pr-2">{row.existingName}</td>
                  <td className="py-1.5 pr-2">{row.newName}</td>
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
          <AlertDialogAction
            onClick={onProceed}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Yine de Ekle
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
