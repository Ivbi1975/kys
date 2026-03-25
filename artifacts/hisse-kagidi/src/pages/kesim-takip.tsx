import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { fetchTrackingData, toggleKesildi, fetchTrackingNotes, createTrackingNote, fetchGroupPhotos, getGroupPhotoUrl, uploadGroupPhoto, deleteGroupPhoto, assignTeamTracking } from "@/lib/api";
import type { TrackingData, TrackingGroup, TrackingNote, GroupPhoto, TrackingTeam } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import PhotoGallery from "@/components/PhotoGallery";
import {
  CheckCircle2, Circle, Loader2, AlertTriangle, Beef, Clock, X,
  ChevronLeft, ChevronRight, MessageSquarePlus, Mic, MicOff, Send,
  StickyNote, Edit3, ChevronDown, ChevronUp, Camera
} from "lucide-react";

const colorMap: Record<string, string> = {
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
};

type DonorFieldKey = "name" | "description" | "donationType" | "vekalet" | "notes";

const FIELD_LABELS: Record<DonorFieldKey, string> = {
  name: "Adına Kesilen",
  description: "Vekaleti Veren",
  donationType: "Cinsi",
  vekalet: "Vekalet",
  notes: "Notlar",
};

function formatKesildiTime(isoString: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatNoteTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) + " " +
      d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

interface SpeechRecognitionResult {
  readonly [index: number]: { transcript: string };
  readonly isFinal: boolean;
  readonly length: number;
}

interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResult;
  readonly length: number;
}

interface SpeechRecognitionEvent {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const isSupported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "tr-TR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript("");
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return { isSupported, isListening, transcript, startListening, stopListening, setTranscript };
}

