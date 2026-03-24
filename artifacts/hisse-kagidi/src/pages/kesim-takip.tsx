import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { fetchTrackingData, toggleKesildi } from "@/lib/api";
import type { TrackingData, TrackingGroup } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Loader2, AlertTriangle, Beef, Clock, X, ChevronLeft, ChevronRight } from "lucide-react";

const colorMap: Record<string, string> = {
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
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

function KesimKagidiOverlay({
  groups,
  initialIndex,
  toggling,
  onToggle,
  onClose,
}: {
  groups: TrackingGroup[];
  initialIndex: number;
  toggling: Set<string>;
  onToggle: (group: TrackingGroup) => void;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchDeltaX = useRef(0);
  const touchDeltaY = useRef(0);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const group = groups[currentIndex];
  if (!group) return null;

  const goNext = () => {
    if (currentIndex < groups.length - 1) setCurrentIndex(currentIndex + 1);
  };
  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
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
    });
  }

  const isToggling = toggling.has(group.id);

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
                  </div>
                </div>
              ))}
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
              onClick={() => setCurrentIndex(idx)}
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

  const loadData = useCallback(async () => {
    if (!params.token) return;
    try {
      const result = await fetchTrackingData(params.token);
      setData(result);
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

        <div className="space-y-2">
          {filledGroups.map((group, idx) => {
            const isToggling = toggling.has(group.id);
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
          onToggle={handleToggle}
          onClose={() => setOverlayIndex(null)}
        />
      )}
    </div>
  );
}
