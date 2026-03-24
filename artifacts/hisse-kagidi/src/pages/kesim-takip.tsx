import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { fetchTrackingData, toggleKesildi } from "@/lib/api";
import type { TrackingData, TrackingGroup } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2, AlertTriangle, Beef } from "lucide-react";

const colorMap: Record<string, string> = {
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
};

export default function KesimTakipPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

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
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          kesildiCount: prev.kesildiCount + (group.kesildi ? -1 : 1),
          groups: prev.groups.map(g =>
            g.id === group.id ? { ...g, kesildi: !g.kesildi } : g
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
          {filledGroups.map(group => {
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
                onClick={() => handleToggle(group)}
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
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
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-semibold">
                          Kesildi
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
          Hayvanın üzerine tıklayarak kesildi olarak işaretleyebilirsiniz • Sayfa her 30 saniyede otomatik güncellenir
        </p>
      </div>
    </div>
  );
}