function NoteInput({
  groupId,
  token,
  onNoteAdded,
}: {
  groupId?: string;
  token: string;
  onNoteAdded: (note: TrackingNote) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const speech = useSpeechRecognition();

  const handleSend = async () => {
    const content = (speech.isListening ? speech.transcript : text).trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const note = await createTrackingNote(token, {
        animalGroupId: groupId,
        type: "note",
        content,
      });
      onNoteAdded(note);
      setText("");
      speech.setTranscript("");
      if (speech.isListening) speech.stopListening();
    } catch {
    } finally {
      setSending(false);
    }
  };

  const handleMicToggle = () => {
    if (speech.isListening) {
      speech.stopListening();
      if (speech.transcript) {
        setText(prev => (prev ? prev + " " : "") + speech.transcript);
      }
    } else {
      speech.startListening();
    }
  };

  const displayText = speech.isListening ? speech.transcript : text;

  return (
    <div className="flex gap-1.5 items-end">
      <div className="flex-1 relative">
        <Textarea
          placeholder="Not yazın..."
          value={displayText}
          onChange={(e) => {
            if (!speech.isListening) setText(e.target.value);
          }}
          className="min-h-[40px] max-h-[100px] text-sm pr-10 resize-none"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        {speech.isListening && (
          <span className="absolute right-2 top-2 text-[10px] text-red-500 font-semibold animate-pulse">REC</span>
        )}
      </div>
      {speech.isSupported && (
        <Button
          variant={speech.isListening ? "destructive" : "outline"}
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          onClick={handleMicToggle}
        >
          {speech.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
      )}
      <Button
        size="sm"
        className="h-9 w-9 p-0 shrink-0"
        onClick={handleSend}
        disabled={!displayText.trim() || sending}
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </Button>
    </div>
  );
}

function EditRequestForm({
  donor,
  donorIndex,
  groupId,
  token,
  onNoteAdded,
  onClose,
}: {
  donor: TrackingGroup["donors"][0];
  donorIndex: number;
  groupId: string;
  token: string;
  onNoteAdded: (note: TrackingNote) => void;
  onClose: () => void;
}) {
  const [field, setField] = useState<DonorFieldKey>("name");
  const [newValue, setNewValue] = useState("");
  const [sending, setSending] = useState(false);

  const currentValue = donor[field] || "";

  const handleSubmit = async () => {
    if (!newValue.trim() || sending) return;
    setSending(true);
    try {
      const note = await createTrackingNote(token, {
        animalGroupId: groupId,
        type: "edit_request",
        content: `Sıra ${donorIndex + 1}: ${FIELD_LABELS[field] || field} değişiklik talebi`,
        fieldName: field,
        oldValue: currentValue,
        newValue: newValue.trim(),
      });
      onNoteAdded(note);
      onClose();
    } catch {
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <Edit3 className="w-3 h-3" /> Düzenleme Talebi — Sıra {donorIndex + 1}
        </span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {(Object.entries(FIELD_LABELS) as [DonorFieldKey, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              field === key
                ? "bg-amber-200 dark:bg-amber-800 border-amber-400 font-semibold"
                : "bg-background border-border"
            }`}
            onClick={() => { setField(key); setNewValue(""); }}
          >
            {label}
          </button>
        ))}
      </div>
      {currentValue && (
        <div className="text-xs">
          <span className="text-muted-foreground">Mevcut: </span>
          <span className="line-through text-red-500">{currentValue}</span>
        </div>
      )}
      <Input
        placeholder="Yeni değer..."
        value={newValue}
        onChange={(e) => setNewValue(e.target.value)}
        className="h-8 text-sm"
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
      />
      <Button size="sm" className="w-full h-8" onClick={handleSubmit} disabled={!newValue.trim() || sending}>
        {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
        Talep Gönder
      </Button>
    </div>
  );
}

function NotesList({ notes, groupId }: { notes: TrackingNote[]; groupId?: string }) {
  const filtered = groupId ? notes.filter(n => n.animalGroupId === groupId) : notes;
  if (filtered.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {filtered.map(note => (
        <div
          key={note.id}
          className={`rounded-lg p-2 text-xs ${
            note.type === "edit_request"
              ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
              : "bg-muted/50"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {note.type === "edit_request" ? (
                <>
                  <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-0.5 mb-0.5">
                    <Edit3 className="w-2.5 h-2.5" /> {FIELD_LABELS[note.fieldName as DonorFieldKey] || note.fieldName}
                  </span>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="line-through text-red-400">{note.oldValue || "—"}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-emerald-600">{note.newValue}</span>
                  </div>
                  {note.status !== "pending" && (
                    <span className={`text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded-full font-semibold ${
                      note.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}>
                      {note.status === "approved" ? "Onaylandı" : "Reddedildi"}
                    </span>
                  )}
                </>
              ) : (
                <p className="whitespace-pre-wrap">{note.content}</p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{formatNoteTime(note.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function KesimKagidiOverlay({
  groups,
  initialIndex,
  toggling,
  notes,
  token,
  teams,
  onToggle,
  onClose,
  onNoteAdded,
  onTeamAssign,
}: {
  groups: TrackingGroup[];
  initialIndex: number;
  toggling: Set<string>;
  notes: TrackingNote[];
  token: string;
  teams: TrackingTeam[];
  onToggle: (group: TrackingGroup) => void;
  onClose: () => void;
  onNoteAdded: (note: TrackingNote) => void;
  onTeamAssign: (groupId: string, teamId: string | null) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchDeltaX = useRef(0);
  const touchDeltaY = useRef(0);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [editDonorIdx, setEditDonorIdx] = useState<number | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [photos, setPhotos] = useState<GroupPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const photosLoadedFor = useRef<string | null>(null);

  const group = groups[currentIndex];
  if (!group) return null;

  const goNext = () => {
    if (currentIndex < groups.length - 1) setCurrentIndex(currentIndex + 1);
    setEditDonorIdx(null);
    setShowPhotos(false);
    photosLoadedFor.current = null;
  };
  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    setEditDonorIdx(null);
    setShowPhotos(false);
    photosLoadedFor.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    touchStartX.current = clientX;
    touchStartY.current = clientY;
    touchDeltaX.current = 0;
    touchDeltaY.current = 0;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging.current) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    touchDeltaX.current = clientX - touchStartX.current;
    touchDeltaY.current = clientY - touchStartY.current;
    if (Math.abs(touchDeltaX.current) > Math.abs(touchDeltaY.current)) {
      setSwipeOffset(touchDeltaX.current);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const threshold = 60;

    if (touchDeltaY.current > 100 && Math.abs(touchDeltaY.current) > Math.abs(touchDeltaX.current)) {
      onClose();
      return;
    }

    if (touchDeltaX.current < -threshold) {
      goNext();
    } else if (touchDeltaX.current > threshold) {
      goPrev();
    }
    setSwipeOffset(0);
  };

  const rows = [];
  for (let i = 0; i < 7; i++) {
    const donor = group.donors[i];
    rows.push({
      sira: i + 1,
      vekalet: donor?.vekalet || "",
      vekaletVeren: donor?.description || "",
      adinaKesilen: donor?.name || "",
      cinsi: donor?.donationType || "",
      notlar: donor?.notes || "",
      empty: !donor,
      donor,
    });
  }

  const isToggling = toggling.has(group.id);
  const groupNoteCount = notes.filter(n => n.animalGroupId === group.id).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl mx-2 max-h-[95vh] flex flex-col"
        style={{ transform: `translateX(${swipeOffset}px)`, transition: isDragging.current ? "none" : "transform 0.2s ease-out" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onMouseLeave={() => { if (isDragging.current) handleTouchEnd(); }}
      >
        <div className="flex items-center justify-between px-1 mb-2">
          <Button variant="ghost" size="sm" onClick={goPrev} disabled={currentIndex === 0} className="text-white hover:bg-white/20 h-8 w-8 p-0">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-white text-sm font-semibold">
            Hayvan {currentIndex + 1} / {groups.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={goNext} disabled={currentIndex === groups.length - 1} className="text-white hover:bg-white/20 h-8 w-8 p-0">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/20 h-8 w-8 p-0">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <Card
          className="flex-1 overflow-auto rounded-xl"
          style={group.colorTag && colorMap[group.colorTag] ? { borderTop: `4px solid ${colorMap[group.colorTag]}` } : {}}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">#{group.animalNo}</span>
                <span className="text-sm text-muted-foreground">({group.filledCount}/7 dolu)</span>
              </div>
              {group.kesildi && group.kesildiAt && (
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatKesildiTime(group.kesildiAt)}
                </span>
              )}
            </div>

            {teams.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-muted-foreground font-medium">Ekip:</span>
                <div className="flex gap-1 flex-wrap">
                  <button
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      !group.teamId ? "bg-primary/10 border-primary font-semibold" : "bg-background border-border hover:bg-muted"
                    }`}
                    onClick={() => onTeamAssign(group.id, null)}
                  >
                    Yok
                  </button>
                  {teams.map(t => (
                    <button
                      key={t.id}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        group.teamId === t.id ? "font-semibold" : "hover:opacity-80"
                      }`}
                      style={{
                        backgroundColor: group.teamId === t.id ? t.color + "20" : undefined,
                        borderColor: group.teamId === t.id ? t.color : undefined,
                        color: t.color,
                      }}
                      onClick={() => onTeamAssign(group.id, t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-center p-2 font-semibold border-b w-10">HAYVAN</th>
                    <th className="text-center p-2 font-semibold border-b w-10">SIRA</th>
                    <th className="text-left p-2 font-semibold border-b">VEKALET</th>
                    <th className="text-left p-2 font-semibold border-b">VEKALETİ VEREN</th>
                    <th className="text-left p-2 font-semibold border-b">ADINA KESİLEN</th>
                    <th className="text-left p-2 font-semibold border-b">CİNSİ</th>
                    <th className="text-left p-2 font-semibold border-b">NOTLAR</th>
                    <th className="text-center p-2 font-semibold border-b w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className={`${row.empty ? "text-muted-foreground/30" : ""} ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                      {idx === 0 && (
                        <td rowSpan={7} className="p-2 border-b text-center font-bold text-lg align-middle border-r">{group.animalNo}</td>
                      )}
                      <td className="p-2 border-b text-center font-medium">{row.sira}</td>
                      <td className="p-2 border-b text-xs">{row.vekalet || "—"}</td>
                      <td className="p-2 border-b">{row.vekaletVeren || "—"}</td>
                      <td className="p-2 border-b">{row.adinaKesilen || "—"}</td>
                      <td className="p-2 border-b text-xs">{row.cinsi || "—"}</td>
                      <td className="p-2 border-b text-xs">{row.notlar || "—"}</td>
                      <td className="p-2 border-b text-center">
                        {!row.empty && (
                          <button
                            className="text-amber-500 hover:text-amber-700"
                            onClick={(e) => { e.stopPropagation(); setEditDonorIdx(editDonorIdx === idx ? null : idx); }}
                            title="Düzenleme talebi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden space-y-2">
              {rows.map((row, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-2.5 ${row.empty ? "bg-muted/20 opacity-40" : "bg-muted/40"}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-muted-foreground bg-background rounded-full w-5 h-5 flex items-center justify-center shrink-0">{row.sira}</span>
                    <div className="flex-1 min-w-0">
                      {row.empty ? (
                        <p className="text-xs text-muted-foreground">Boş</p>
                      ) : (
                        <>
                          <p className="font-medium text-sm truncate">{row.vekaletVeren}</p>
                          {row.adinaKesilen && row.adinaKesilen !== row.vekaletVeren && (
                            <p className="text-xs text-muted-foreground truncate">→ {row.adinaKesilen}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {row.vekalet && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{row.vekalet}</span>
                            )}
                            {row.cinsi && (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">{row.cinsi}</span>
                            )}
                          </div>
                          {row.notlar && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 italic truncate">{row.notlar}</p>
                          )}
                        </>
                      )}
                    </div>
                    {!row.empty && (
                      <button
                        className="text-amber-500 hover:text-amber-700 shrink-0 mt-0.5"
                        onClick={(e) => { e.stopPropagation(); setEditDonorIdx(editDonorIdx === idx ? null : idx); }}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {editDonorIdx !== null && rows[editDonorIdx]?.donor && (
              <div className="mt-3">
                <EditRequestForm
                  donor={rows[editDonorIdx].donor!}
                  donorIndex={editDonorIdx}
                  groupId={group.id}
                  token={token}
                  onNoteAdded={onNoteAdded}
                  onClose={() => setEditDonorIdx(null)}
                />
              </div>
            )}

            <div className="mt-3">
              <button
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-2"
                onClick={() => setShowNotes(!showNotes)}
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                Notlar {groupNoteCount > 0 && `(${groupNoteCount})`}
                {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showNotes && (
                <div className="space-y-2">
                  <NoteInput groupId={group.id} token={token} onNoteAdded={onNoteAdded} />
                  <NotesList notes={notes} groupId={group.id} />
                </div>
              )}
            </div>

            <div className="mt-3">
              <button
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-2"
                onClick={() => {
                  setShowPhotos(!showPhotos);
                  if (!showPhotos && photosLoadedFor.current !== group.id) {
                    setPhotosLoading(true);
                    fetchGroupPhotos(token, group.id)
                      .then(p => { setPhotos(p); photosLoadedFor.current = group.id; })
                      .catch(() => setPhotos([]))
                      .finally(() => setPhotosLoading(false));
                  }
                }}
              >
                <Camera className="w-3.5 h-3.5" />
                Fotoğraflar {photos.length > 0 && photosLoadedFor.current === group.id && `(${photos.length})`}
                {showPhotos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showPhotos && (
                <div className="mt-1">
                  {photosLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Yükleniyor...
                    </div>
                  ) : (
                    <PhotoGallery
                      photos={photos}
                      getPhotoUrl={(photoId) => getGroupPhotoUrl(token, group.id, photoId)}
                      onUpload={async (data, mimeType) => {
                        const photo = await uploadGroupPhoto(token, group.id, data, mimeType);
                        setPhotos(prev => [...prev, photo]);
                        return photo;
                      }}
                      onDelete={async (photoId) => {
                        await deleteGroupPhoto(token, group.id, photoId);
                        setPhotos(prev => prev.filter(p => p.id !== photoId));
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 p-4 bg-background border-t">
            <Button
              className={`w-full h-12 text-base font-semibold ${
                group.kesildi
                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
              onClick={() => onToggle(group)}
              disabled={isToggling}
            >
              {isToggling ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : group.kesildi ? (
                <Circle className="w-5 h-5 mr-2" />
              ) : (
                <CheckCircle2 className="w-5 h-5 mr-2" />
              )}
              {group.kesildi ? "İşareti Kaldır" : "Kesildi Olarak İşaretle"}
            </Button>
          </div>
        </Card>

        <div className="flex justify-center gap-1 mt-2 px-4 flex-wrap">
          {groups.map((_, idx) => (
            <button
              key={idx}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex ? "bg-white scale-125" : "bg-white/40"
              }`}
              onClick={() => { setCurrentIndex(idx); setEditDonorIdx(null); }}
            />
          ))}
        </div>

        <p className="text-white/60 text-[10px] text-center mt-1">Sola/sağa kaydırarak gezinin • Aşağı kaydırarak kapatın</p>
      </div>
    </div>
  );
}

export default function KesimTakipPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [overlayIndex, setOverlayIndex] = useState<number | null>(null);
  const [notes, setNotes] = useState<TrackingNote[]>([]);
  const [showGlobalNotes, setShowGlobalNotes] = useState(false);

  const loadData = useCallback(async () => {
    if (!params.token) return;
    try {
      const [result, trackingNotes] = await Promise.all([
        fetchTrackingData(params.token),
        fetchTrackingNotes(params.token),
      ]);
      setData(result);
      setNotes(trackingNotes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [params.token]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleNoteAdded = useCallback((note: TrackingNote) => {
    setNotes(prev => [note, ...prev]);
  }, []);

  async function handleTeamAssign(groupId: string, teamId: string | null) {
    if (!params.token) return;
    try {
      await assignTeamTracking(params.token, groupId, teamId);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          groups: prev.groups.map(g =>
            g.id === groupId ? { ...g, teamId } : g
          ),
        };
      });
    } catch {}
  }

  async function handleToggle(group: TrackingGroup) {
    if (!params.token || toggling.has(group.id)) return;
    setToggling(prev => new Set(prev).add(group.id));
    try {
      await toggleKesildi(params.token, group.id, !group.kesildi);
      const newKesildi = !group.kesildi;
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          kesildiCount: prev.kesildiCount + (group.kesildi ? -1 : 1),
          groups: prev.groups.map(g =>
            g.id === group.id ? { ...g, kesildi: newKesildi, kesildiAt: newKesildi ? new Date().toISOString() : null } : g
          ),
        };
      });
    } catch {
    } finally {
      setToggling(prev => {
        const next = new Set(prev);
        next.delete(group.id);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950 dark:to-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white dark:from-red-950 dark:to-background flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">Takip Linki Bulunamadı</h2>
          <p className="text-sm text-muted-foreground">{error || "Geçersiz veya süresi dolmuş link"}</p>
        </Card>
      </div>
    );
  }

  const progressPercent = data.totalGroups > 0 ? Math.round((data.kesildiCount / data.totalGroups) * 100) : 0;
  const filledGroups = data.groups.filter(g => g.filledCount > 0);
  const noteCountByGroup: Record<string, number> = {};
  for (const n of notes) {
    if (n.animalGroupId) {
      noteCountByGroup[n.animalGroupId] = (noteCountByGroup[n.animalGroupId] || 0) + 1;
    }
  }
  const editRequestCount = notes.filter(n => n.type === "edit_request" && n.status === "pending").length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950 dark:to-background">
      <div className="max-w-lg mx-auto p-4">
        <div className="text-center mb-6 pt-4">
          <Beef className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-foreground">{data.kesimAlaniName}</h1>
          {data.projectName && (
            <p className="text-sm text-muted-foreground">{data.projectName}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Kesim Takip Sayfası</p>
        </div>

        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Kesim Durumu</span>
            <span className="text-sm font-bold text-emerald-600">
              {data.kesildiCount} / {data.totalGroups}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(progressPercent, 1)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">%{progressPercent} tamamlandı</p>
        </Card>

        <Card className="p-3 mb-4">
          <button
            className="flex items-center justify-between w-full text-sm"
            onClick={() => setShowGlobalNotes(!showGlobalNotes)}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <StickyNote className="w-4 h-4 text-primary" />
              Genel Notlar
              {notes.length > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">{notes.length}</span>
              )}
              {editRequestCount > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">{editRequestCount} talep</span>
              )}
            </span>
            {showGlobalNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showGlobalNotes && (
            <div className="mt-3 space-y-2">
              <NoteInput token={params.token!} onNoteAdded={handleNoteAdded} />
              <NotesList notes={notes} />
            </div>
          )}
        </Card>

        <div className="space-y-2">
          {filledGroups.map((group, idx) => {
            const isToggling = toggling.has(group.id);
            const groupNotes = noteCountByGroup[group.id] || 0;
            return (
              <Card
                key={group.id}
                className={`p-3 cursor-pointer transition-all active:scale-[0.98] ${
                  group.kesildi
                    ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800"
                    : "hover:bg-muted/50"
                }`}
                style={group.colorTag && colorMap[group.colorTag] ? { borderLeft: `4px solid ${colorMap[group.colorTag]}` } : {}}
                onClick={() => setOverlayIndex(idx)}
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0" onClick={(e) => { e.stopPropagation(); handleToggle(group); }}>
                    {isToggling ? (
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    ) : group.kesildi ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Hayvan {group.animalNo}</span>
                      <span className="text-xs text-muted-foreground">({group.filledCount}/7 dolu)</span>
                      {groupNotes > 0 && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                          <MessageSquarePlus className="w-2.5 h-2.5" />
                          {groupNotes}
                        </span>
                      )}
                      {group.teamId && data.teams.find(t => t.id === group.teamId) && (() => {
                        const team = data.teams.find(t => t.id === group.teamId)!;
                        return (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ backgroundColor: team.color + "20", color: team.color }}
                          >
                            {team.name}
                          </span>
                        );
                      })()}
                      {group.kesildi && (
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                          Kesildi
                          {group.kesildiAt && (
                            <>
                              <Clock className="w-2.5 h-2.5" />
                              {formatKesildiTime(group.kesildiAt)}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {group.donors.slice(0, 3).map(d => d.description || d.name).join(", ")}
                      {group.donors.length > 3 && ` +${group.donors.length - 3}`}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {filledGroups.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Henüz hayvan grubu oluşturulmamış</p>
          </Card>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-6">
          Bir hayvan grubuna tıklayarak kesim kağıdı detayını görüntüleyin • Sayfa her 30 saniyede otomatik güncellenir
        </p>
      </div>

      {overlayIndex !== null && (
        <KesimKagidiOverlay
          groups={filledGroups}
          initialIndex={overlayIndex}
          toggling={toggling}
          notes={notes}
          token={params.token!}
          teams={data.teams || []}
          onToggle={handleToggle}
          onClose={() => setOverlayIndex(null)}
          onNoteAdded={handleNoteAdded}
          onTeamAssign={handleTeamAssign}
        />
      )}
    </div>
  );
}
