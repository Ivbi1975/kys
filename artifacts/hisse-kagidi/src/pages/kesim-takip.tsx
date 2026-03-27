import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { turkishNormalize } from "@/lib/utils";
import { useParams } from "wouter";
import { NoteType, NoteStatus } from "@/lib/constants";
import { Virtuoso } from "react-virtuoso";
import { assignTeamTracking, fetchTrackingNotificationLogs } from "@/lib/api";
import { KesimTakipSkeleton } from "@/components/skeletons/KesimTakipSkeleton";
import { useMinLoadingTime } from "@/hooks/useMinLoadingTime";
import type { TrackingGroup, TrackingNote } from "@/lib/api";
import { useOfflineSync } from "@/lib/useOfflineSync";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, Beef, X,
  ChevronDown, ChevronUp, WifiOff, RefreshCw,
  FileText, StickyNote, Search,
} from "lucide-react";
import { NoteInput } from "@/components/kesim-takip/NoteInput";
import { NotesList } from "@/components/kesim-takip/NotesList";
import { GroupCard } from "@/components/kesim-takip/GroupCard";
import { SummaryReportOverlay } from "@/components/kesim-takip/SummaryReportOverlay";
import { KesimKagidiOverlay } from "@/components/kesim-takip/KesimKagidiOverlay";

type FilterMode = "all" | "pending" | "done";

