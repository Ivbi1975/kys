import { X, Printer, Clock, Users, StickyNote, Edit3, CheckCircle2, AlertCircle, TrendingUp, Calendar } from "lucide-react";
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
  const pendingReqCount = notes.filter(
    (n) => n.type === NoteType.EDIT_REQUEST && n.status === NoteStatus.PENDING
  ).length;

  const circumference = 2 * Math.PI * 52;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const progressColor = percentage === 100 ? "#00c986" : percentage > 50 ? "#00c986" : "#f59e0b";

  const now = new Date();
  const dateStr = now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* This inner div gets the print class — covers full page on print */}
      <div
        className="summary-report-print-root w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col"
        style={{ background: "#0b1a2b", border: "1px solid rgba(148,163,184,0.14)" }}
      >
        {/* Header */}
        <div
          className="no-print sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.10)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,201,134,0.15)" }}
            >
              <TrendingUp className="w-4 h-4" style={{ color: "#00c986" }} aria-hidden="true" />
            </div>
            <h2 className="font-bold text-base" style={{ color: "#f8fafc" }}>Durum Raporu</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                document.body.classList.add("printing-report");
                window.addEventListener("afterprint", () => {
                  document.body.classList.remove("printing-report");
                }, { once: true });
                window.print();
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-semibold transition-all hover:opacity-80"
              style={{ background: "rgba(148,163,184,0.10)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.12)" }}
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              Yazdır
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/10"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" style={{ color: "#94a3b8" }} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Title block */}
          <div className="text-center">
            <h3 className="text-lg font-extrabold" style={{ color: "#f8fafc" }}>{data.kesimAlaniName}</h3>
            {data.projectName && (
              <p className="text-sm mt-0.5 print-muted" style={{ color: "#94a3b8" }}>{data.projectName}</p>
            )}
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
              <Calendar className="w-3.5 h-3.5 print-muted" style={{ color: "#94a3b8" }} aria-hidden="true" />
              <p className="text-xs print-muted" style={{ color: "#94a3b8" }}>{dateStr}</p>
            </div>
          </div>

          {/* Hero: circular progress + big stats */}
          <div
            className="print-hero rounded-2xl p-5"
            style={{ background: "rgba(0,201,134,0.04)", border: "1px solid rgba(0,201,134,0.12)" }}
          >
            <div className="flex items-center gap-6">
              {/* Donut */}
              <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
                <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90" aria-hidden="true">
                  <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" stroke="rgba(148,163,184,0.15)" />
                  <circle
                    cx="60" cy="60" r="52" fill="none" strokeWidth="10"
                    stroke={progressColor}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: "stroke-dashoffset 1s ease", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="text-3xl font-black tabular-nums leading-none print-accent-green"
                    style={{ color: progressColor }}
                  >
                    %{percentage}
                  </span>
                  <span className="text-[10px] font-semibold mt-1 print-muted" style={{ color: "#94a3b8" }}>tamamlandı</span>
                </div>
              </div>

              {/* Stat columns */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#94a3b8" }} />
                    <span className="text-xs print-muted" style={{ color: "#94a3b8" }}>Toplam</span>
                  </div>
                  <span className="text-xl font-black tabular-nums" style={{ color: "#f8fafc" }}>{total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#00c986" }} />
                    <span className="text-xs print-muted" style={{ color: "#94a3b8" }}>Kesildi</span>
                  </div>
                  <span className="text-xl font-black tabular-nums print-accent-green" style={{ color: "#00c986" }}>{completed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} />
                    <span className="text-xs print-muted" style={{ color: "#94a3b8" }}>Bekleyen</span>
                  </div>
                  <span
                    className={remaining > 0 ? "text-xl font-black tabular-nums print-accent-amber" : "text-xl font-black tabular-nums print-muted"}
                    style={{ color: remaining > 0 ? "#f59e0b" : "#94a3b8" }}
                  >{remaining}</span>
                </div>
                <div className="pt-1">
                  <div className="print-progress-bar-track w-full rounded-full overflow-hidden" style={{ height: 6, background: "rgba(148,163,184,0.12)" }}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${percentage > 50 || percentage === 100 ? "print-progress-green" : "print-progress-amber"}`}
                      style={{ width: `${Math.max(percentage, completed > 0 ? 1 : 0)}%`, background: progressColor, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stat cards grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="print-stat-card rounded-xl p-4 text-center" style={{ background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.10)" }}>
              <p className="text-2xl font-black tabular-nums" style={{ color: "#f8fafc" }}>{total}</p>
              <p className="text-[11px] font-semibold mt-1 print-muted" style={{ color: "#94a3b8" }}>Toplam</p>
            </div>
            <div className="print-stat-green rounded-xl p-4 text-center" style={{ background: "rgba(0,201,134,0.08)", border: "1px solid rgba(0,201,134,0.15)" }}>
              <p className="text-2xl font-black tabular-nums print-accent-green" style={{ color: "#00c986" }}>{completed}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3 print-accent-green" style={{ color: "#00c986" }} aria-hidden="true" />
                <p className="text-[11px] font-semibold print-accent-green" style={{ color: "#00c986" }}>Kesildi</p>
              </div>
            </div>
            <div
              className={remaining > 0 ? "print-stat-amber rounded-xl p-4 text-center" : "print-stat-card rounded-xl p-4 text-center"}
              style={{ background: remaining > 0 ? "rgba(245,158,11,0.08)" : "rgba(148,163,184,0.06)", border: remaining > 0 ? "1px solid rgba(245,158,11,0.15)" : "1px solid rgba(148,163,184,0.10)" }}
            >
              <p
                className={`text-2xl font-black tabular-nums ${remaining > 0 ? "print-accent-amber" : "print-muted"}`}
                style={{ color: remaining > 0 ? "#f59e0b" : "#94a3b8" }}
              >{remaining}</p>
              <p className={`text-[11px] font-semibold mt-1 ${remaining > 0 ? "print-accent-amber" : "print-muted"}`} style={{ color: remaining > 0 ? "#f59e0b" : "#94a3b8" }}>Kalan</p>
            </div>
          </div>

          {/* Time info */}
          {(firstKesildi || lastKesildi) && (
            <div className="print-section rounded-xl p-4 space-y-3" style={{ background: "rgba(148,163,184,0.05)", border: "1px solid rgba(148,163,184,0.10)" }}>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 print-muted" style={{ color: "#94a3b8" }} aria-hidden="true" />
                <h4 className="text-xs font-bold uppercase tracking-wider print-muted" style={{ color: "#94a3b8" }}>Zaman Bilgisi</h4>
              </div>
              {firstKesildi && (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#60a5fa" }} />
                    <span className="text-xs print-muted" style={{ color: "#94a3b8" }}>İlk kesim</span>
                  </div>
                  <span className="text-xs font-semibold text-right" style={{ color: "#cbd5e1" }}>
                    Hayvan {firstKesildi.animalNo} — {formatKesildiTime(firstKesildi.time.toISOString())}
                  </span>
                </div>
              )}
              {lastKesildi && lastKesildi.animalNo !== firstKesildi?.animalNo && (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#00c986" }} />
                    <span className="text-xs print-muted" style={{ color: "#94a3b8" }}>Son kesim</span>
                  </div>
                  <span className="text-xs font-semibold text-right" style={{ color: "#cbd5e1" }}>
                    Hayvan {lastKesildi.animalNo} — {formatKesildiTime(lastKesildi.time.toISOString())}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Team stats */}
          {teamStats.length > 0 && (
            <div className="print-section rounded-xl p-4" style={{ background: "rgba(148,163,184,0.05)", border: "1px solid rgba(148,163,184,0.10)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-3.5 h-3.5 print-muted" style={{ color: "#94a3b8" }} aria-hidden="true" />
                <h4 className="text-xs font-bold uppercase tracking-wider print-muted" style={{ color: "#94a3b8" }}>Ekip Durumu</h4>
              </div>
              <div className="space-y-4">
                {teamStats.map((t) => {
                  const pct = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
                  return (
                    <div key={t.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: t.color, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
                          />
                          <span className="text-xs font-semibold" style={{ color: "#cbd5e1" }}>{t.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="print-muted" style={{ color: "#94a3b8" }}>{t.completed}/{t.total}</span>
                          <span className="font-bold tabular-nums min-w-[36px] text-right" style={{ color: pct === 100 ? "#00c986" : "#f8fafc" }}>%{pct}</span>
                        </div>
                      </div>
                      <div className="print-progress-bar-track w-full rounded-full overflow-hidden" style={{ height: 6, background: "rgba(148,163,184,0.12)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.max(pct, t.completed > 0 ? 2 : 0)}%`, backgroundColor: t.color, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes & requests */}
          <div className="print-section rounded-xl p-4" style={{ background: "rgba(148,163,184,0.05)", border: "1px solid rgba(148,163,184,0.10)" }}>
            <div className="flex items-center gap-2 mb-4">
              <StickyNote className="w-3.5 h-3.5 print-muted" style={{ color: "#94a3b8" }} aria-hidden="true" />
              <h4 className="text-xs font-bold uppercase tracking-wider print-muted" style={{ color: "#94a3b8" }}>Notlar ve Talepler</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-3.5 h-3.5 print-accent-blue" style={{ color: "#60a5fa" }} aria-hidden="true" />
                  <span className="text-sm" style={{ color: "#cbd5e1" }}>Toplam not</span>
                </div>
                <span
                  className="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-lg print-badge-blue"
                  style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}
                >
                  {noteCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-3.5 h-3.5 print-muted" style={{ color: "#94a3b8" }} aria-hidden="true" />
                  <span className="text-sm" style={{ color: "#cbd5e1" }}>Düzenleme talebi</span>
                </div>
                <span
                  className="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-lg print-badge-muted"
                  style={{ background: "rgba(148,163,184,0.10)", color: "#94a3b8" }}
                >
                  {editReqCount}
                </span>
              </div>
              {pendingReqCount > 0 && (
                <div className="flex items-center justify-between pt-3 mt-1 border-t" style={{ borderColor: "rgba(245,158,11,0.20)" }}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 print-accent-amber" style={{ color: "#f59e0b" }} aria-hidden="true" />
                    <span className="text-sm font-semibold print-accent-amber" style={{ color: "#f59e0b" }}>Bekleyen talepler</span>
                  </div>
                  <span
                    className="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-lg print-badge-amber"
                    style={{ background: "rgba(245,158,11,0.14)", color: "#f59e0b" }}
                  >
                    {pendingReqCount}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-[11px] text-center pb-1 print-muted" style={{ color: "#475569" }}>
            {dateStr} {timeStr} itibarıyla
          </p>
        </div>
      </div>
    </div>
  );
}
