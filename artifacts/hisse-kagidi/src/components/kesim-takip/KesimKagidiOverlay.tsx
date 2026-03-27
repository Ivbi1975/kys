import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Circle, Loader2, Clock, X,
  ChevronLeft, ChevronRight, MessageSquarePlus,
  ChevronDown, ChevronUp, Camera,
} from "lucide-react";
import PhotoGallery from "@/components/PhotoGallery";
import { formatKesildiTime } from "@/lib/formatting";
import { COLOR_MAP } from "@/lib/constants";
import type { DonorFieldKey } from "@/lib/constants";
import { fetchGroupPhotos, getGroupPhotoUrl, uploadGroupPhoto, deleteGroupPhoto, createTrackingNote } from "@/lib/api";
import type { TrackingGroup, TrackingNote, GroupPhoto, TrackingTeam } from "@/lib/api";
import { NoteInput } from "./NoteInput";
import { EditRequestForm } from "./EditRequestForm";
import { NotesList } from "./NotesList";

export function KesimKagidiOverlay({
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
  createNote,
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
  createNote?: (data: Parameters<typeof createTrackingNote>[1]) => Promise<TrackingNote | null>;
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
  const [editField, setEditField] = useState<DonorFieldKey>("name");
  const [showPhotos, setShowPhotos] = useState(false);
  const [photos, setPhotos] = useState<GroupPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const photosLoadedFor = useRef<string | null>(null);
  const editFormRef = useRef<HTMLDivElement>(null);
  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    if (editDonorIdx !== null && editFormRef.current) {
      setTimeout(() => {
        editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  }, [editDonorIdx]);

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

  const rows: { sira: number; vekalet: string; vekaletVeren: string; adinaKesilen: string; cinsi: string; notlar: string; empty: boolean; donor: typeof group.donors[number] | undefined }[] = [];
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

  const handleCellDoubleClick = (donorIdx: number, field: DonorFieldKey) => {
    if (rows[donorIdx]?.empty) return;
    setEditDonorIdx(donorIdx);
    setEditField(field);
  };

  const isToggling = toggling.has(group.id);
  const groupNoteCount = notes.filter(n => n.animalGroupId === group.id).length;

  const cellHighlightClass = (donorIdx: number, field: DonorFieldKey) =>
    editDonorIdx === donorIdx && editField === field
      ? "bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-400 dark:border-amber-600 rounded"
      : "";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button
        className="absolute left-1 top-1/2 -translate-y-1/2 z-[60] bg-white/20 hover:bg-white/40 text-white rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-sm transition-colors disabled:opacity-30"
        onClick={goPrev}
        disabled={currentIndex === 0}
        aria-label="Önceki hayvan"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        className="absolute right-1 top-1/2 -translate-y-1/2 z-[60] bg-white/20 hover:bg-white/40 text-white rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-sm transition-colors disabled:opacity-30"
        onClick={goNext}
        disabled={currentIndex === groups.length - 1}
        aria-label="Sonraki hayvan"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      <div
        ref={containerRef}
        className="relative w-full max-w-2xl mx-12 max-h-[95vh] flex flex-col"
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
          <span className="text-white text-sm font-semibold">
            Hayvan {currentIndex + 1} / {groups.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/20 h-8 w-8 p-0">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <Card
          className="flex-1 overflow-auto rounded-xl"
          style={group.colorTag && COLOR_MAP[group.colorTag] ? { borderTop: `4px solid ${COLOR_MAP[group.colorTag]}` } : {}}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">#{group.animalNo}</span>
                <span className="text-sm text-muted-foreground">({group.filledCount}/7 dolu)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showNotes ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
                  onClick={() => setShowNotes(!showNotes)}
                  title="Notlar"
                  aria-label={`Notlar${groupNoteCount > 0 ? ` (${groupNoteCount})` : ""}`}
                  aria-pressed={showNotes}
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  {groupNoteCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{groupNoteCount}</span>
                  )}
                </button>
                <button
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showPhotos ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
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
                  title="Fotoğraflar"
                  aria-label={`Fotoğraflar${photos.length > 0 && photosLoadedFor.current === group.id ? ` (${photos.length})` : ""}`}
                  aria-pressed={showPhotos}
                >
                  <Camera className="w-4 h-4" />
                  {photos.length > 0 && photosLoadedFor.current === group.id && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{photos.length}</span>
                  )}
                </button>
                {group.kesildi && group.kesildiAt && (
                  <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatKesildiTime(group.kesildiAt)}
                  </span>
                )}
              </div>
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

            <div className="overflow-x-auto -mx-4 px-4">
              <table className="text-sm border-collapse" style={{ minWidth: "700px", width: "100%" }}>
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-center p-2 font-semibold border-b w-10">HAYVAN</th>
                    <th className="text-center p-2 font-semibold border-b w-10">SIRA</th>
                    <th className="text-left p-2 font-semibold border-b whitespace-nowrap">VEKALET</th>
                    <th className="text-left p-2 font-semibold border-b whitespace-nowrap">VEKALETİ VEREN</th>
                    <th className="text-left p-2 font-semibold border-b whitespace-nowrap">ADINA KESİLEN</th>
                    <th className="text-left p-2 font-semibold border-b whitespace-nowrap">CİNSİ</th>
                    <th className="text-left p-2 font-semibold border-b whitespace-nowrap">NOTLAR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className={`${row.empty ? "text-muted-foreground/30" : ""} ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                      {idx === 0 && (
                        <td rowSpan={7} className="p-2 border-b text-center font-bold text-lg align-middle border-r">{group.animalNo}</td>
                      )}
                      <td className="p-2 border-b text-center font-medium">{row.sira}</td>
                      <td
                        className={`p-2 border-b text-xs whitespace-nowrap cursor-pointer select-none ${cellHighlightClass(idx, "vekalet")}`}
                        onDoubleClick={() => handleCellDoubleClick(idx, "vekalet")}
                      >
                        {row.vekalet || "—"}
                      </td>
                      <td
                        className={`p-2 border-b whitespace-nowrap cursor-pointer select-none ${cellHighlightClass(idx, "description")}`}
                        onDoubleClick={() => handleCellDoubleClick(idx, "description")}
                      >
                        {row.vekaletVeren || "—"}
                      </td>
                      <td
                        className={`p-2 border-b whitespace-nowrap cursor-pointer select-none ${cellHighlightClass(idx, "name")}`}
                        onDoubleClick={() => handleCellDoubleClick(idx, "name")}
                      >
                        {row.adinaKesilen || "—"}
                      </td>
                      <td
                        className={`p-2 border-b text-xs whitespace-nowrap cursor-pointer select-none ${cellHighlightClass(idx, "donationType")}`}
                        onDoubleClick={() => handleCellDoubleClick(idx, "donationType")}
                      >
                        {row.cinsi || "—"}
                      </td>
                      <td
                        className={`p-2 border-b text-xs whitespace-nowrap cursor-pointer select-none ${cellHighlightClass(idx, "notes")}`}
                        onDoubleClick={() => handleCellDoubleClick(idx, "notes")}
                      >
                        {row.notlar || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[9px] text-muted-foreground mt-1 text-center">Düzenlemek istediğiniz alana çift tıklayın</p>
            </div>

            {editDonorIdx !== null && rows[editDonorIdx]?.donor && (
              <div className="mt-3" ref={editFormRef}>
                <EditRequestForm
                  key={`${editDonorIdx}-${editField}`}
                  donor={rows[editDonorIdx].donor!}
                  donorIndex={editDonorIdx}
                  groupId={group.id}
                  token={token}
                  onNoteAdded={onNoteAdded}
                  onClose={() => setEditDonorIdx(null)}
                  initialField={editField}
                />
              </div>
            )}

            {showNotes && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground">Notlar</span>
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowNotes(false)} aria-label="Notları kapat">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <NoteInput groupId={group.id} token={token} onNoteAdded={onNoteAdded} createNote={createNote} />
                <NotesList notes={notes} groupId={group.id} />
              </div>
            )}

            {showPhotos && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground">Fotoğraflar</span>
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowPhotos(false)} aria-label="Fotoğrafları kapat">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {photosLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Yükleniyor...
                  </div>
                ) : (
                  <PhotoGallery
                    photos={photos}
                    getPhotoUrl={(photoId, size) => getGroupPhotoUrl(token, group.id, photoId, size)}
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

        <div className="mt-2 px-2">
          <button
            className="w-full flex items-center justify-center gap-2 py-1.5 text-white/80 hover:text-white text-xs font-medium transition-colors"
            onClick={() => setShowGrid(!showGrid)}
          >
            {showGrid ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            {showGrid ? "Hayvanları Gizle" : `Tüm Hayvanları Göster (${groups.length})`}
          </button>

          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: showGrid ? "30vh" : "0" }}
          >
            <div className="overflow-auto max-h-[30vh] pt-1">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
                {groups.map((g, idx) => {
                  const rawNames = g.donors.slice(0, 7).map(d => d?.name || "");
                  const donorNames = [...rawNames, ...Array(Math.max(0, 7 - rawNames.length)).fill("")];
                  const filledSlots = donorNames.filter((n: string) => n).length;
                  const isKesildi = g.kesildi;
                  return (
                    <button
                      key={g.id}
                      className={`text-left rounded-lg p-1.5 transition-all text-[10px] leading-tight ${
                        idx === currentIndex
                          ? "bg-white text-gray-900 shadow-lg ring-2 ring-white/50"
                          : isKesildi
                            ? "bg-emerald-500/30 text-white/90 hover:bg-emerald-500/50 border border-emerald-400/40"
                            : "bg-white/10 text-white/80 hover:bg-white/20"
                      }`}
                      onClick={() => { setCurrentIndex(idx); setEditDonorIdx(null); }}
                      aria-label={`Hayvan #${g.animalNo}, ${filledSlots}/7 dolu${isKesildi ? ", kesildi" : ""}`}
                      aria-current={idx === currentIndex ? "true" : undefined}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-xs flex items-center gap-0.5">
                          {isKesildi && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          #{g.animalNo}
                        </span>
                        <span className={`text-[9px] ${idx === currentIndex ? "text-gray-500" : "text-white/50"}`}>
                          {filledSlots}/7
                        </span>
                      </div>
                      <div className="space-y-px">
                        {donorNames.map((name: string, i: number) => (
                          <div key={i} className={`truncate ${name ? "" : (idx === currentIndex ? "text-gray-300" : "text-white/30")}`}>
                            {name || "—"}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <p className="text-white/60 text-[10px] text-center mt-1">Sola/sağa kaydırarak gezinin • Aşağı kaydırarak kapatın</p>
      </div>
    </div>
  );
}