export default function KesimTakipPage() {
  const params = useParams<{ token: string }>();
  const {
    data,
    setData,
    notes,
    setNotes,
    loading: rawLoading,
    error,
    syncState,
    handleToggle: offlineToggle,
    handleCreateNote,
    syncQueue,
  } = useOfflineSync(params.token);

  const loading = useMinLoadingTime(rawLoading);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [overlayIndex, setOverlayIndex] = useState<number | null>(null);
  const [showGlobalNotes, setShowGlobalNotes] = useState(false);
  const [showSummaryReport, setShowSummaryReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const lastNotifCheckRef = useRef<string>(new Date().toISOString());
  const seenNotifIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then(perm => setNotifPermission(perm));
    }
  }, []);

  useEffect(() => {
    if (!params.token) return;
    const pollNotifications = async () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      if (!navigator.onLine) return;
      try {
        const logs = await fetchTrackingNotificationLogs(params.token!, lastNotifCheckRef.current);
        for (const log of logs) {
          if (!seenNotifIdsRef.current.has(log.id)) {
            seenNotifIdsRef.current.add(log.id);
            try {
              new Notification(`Hayvan ${log.animalNo || "?"} Kesildi`, {
                body: log.message,
              });
            } catch {}
          }
        }
        if (logs.length > 0) {
          lastNotifCheckRef.current = new Date().toISOString();
        }
      } catch {}
    };
    const interval = setInterval(pollNotifications, 30000);
    return () => clearInterval(interval);
  }, [params.token]);

  const handleNoteAdded = useCallback((note: TrackingNote) => {
    setNotes(prev => [note, ...prev]);
  }, [setNotes]);

  const filledGroups = useMemo(() => data ? data.groups.filter(g => g.filledCount > 0) : [], [data]);
  const noteCountByGroup = useMemo(() => {
    const map: Record<string, number> = {};
    for (const n of notes) {
      if (n.animalGroupId) {
        map[n.animalGroupId] = (map[n.animalGroupId] || 0) + 1;
      }
    }
    return map;
  }, [notes]);
  const editRequestCount = useMemo(() => notes.filter(n => n.type === NoteType.EDIT_REQUEST && n.status === NoteStatus.PENDING).length, [notes]);

  const filteredGroups = useMemo(() => {
    let groups = filledGroups;
    if (filterMode === "pending") {
      groups = groups.filter(g => !g.kesildi);
    } else if (filterMode === "done") {
      groups = groups.filter(g => g.kesildi);
    }
    if (searchQuery.trim()) {
      const q = turkishNormalize(searchQuery.trim());
      groups = groups.filter(g =>
        String(g.animalNo).includes(q) ||
        g.donors.some(d =>
          turkishNormalize(d.name).includes(q) ||
          turkishNormalize(d.description).includes(q) ||
          turkishNormalize(d.donationType).includes(q) ||
          turkishNormalize(d.vekalet).includes(q)
        )
      );
    }
    return groups;
  }, [filledGroups, filterMode, searchQuery]);

  const handleSelectGroup = useCallback((idx: number) => {
    setOverlayIndex(idx);
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
      await offlineToggle(group.id, !group.kesildi);
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
    return <KesimTakipSkeleton />;
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
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">%{progressPercent} tamamlandı</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowSummaryReport(true)}>
              <FileText className="w-3.5 h-3.5 mr-1" /> Durum Raporu
            </Button>
          </div>
        </Card>

        {!syncState.isOnline && (
          <Card className="p-3 mb-4 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="flex-1">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Çevrimdışı — değişiklikler kaydedilecek
                </span>
                {syncState.pendingCount > 0 && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 block">
                    {syncState.pendingCount} bekleyen değişiklik
                  </span>
                )}
              </div>
            </div>
          </Card>
        )}

        {syncState.isOnline && syncState.pendingCount > 0 && (
          <Card className="p-3 mb-4 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 text-blue-600 shrink-0 ${syncState.isSyncing ? "animate-spin" : ""}`} />
                <span className="text-xs text-blue-700 dark:text-blue-300">
                  {syncState.isSyncing
                    ? "Senkronize ediliyor..."
                    : `${syncState.pendingCount} bekleyen değişiklik`}
                </span>
              </div>
              {!syncState.isSyncing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                  onClick={() => syncQueue()}
                >
                  Şimdi Gönder
                </Button>
              )}
            </div>
            {syncState.lastSyncError && (
              <p className="text-[10px] text-red-600 mt-1">{syncState.lastSyncError}</p>
            )}
          </Card>
        )}

        {typeof Notification !== "undefined" && notifPermission === "default" && (
          <Card className="p-3 mb-4 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-blue-700 dark:text-blue-300">Kesim bildirimlerini almak ister misiniz?</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                onClick={() => Notification.requestPermission().then(perm => setNotifPermission(perm))}
              >
                Bildirimleri Aç
              </Button>
            </div>
          </Card>
        )}

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
              <NoteInput token={params.token!} onNoteAdded={handleNoteAdded} createNote={handleCreateNote} />
              <NotesList notes={notes} />
            </div>
          )}
        </Card>

        {filledGroups.length > 0 && (
          <div className="mb-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hayvan no, isim, vekalet ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {searchQuery && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearchQuery("")}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {([["all", "Tümü"], ["pending", "Bekleyen"], ["done", "Kesildi"]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    filterMode === mode
                      ? "bg-primary text-primary-foreground border-primary font-semibold"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                  onClick={() => setFilterMode(mode)}
                >
                  {label}
                </button>
              ))}
              {(searchQuery || filterMode !== "all") && (
                <span className="text-xs text-muted-foreground self-center ml-auto">
                  {filteredGroups.length} / {filledGroups.length}
                </span>
              )}
            </div>
          </div>
        )}

        {filteredGroups.length > 0 ? (
          <Virtuoso
            useWindowScroll
            data={filteredGroups}
            defaultItemHeight={68}
            overscan={200}
            itemContent={(idx, group) => (
              <GroupCard
                group={group}
                index={idx}
                isToggling={toggling.has(group.id)}
                noteCount={noteCountByGroup[group.id] || 0}
                teams={data.teams}
                onToggle={handleToggle}
                onSelect={handleSelectGroup}
              />
            )}
          />
        ) : filledGroups.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Henüz hayvan grubu oluşturulmamış</p>
          </Card>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground text-sm">Aramanızla eşleşen hayvan grubu bulunamadı</p>
          </Card>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-6">
          Bir hayvan grubuna tıklayarak kesim kağıdı detayını görüntüleyin • Sayfa her 30 saniyede otomatik güncellenir
        </p>
      </div>

      {overlayIndex !== null && (
        <KesimKagidiOverlay
          groups={filteredGroups}
          initialIndex={overlayIndex}
          toggling={toggling}
          notes={notes}
          token={params.token!}
          teams={data.teams || []}
          onToggle={handleToggle}
          onClose={() => setOverlayIndex(null)}
          onNoteAdded={handleNoteAdded}
          onTeamAssign={handleTeamAssign}
          createNote={handleCreateNote}
        />
      )}

      {showSummaryReport && (
        <SummaryReportOverlay
          data={data}
          notes={notes}
          onClose={() => setShowSummaryReport(false)}
        />
      )}
    </div>
  );
}
