import { Button } from "@/components/ui/button";
import { X, Printer } from "lucide-react";
import { formatKesildiTime } from "@/lib/formatting";
import { NoteType, NoteStatus } from "@/lib/constants";
import type { TrackingData, TrackingNote } from "@/lib/api";

export function SummaryReportOverlay({
  data,
  notes,
  onClose,
}: {
  data: TrackingData;
  notes: TrackingNote[];
  onClose: () => void;
}) {
  const completed = data.kesildiCount;
  const total = data.totalGroups;
  const remaining = total - completed;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const kesildiTimes = data.groups
    .filter((g) => g.kesildi && g.kesildiAt)
    .map((g) => ({ animalNo: g.animalNo, time: new Date(g.kesildiAt!) }))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const firstKesildi = kesildiTimes.length > 0 ? kesildiTimes[0] : null;
  const lastKesildi = kesildiTimes.length > 0 ? kesildiTimes[kesildiTimes.length - 1] : null;

  const teamStats: { name: string; color: string; total: number; completed: number }[] = [];
  if (data.teams && data.teams.length > 0) {
    for (const team of data.teams) {
      const teamGroups = data.groups.filter((g) => g.teamId === team.id);
      teamStats.push({
        name: team.name,
        color: team.color,
        total: teamGroups.length,
        completed: teamGroups.filter((g) => g.kesildi).length,
      });
    }
  }

  const noteCount = notes.filter((n) => n.type === NoteType.NOTE).length;
  const editReqCount = notes.filter((n) => n.type === NoteType.EDIT_REQUEST).length;
  const pendingReqCount = notes.filter((n) => n.type === NoteType.EDIT_REQUEST && n.status === NoteStatus.PENDING).length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-filter backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background rounded-xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="no-print sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between rounded-t-xl">
          <h2 className="font-semibold text-sm">Durum Raporu</h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePrint}>
              <Printer className="w-3 h-3 mr-1" /> Yazdır
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4 rapor-summary-print">
          <div className="text-center">
            <h3 className="font-bold text-lg">{data.kesimAlaniName}</h3>
            {data.projectName && <p className="text-xs text-muted-foreground">{data.projectName}</p>}
            <p className="text-xs text-muted-foreground mt-1">{new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="border rounded-lg p-2">
              <div className="text-xl font-bold">{total}</div>
              <div className="text-[10px] text-muted-foreground">Toplam</div>
            </div>
            <div className="border rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800">
              <div className="text-xl font-bold text-emerald-600">{completed}</div>
              <div className="text-[10px] text-muted-foreground">Kesildi</div>
            </div>
            <div className="border rounded-lg p-2 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800">
              <div className="text-xl font-bold text-amber-600">{remaining}</div>
              <div className="text-[10px] text-muted-foreground">Kalan</div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">İlerleme</span>
              <span className="font-semibold">%{percentage}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percentage}%` }} />
            </div>
          </div>

          {(firstKesildi || lastKesildi) && (
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold mb-2">Zaman Bilgisi</h4>
              <div className="space-y-1 text-xs">
                {firstKesildi && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">İlk kesim</span>
                    <span className="font-medium">Hayvan {firstKesildi.animalNo} — {formatKesildiTime(firstKesildi.time.toISOString())}</span>
                  </div>
                )}
                {lastKesildi && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Son kesim</span>
                    <span className="font-medium">Hayvan {lastKesildi.animalNo} — {formatKesildiTime(lastKesildi.time.toISOString())}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {teamStats.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2">Ekip Durumu</h4>
              <div className="space-y-1.5">
                {teamStats.map((t) => (
                  <div key={t.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="flex-1">{t.name}</span>
                    <span className="font-semibold">{t.completed}/{t.total}</span>
                    <span className="text-muted-foreground">%{t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-3">
            <h4 className="text-xs font-semibold mb-2">Notlar ve Talepler</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toplam not</span>
                <span className="font-medium">{noteCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Düzenleme talebi</span>
                <span className="font-medium">{editReqCount}</span>
              </div>
              {pendingReqCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-amber-600">Bekleyen talepler</span>
                  <span className="font-semibold text-amber-600">{pendingReqCount}</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-[9px] text-muted-foreground text-center">
            {new Date().toLocaleDateString("tr-TR")} {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} itibarıyla
          </p>
        </div>
      </div>
    </div>
  );
}
