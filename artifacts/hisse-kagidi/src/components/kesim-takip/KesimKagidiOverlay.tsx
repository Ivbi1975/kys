import { useState, useEffect, useRef } from "react";
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

  const rows: {
    sira: number; vekalet: string; vekaletVeren: string; adinaKesilen: string;
    cinsi: string; notlar: string; empty: boolean; donor: typeof group.donors[number] | undefined
  }[] = [];
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
  const colorBorder = group.colorTag && COLOR_MAP[group.colorTag] ? COLOR_MAP[group.colorTag] : null;

  const cellHighlightClass = (donorIdx: number, field: DonorFieldKey) =>
    editDonorIdx === donorIdx && editField === field
      ? "bg-amber-50 border-b-2 border-amber-400"
      : "";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Prev/Next arrows */}
      <button
        className="absolute left-2 top-1/2 -translate-y-1/2 z-[60] bg-white/15 hover:bg-white/30 text-white rounded-2xl w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center backdrop-blur-sm transition-all disabled:opacity-20"
        onClick={goPrev}
        disabled={currentIndex === 0}
        aria-label="Önceki hayvan"
      >
        <ChevronLeft className="w-6 h-6" aria-hidden="true" />
      </button>
      <button
        className="absolute right-2 top-1/2 -translate-y-1/2 z-[60] bg-white/15 hover:bg-white/30 text-white rounded-2xl w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center backdrop-blur-sm transition-all disabled:opacity-20"
        onClick={goNext}
        disabled={currentIndex === groups.length - 1}
        aria-label="Sonraki hayvan"
      >
        <ChevronRight className="w-6 h-6" aria-hidden="true" />
      </button>

      <div
        ref={containerRef}
        className="relative w-full max-w-2xl mx-14 max-h-[95vh] flex flex-col"
        style={{ transform: `translateX(${swipeOffset}px)`, transition: isDragging.current ? "none" : "transform 0.2s ease-out" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onMouseLeave={() => { if (isDragging.current) handleTouchEnd(); }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-white/80 text-sm font-medium">
            {currentIndex + 1} / {groups.length}
          </span>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/20 rounded-xl w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center transition-all"
            aria-label="Kesim kağıdını kapat"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Main card */}
        <div
          className="bg-white rounded-2xl flex-1 overflow-auto shadow-2xl"
          style={colorBorder ? { borderTop: `4px solid ${colorBorder}` } : {}}
        >
          <div className="p-5">
            {/* Header row */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl font-bold text-stone-800">#{group.animalNo}</span>
                  <span className="text-sm text-stone-400 bg-stone-100 px-2 py-0.5 rounded-lg font-medium">
                    {group.filledCount}/7 dolu
                  </span>
                </div>
                {group.kesildi && group.kesildiAt && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-xs bg-teal-100 text-teal-700 px-2.5 py-1 rounded-full font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Kesildi
                    <Clock className="w-3 h-3 ml-0.5" aria-hidden="true" />
                    {formatKesildiTime(group.kesildiAt)}
                  </span>
                )}
                {group.kesildi && !group.kesildiAt && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-xs bg-teal-100 text-teal-700 px-2.5 py-1 rounded-full font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Kesildi
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all ${
                    showNotes
                      ? "bg-stone-800 text-white"
                      : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                  }`}
                  onClick={() => setShowNotes(!showNotes)}
                  aria-label={`Notlar${groupNoteCount > 0 ? ` (${groupNoteCount})` : ""}`}
                  aria-pressed={showNotes}
                >
                  <MessageSquarePlus className="w-5 h-5" aria-hidden="true" />
                  {groupNoteCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                      {groupNoteCount}
                    </span>
                  )}
                </button>
                <button
                  className={`relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all ${
                    showPhotos
                      ? "bg-stone-800 text-white"
                      : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                  }`}
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
                  aria-label={`Fotoğraflar${photos.length > 0 && photosLoadedFor.current === group.id ? ` (${photos.length})` : ""}`}
                  aria-pressed={showPhotos}
                >
                  <Camera className="w-5 h-5" aria-hidden="true" />
                  {photos.length > 0 && photosLoadedFor.current === group.id && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                      {photos.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Team selector */}
            {teams.length > 0 && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs text-stone-400 font-medium shrink-0">Ekip:</span>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    className={`text-xs px-3 py-1.5 min-h-[36px] rounded-full border font-medium transition-all ${
                      !group.teamId
                        ? "bg-stone-800 border-stone-800 text-white"
                        : "bg-white border-stone-200 text-stone-500 hover:border-stone-300"
                    }`}
                    onClick={() => onTeamAssign(group.id, null)}
                    aria-label="Ekip atamasını kaldır"
                    aria-pressed={!group.teamId}
                  >
                    Yok
                  </button>
                  {teams.map(t => (
                    <button
                      key={t.id}
                      className={`text-xs px-3 py-1.5 min-h-[36px] rounded-full border font-medium transition-all ${
                        group.teamId === t.id ? "font-semibold" : "hover:opacity-80 bg-white border-stone-200"
                      }`}
                      style={{
                        backgroundColor: group.teamId === t.id ? t.color + "20" : undefined,
                        borderColor: group.teamId === t.id ? t.color : undefined,
                        color: t.color,
                      }}
                      onClick={() => onTeamAssign(group.id, t.id)}
                      aria-label={`${t.name} ekibine ata`}
                      aria-pressed={group.teamId === t.id}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Donors table */}
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="text-sm border-collapse rounded-xl overflow-hidden" style={{ minWidth: "700px", width: "100%" }}>
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    <th className="text-center p-2.5 font-semibold text-stone-500 text-xs w-12">HAYVAN</th>
                    <th className="text-center p-2.5 font-semibold text-stone-500 text-xs w-10">SIRA</th>
                    <th className="text-left p-2.5 font-semibold text-stone-500 text-xs whitespace-nowrap">VEKALET</th>
                    <th className="text-left p-2.5 font-semibold text-stone-500 text-xs whitespace-nowrap">VEKALETİ VEREN</th>
                    <th className="text-left p-2.5 font-semibold text-stone-500 text-xs whitespace-nowrap">ADINA KESİLEN</th>
                    <th className="text-left p-2.5 font-semibold text-stone-500 text-xs whitespace-nowrap">CİNSİ</th>
                    <th className="text-left p-2.5 font-semibold text-stone-500 text-xs whitespace-nowrap">NOTLAR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`${row.empty ? "opacity-30" : ""} ${idx % 2 === 0 ? "bg-white" : "bg-stone-50/50"}`}
                    >
                      {idx === 0 && (
                        <td rowSpan={7} className="p-2.5 text-center font-bold text-xl text-stone-700 align-middle border-r border-stone-100">
                          {group.animalNo}
                        </td>
                      )}
                      <td className="p-2.5 text-center font-semibold text-stone-500 text-xs">{row.sira}</td>
                      <td
                        className={`p-2.5 text-xs whitespace-nowrap cursor-pointer select-none text-stone-600 ${cellHighlightClass(idx, "vekalet")}`}
                        onDoubleClick={() => handleCellDoubleClick(idx, "vekalet")}
                      >
                        {row.vekalet || <span className="text-stone-300">—</span>}
                      </td>
                      <td
                        className={`p-2.5 whitespace-nowrap cursor-pointer select-none text-stone-700 ${cellHighlightClass(idx, "description")}`}
                        onDoubleClick={() => handleCellDoubleClick(idx, "description")}
                      >
                        {row.vekaletVeren || <span className="text-stone-300">—</span>}
                      </td>
                      <td
                        className={`p-2.5 whitespace-nowrap cursor-pointer select-none text-stone-700 font-medium ${cellHighlightClass(idx, "name")}`}
                        onDoubleClick={() => handleCellDoubleClick(idx, "name")}
                      >
                        {row.adinaKesilen || <span className="text-stone-300 font-normal">—</span>}
                      </td>
                      <td
                        className={`p-2.5 text-xs whitespace-nowrap cursor-pointer select-none text-stone-500 ${cellHighlightClass(idx, "donationType")}`}
                        onDoubleClick={() => handleCellDoubleClick(idx, "donationType")}
                      >
                        {row.cinsi || <span className="text-stone-300">—</span>}
                      </td>
                      <td
                        className={`p-2.5 text-xs whitespace-nowrap cursor-pointer select-none text-stone-500 ${cellHighlightClass(idx, "notes")}`}
                        onDoubleClick={() => handleCellDoubleClick(idx, "notes")}
                      >
                        {row.notlar || <span className="text-stone-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-stone-400 mt-2 text-center">
                Düzenlemek istediğiniz alana çift tıklayın
              </p>
            </div>

            {/* Edit request form */}
            {editDonorIdx !== null && rows[editDonorIdx]?.donor && (
              <div className="mt-4" ref={editFormRef}>
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

            {/* Notes panel */}
            {showNotes && (
              <div className="mt-4 space-y-3 bg-stone-50 rounded-xl p-4 border border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-600">Notlar</span>
                  <button
                    className="text-stone-400 hover:text-stone-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-200 transition-colors"
                    onClick={() => setShowNotes(false)}
                    aria-label="Notları kapat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <NoteInput groupId={group.id} token={token} onNoteAdded={onNoteAdded} createNote={createNote} />
                <NotesList notes={notes} groupId={group.id} />
              </div>
            )}

            {/* Photos panel */}
            {showPhotos && (
              <div className="mt-4 bg-stone-50 rounded-xl p-4 border border-stone-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-stone-600">Fotoğraflar</span>
                  <button
                    className="text-stone-400 hover:text-stone-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-200 transition-colors"
                    onClick={() => setShowPhotos(false)}
                    aria-label="Fotoğrafları kapat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {photosLoading ? (
                  <div className="flex items-center gap-2 text-xs text-stone-400 py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
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

          {/* Toggle button (sticky bottom) */}
          <div className="sticky bottom-0 p-4 bg-white border-t border-stone-100">
            <Button
              className={`w-full h-13 min-h-[52px] text-base font-semibold rounded-xl transition-all shadow-sm ${
                group.kesildi
                  ? "bg-stone-100 hover:bg-stone-200 text-stone-700 shadow-none"
                  : "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-200"
              }`}
              onClick={() => onToggle(group)}
              disabled={isToggling}
              aria-label={group.kesildi
                ? `Hayvan ${group.animalNo} kesim işaretini kaldır`
                : `Hayvan ${group.animalNo} kesildi olarak işaretle`}
            >
              {isToggling ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />
              ) : group.kesildi ? (
                <Circle className="w-5 h-5 mr-2" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-5 h-5 mr-2" aria-hidden="true" />
              )}
              {group.kesildi ? "İşareti Kaldır" : "Kesildi Olarak İşaretle"}
            </Button>
          </div>
        </div>

        {/* Grid toggle */}
        <div className="mt-2 px-1">
          <button
            className="w-full flex items-center justify-center gap-2 py-2.5 min-h-[44px] text-white/70 hover:text-white text-xs font-medium transition-colors"
            onClick={() => setShowGrid(!showGrid)}
            aria-expanded={showGrid}
            aria-label={showGrid ? "Hayvan listesini gizle" : `Tüm ${groups.length} hayvanı göster`}
          >
            {showGrid
              ? <ChevronDown className="w-4 h-4" aria-hidden="true" />
              : <ChevronUp className="w-4 h-4" aria-hidden="true" />
            }
            {showGrid ? "Gizle" : `Tüm Hayvanlar (${groups.length})`}
          </button>

          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: showGrid ? "30vh" : "0" }}
          >
            <div className="overflow-auto max-h-[30vh] pt-1">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {groups.map((g, idx) => {
                  const rawNames = g.donors.slice(0, 7).map(d => d?.name || "");
                  const donorNames = [...rawNames, ...Array(Math.max(0, 7 - rawNames.length)).fill("")];
                  const filledSlots = donorNames.filter((n: string) => n).length;
                  const isKesildi = g.kesildi;
                  return (
                    <button
                      key={g.id}
                      className={`text-left rounded-xl p-2 transition-all text-[10px] leading-tight ${
                        idx === currentIndex
                          ? "bg-white text-stone-800 shadow-lg ring-2 ring-white/50"
                          : isKesildi
                            ? "bg-teal-500/30 text-white/90 hover:bg-teal-500/50 border border-teal-400/30"
                            : "bg-white/10 text-white/80 hover:bg-white/20"
                      }`}
                      onClick={() => { setCurrentIndex(idx); setEditDonorIdx(null); }}
                      aria-label={`Hayvan #${g.animalNo}, ${filledSlots}/7 dolu${isKesildi ? ", kesildi" : ""}`}
                      aria-current={idx === currentIndex ? "true" : undefined}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs flex items-center gap-0.5">
                          {isKesildi && <CheckCircle2 className="w-3 h-3 text-teal-400" aria-hidden="true" />}
                          #{g.animalNo}
                        </span>
                        <span className={`text-[9px] ${idx === currentIndex ? "text-stone-400" : "text-white/50"}`}>
                          {filledSlots}/7
                        </span>
                      </div>
                      <div className="space-y-px">
                        {donorNames.map((name: string, i: number) => (
                          <div key={i} className={`truncate ${name ? "" : (idx === currentIndex ? "text-stone-300" : "text-white/30")}`}>
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

        <p className="text-white/40 text-[10px] text-center mt-1.5">
          Sola/sağa kaydırarak gezinin · Aşağı kaydırarak kapatın
        </p>
      </div>
    </div>
  );
}
