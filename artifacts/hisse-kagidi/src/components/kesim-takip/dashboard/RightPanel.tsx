import { useMemo, useState, useEffect, useRef } from "react";
import { CheckCircle2, StickyNote, ChevronDown, ChevronUp, BarChart2, Printer } from "lucide-react";
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
  forceNotesOpen?: boolean;
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

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div
        className="rounded-2xl border p-5"
        style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}
      >
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#94a3b8" }}>
          Hızlı İşlemler
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="flex flex-col items-center gap-2 p-3.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(0,201,134,0.14)", color: "#00c986" }}
            onClick={onMarkNextPending}
            disabled={pendingCount === 0}
          >
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            <span>Kesildi İşaretle</span>
            {pendingCount > 0 && (
              <span className="text-[10px] opacity-70">({pendingCount} bekliyor)</span>
            )}
          </button>
          <button
            className="flex flex-col items-center gap-2 p-3.5 rounded-xl text-xs font-semibold transition-all hover:bg-white/5 disabled:opacity-40"
            style={{ background: "rgba(148,163,184,0.08)", color: "#94a3b8" }}
            onClick={onOpenNextNotes}
            disabled={pendingCount === 0}
          >
            <StickyNote className="w-5 h-5" aria-hidden="true" />
            <span>Not Ekle</span>
          </button>
          <button
            className="flex flex-col items-center gap-2 p-3.5 rounded-xl text-xs font-semibold transition-all hover:bg-white/5"
            style={{ background: "rgba(148,163,184,0.08)", color: "#94a3b8" }}
            onClick={onShowReport}
          >
            <BarChart2 className="w-5 h-5" aria-hidden="true" />
            <span>Rapor Oluştur</span>
          </button>
          <button
            className="flex flex-col items-center gap-2 p-3.5 rounded-xl text-xs font-semibold transition-all hover:bg-white/5"
            style={{ background: "rgba(148,163,184,0.08)", color: "#94a3b8" }}
            onClick={() => window.print()}
            aria-label="Sayfayı yazdır"
          >
            <Printer className="w-5 h-5" aria-hidden="true" />
            <span>Yazdır</span>
          </button>
        </div>
      </div>

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
        className="rounded-2xl border p-5"
        style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}
      >
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#94a3b8" }}>
          Rapor Özeti
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span style={{ color: "#94a3b8" }}>Bugün Kesilen</span>
            <span className="font-bold tabular-nums" style={{ color: "#00c986" }}>{kesildiCount}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span style={{ color: "#94a3b8" }}>Toplam Not</span>
            <span className="font-bold tabular-nums" style={{ color: "#f8fafc" }}>{noteCount}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span style={{ color: "#94a3b8" }}>Düzenleme Talebi</span>
            <span className="font-bold tabular-nums" style={{ color: "#f8fafc" }}>{editReqCount}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span style={{ color: "#94a3b8" }}>Tamamlanma</span>
            <span className="font-bold tabular-nums" style={{ color: pct === 100 ? "#00c986" : "#f8fafc" }}>%{pct}</span>
          </div>

          <div
            className="w-full rounded-full overflow-hidden mt-2"
            style={{ height: 3, background: "rgba(148,163,184,0.12)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(pct, kesildiCount > 0 ? 1 : 0)}%`, background: "#00c986" }}
            />
          </div>
        </div>
        <button
          className="mt-4 w-full text-xs font-semibold text-center transition-colors hover:opacity-80"
          style={{ color: "#00c986" }}
          onClick={onShowReport}
        >
          Detaylı Raporu Görüntüle →
        </button>
      </div>
    </div>
  );
}
