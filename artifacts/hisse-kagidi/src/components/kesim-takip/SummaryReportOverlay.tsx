import { X, Printer, Clock, Users, StickyNote, Edit3 } from "lucide-react";
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="no-print sticky top-0 z-10 bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-stone-800">Durum Raporu</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors font-medium min-h-[36px]"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              Yazdır
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-stone-100 transition-colors"
              aria-label="Kapat"
            >
              <X className="w-4 h-4 text-stone-500" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 rapor-summary-print">
          {/* Title */}
          <div className="text-center pb-2 border-b border-stone-50">
            <h3 className="font-bold text-stone-800">{data.kesimAlaniName}</h3>
            {data.projectName && <p className="text-xs text-stone-400 mt-0.5">{data.projectName}</p>}
            <p className="text-xs text-stone-400 mt-1">
              {new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Big stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-stone-50 border border-stone-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-stone-700 tabular-nums">{total}</div>
              <div className="text-[11px] text-stone-400 font-medium mt-0.5">Toplam</div>
            </div>
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-teal-600 tabular-nums">{completed}</div>
              <div className="text-[11px] text-teal-500 font-medium mt-0.5">Kesildi</div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-amber-500 tabular-nums">{remaining}</div>
              <div className="text-[11px] text-amber-400 font-medium mt-0.5">Kalan</div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
              <span>İlerleme</span>
              <span className="font-bold text-stone-700">%{percentage}</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Time info */}
          {(firstKesildi || lastKesildi) && (
            <div className="bg-stone-50 border border-stone-100 rounded-xl p-4">
              <h4 className="text-xs font-bold text-stone-700 flex items-center gap-1.5 mb-3">
                <Clock className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
                Zaman Bilgisi
              </h4>
              <div className="space-y-2 text-xs">
                {firstKesildi && (
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">İlk kesim</span>
                    <span className="font-semibold text-stone-700">
                      Hayvan {firstKesildi.animalNo} — {formatKesildiTime(firstKesildi.time.toISOString())}
                    </span>
                  </div>
                )}
                {lastKesildi && lastKesildi.animalNo !== firstKesildi?.animalNo && (
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Son kesim</span>
                    <span className="font-semibold text-stone-700">
                      Hayvan {lastKesildi.animalNo} — {formatKesildiTime(lastKesildi.time.toISOString())}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Team stats */}
          {teamStats.length > 0 && (
            <div className="bg-stone-50 border border-stone-100 rounded-xl p-4">
              <h4 className="text-xs font-bold text-stone-700 flex items-center gap-1.5 mb-3">
                <Users className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
                Ekip Durumu
              </h4>
              <div className="space-y-2.5">
                {teamStats.map((t) => {
                  const pct = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
                  return (
                    <div key={t.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                          <span className="font-medium text-stone-700">{t.name}</span>
                        </div>
                        <span className="font-semibold text-stone-600">{t.completed}/{t.total} · %{pct}</span>
                      </div>
                      <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: t.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes summary */}
          <div className="bg-stone-50 border border-stone-100 rounded-xl p-4">
            <h4 className="text-xs font-bold text-stone-700 flex items-center gap-1.5 mb-3">
              <StickyNote className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
              Notlar ve Talepler
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-stone-400 flex items-center gap-1">
                  <StickyNote className="w-3 h-3" aria-hidden="true" /> Toplam not
                </span>
                <span className="font-semibold text-stone-700">{noteCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400 flex items-center gap-1">
                  <Edit3 className="w-3 h-3" aria-hidden="true" /> Düzenleme talebi
                </span>
                <span className="font-semibold text-stone-700">{editReqCount}</span>
              </div>
              {pendingReqCount > 0 && (
                <div className="flex justify-between items-center pt-1 border-t border-stone-200">
                  <span className="text-amber-500 font-medium">Bekleyen talepler</span>
                  <span className="font-bold text-amber-500">{pendingReqCount}</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-stone-400 text-center">
            {new Date().toLocaleDateString("tr-TR")} {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} itibarıyla
          </p>
        </div>
      </div>
    </div>
  );
}
