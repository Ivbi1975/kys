import { useMemo, useState, useEffect, useRef } from "react";
import { CheckCircle2, StickyNote, ChevronDown, ChevronUp, Clock, FileText, AlertCircle, TrendingUp, BarChart2 } from "lucide-react";
import { formatKesildiTime } from "@/lib/formatting";
import { NoteType } from "@/lib/constants";
import type { TrackingGroup, TrackingNote } from "@/lib/api";
import { NoteInput } from "../NoteInput";
import { NotesList } from "../NotesList";

interface RightPanelProps {
  groups: TrackingGroup[];
  notes: TrackingNote[];
  kesildiCount: number;
  totalGroups: number;
  token: string;
  onNoteAdded: (note: TrackingNote) => void;
  onMarkNextPending: () => void;
  onOpenNextNotes: () => void;
  onShowReport: () => void;
  pendingCount: number;
  forceNotesOpen?: number;
  createNote?: (data: { animalGroupId?: string; type: string; content: string }) => Promise<TrackingNote | null>;
}

export function RightPanel({
  groups, notes, kesildiCount, totalGroups, token,
  onNoteAdded, onMarkNextPending, onOpenNextNotes, onShowReport,
  pendingCount, forceNotesOpen, createNote,
}: RightPanelProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forceNotesOpen) {
      setNotesOpen(true);
      setTimeout(() => {
        notesRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  }, [forceNotesOpen]);

  const activityItems = useMemo(() => {
    const items: { label: string; sub: string; time: string; type: "kesildi" | "note"; }[] = [];

    const kesildiGroups = groups
      .filter(g => g.kesildi && g.kesildiAt)
      .sort((a, b) => new Date(b.kesildiAt!).getTime() - new Date(a.kesildiAt!).getTime())
      .slice(0, 5);

    for (const g of kesildiGroups) {
      items.push({
        label: `Hayvan ${g.animalNo} kesildi`,
        sub: g.donors[0]?.description || g.donors[0]?.name || "",
        time: formatKesildiTime(g.kesildiAt!),
        type: "kesildi",
      });
    }

    const noteItems = [...notes]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);

    for (const n of noteItems) {
      items.push({
        label: n.type === NoteType.EDIT_REQUEST ? "Düzenleme talebi eklendi" : "Genel not eklendi",
        sub: n.content?.slice(0, 40) || "",
        time: formatKesildiTime(n.createdAt),
        type: "note",
      });
    }

    return items.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 7);
  }, [groups, notes]);

  const pct = totalGroups > 0 ? Math.round((kesildiCount / totalGroups) * 100) : 0;
  const noteCount = notes.filter(n => n.type === NoteType.NOTE).length;
  const editReqCount = notes.filter(n => n.type === NoteType.EDIT_REQUEST).length;
  const computedPending = totalGroups - kesildiCount;

  const lastKesildiAt = useMemo(() => {
    const times = groups
      .filter(g => g.kesildi && g.kesildiAt)
      .map(g => new Date(g.kesildiAt!).getTime());
    return times.length > 0 ? new Date(Math.max(...times)) : null;
  }, [groups]);

  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="space-y-4">
      {/* Genel Notlar */}
      <div
        ref={notesRef}
        className="rounded-2xl border overflow-hidden"
        style={{ background: "#0b1a2b", borderColor: notesOpen ? "rgba(0,201,134,0.25)" : "rgba(148,163,184,0.14)" }}
      >
        <button
          className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/5"
          onClick={() => setNotesOpen(!notesOpen)}
          aria-expanded={notesOpen}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
              Genel Notlar
            </h3>
            {notes.length > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(148,163,184,0.12)", color: "#94a3b8" }}
              >
                {notes.length}
              </span>
            )}
          </div>
          {notesOpen
            ? <ChevronUp className="w-4 h-4" style={{ color: "#94a3b8" }} />
            : <ChevronDown className="w-4 h-4" style={{ color: "#94a3b8" }} />
          }
        </button>
        {notesOpen && (
          <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: "rgba(148,163,184,0.08)" }}>
            <div className="pt-3">
              <NoteInput token={token} onNoteAdded={onNoteAdded} createNote={createNote as any} />
            </div>
            <NotesList notes={notes} />
          </div>
        )}
      </div>

      {/* Activity */}
      <div
        className="rounded-2xl border p-5"
        style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
            Güncel Aktivite
          </h3>
        </div>
        {activityItems.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: "#94a3b8" }}>Henüz aktivite yok</p>
        ) : (
          <div className="space-y-3">
            {activityItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: item.type === "kesildi" ? "rgba(0,201,134,0.14)" : "rgba(59,130,246,0.14)",
                  }}
                >
                  {item.type === "kesildi" ? (
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#00c986" }} aria-hidden="true" />
                  ) : (
                    <StickyNote className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "#cbd5e1" }}>{item.label}</p>
                  {item.sub && (
                    <p className="text-[10px] truncate" style={{ color: "#94a3b8" }}>{item.sub}</p>
                  )}
                </div>
                <span className="text-[10px] shrink-0 font-medium" style={{ color: "#94a3b8" }}>{item.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Summary */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "rgba(148,163,184,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(0,201,134,0.14)" }}
            >
              <BarChart2 className="w-3.5 h-3.5" style={{ color: "#00c986" }} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
              Rapor Özeti
            </h3>
          </div>
          {pct === 100 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(0,201,134,0.16)", color: "#00c986" }}
            >
              Tamamlandı
            </span>
          )}
        </div>

        <div className="p-5 space-y-5">
          {/* Circular progress + center stat */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
              <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" stroke="rgba(148,163,184,0.10)" />
                <circle
                  cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                  stroke={pct === 100 ? "#00c986" : pct > 50 ? "#00c986" : "#f59e0b"}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: "stroke-dashoffset 0.9s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black tabular-nums leading-none" style={{ color: pct === 100 ? "#00c986" : "#f8fafc" }}>
                  {pct}%
                </span>
                <span className="text-[9px] font-semibold mt-0.5" style={{ color: "#94a3b8" }}>tamamlandı</span>
              </div>
            </div>

            <div className="flex-1 space-y-2.5">
              <div>
                <div className="flex justify-between text-[10px] mb-1" style={{ color: "#94a3b8" }}>
                  <span>Kesilen</span>
                  <span className="font-bold tabular-nums" style={{ color: "#00c986" }}>{kesildiCount} / {totalGroups}</span>
                </div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: "rgba(148,163,184,0.10)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(pct, kesildiCount > 0 ? 2 : 0)}%`, background: "#00c986" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1" style={{ color: "#94a3b8" }}>
                  <span>Bekleyen</span>
                  <span className="font-bold tabular-nums" style={{ color: computedPending > 0 ? "#f59e0b" : "#94a3b8" }}>{computedPending}</span>
                </div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: "rgba(148,163,184,0.10)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: totalGroups > 0 ? `${Math.round((computedPending / totalGroups) * 100)}%` : "0%",
                      background: "#f59e0b"
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div
              className="rounded-xl p-3.5"
              style={{ background: "rgba(0,201,134,0.07)", border: "1px solid rgba(0,201,134,0.12)" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#00c986" }} />
                <span className="text-[10px] font-semibold" style={{ color: "#94a3b8" }}>Kesilen</span>
              </div>
              <p className="text-xl font-black tabular-nums" style={{ color: "#00c986" }}>{kesildiCount}</p>
              <p className="text-[9px] mt-0.5" style={{ color: "#94a3b8" }}>hayvan</p>
            </div>

            <div
              className="rounded-xl p-3.5"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.12)" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: "#f59e0b" }} />
                <span className="text-[10px] font-semibold" style={{ color: "#94a3b8" }}>Bekleyen</span>
              </div>
              <p className="text-xl font-black tabular-nums" style={{ color: computedPending > 0 ? "#f59e0b" : "#94a3b8" }}>{computedPending}</p>
              <p className="text-[9px] mt-0.5" style={{ color: "#94a3b8" }}>hayvan</p>
            </div>

            <div
              className="rounded-xl p-3.5"
              style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.12)" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "#60a5fa" }} />
                <span className="text-[10px] font-semibold" style={{ color: "#94a3b8" }}>Genel Not</span>
              </div>
              <p className="text-xl font-black tabular-nums" style={{ color: "#60a5fa" }}>{noteCount}</p>
              <p className="text-[9px] mt-0.5" style={{ color: "#94a3b8" }}>kayıt</p>
            </div>

            <div
              className="rounded-xl p-3.5"
              style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.12)" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "#f87171" }} />
                <span className="text-[10px] font-semibold" style={{ color: "#94a3b8" }}>Düz. Talebi</span>
              </div>
              <p className="text-xl font-black tabular-nums" style={{ color: editReqCount > 0 ? "#f87171" : "#94a3b8" }}>{editReqCount}</p>
              <p className="text-[9px] mt-0.5" style={{ color: "#94a3b8" }}>talep</p>
            </div>
          </div>

          {/* Last action */}
          {lastKesildiAt && (
            <div
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
              style={{ background: "rgba(148,163,184,0.05)", border: "1px solid rgba(148,163,184,0.08)" }}
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: "#94a3b8" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px]" style={{ color: "#94a3b8" }}>Son kesim işlemi</p>
                <p className="text-xs font-semibold truncate" style={{ color: "#cbd5e1" }}>
                  {formatKesildiTime(lastKesildiAt.toISOString())}
                </p>
              </div>
            </div>
          )}

          {/* CTA button */}
          <button
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "rgba(0,201,134,0.14)", color: "#00c986", border: "1px solid rgba(0,201,134,0.20)" }}
            onClick={onShowReport}
          >
            <BarChart2 className="w-4 h-4" aria-hidden="true" />
            Detaylı Raporu Görüntüle
          </button>
        </div>
      </div>
    </div>
  );
}
