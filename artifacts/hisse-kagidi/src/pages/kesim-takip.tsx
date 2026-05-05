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
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown, ChevronUp,
  StickyNote, MessageSquarePlus,
  Sun, BarChart3,
} from "lucide-react";
import { NoteInput } from "@/components/kesim-takip/NoteInput";
import { NotesList } from "@/components/kesim-takip/NotesList";
import { GroupCard } from "@/components/kesim-takip/GroupCard";
import { SummaryReportOverlay } from "@/components/kesim-takip/SummaryReportOverlay";
import { KesimKagidiOverlay } from "@/components/kesim-takip/KesimKagidiOverlay";
import { SearchFilterBar } from "@/components/kesim-takip/SearchFilterBar";
import { ProgressCard } from "@/components/kesim-takip/ProgressCard";
import { StatusAlerts } from "@/components/kesim-takip/StatusAlerts";

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

  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem("hisse-kagidi-high-contrast") === "true";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
    localStorage.setItem("hisse-kagidi-high-contrast", String(highContrast));
    return () => { root.classList.remove("high-contrast"); };
  }, [highContrast]);

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

  const pendingGroups = useMemo(() => filteredGroups.filter(g => !g.kesildi), [filteredGroups]);

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

  const handleMarkNextPendingDone = useCallback(() => {
    if (pendingGroups.length === 0) return;
    handleToggle(pendingGroups[0]);
  }, [pendingGroups]);

  const handleOpenNextPendingNotes = useCallback(() => {
    if (pendingGroups.length === 0) return;
    const firstPending = pendingGroups[0];
    const idx = filteredGroups.findIndex(g => g.id === firstPending.id);
    if (idx >= 0) setOverlayIndex(idx);
  }, [pendingGroups, filteredGroups]);

  if (loading) {
    return <KesimTakipSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4" role="alert">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8 text-center max-w-sm w-full">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-stone-800 mb-2">Takip Linki Bulunamadı</h2>
          <p className="text-sm text-stone-500">{error || "Geçersiz veya süresi dolmuş link"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-stone-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-stone-800 truncate">{data.kesimAlaniName}</h1>
            {data.projectName && (
              <p className="text-[11px] text-stone-400 truncate">{data.projectName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-stone-400 hidden sm:block">Kesim Takip</span>
            <button
              onClick={() => setHighContrast(!highContrast)}
              className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border font-semibold transition-all min-h-[36px] ${
                highContrast
                  ? "bg-yellow-400 text-black border-yellow-400"
                  : "bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300"
              }`}
              aria-label={highContrast ? "Yüksek kontrast modunu kapat" : "Yüksek kontrast modunu aç"}
              aria-pressed={highContrast}
            >
              <Sun className="w-3.5 h-3.5" aria-hidden="true" />
              HC
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Progress */}
        <ProgressCard
          kesildiCount={data.kesildiCount}
          totalGroups={data.totalGroups}
          onShowReport={() => setShowSummaryReport(true)}
        />

        {/* Status alerts */}
        <StatusAlerts
          syncState={syncState}
          syncQueue={syncQueue}
          notifPermission={notifPermission}
          onRequestPermission={() => Notification.requestPermission().then(perm => setNotifPermission(perm))}
        />

        {/* Notes section */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 mb-3 overflow-hidden">
          <button
            className="flex items-center justify-between w-full px-4 py-3.5 min-h-[52px] text-left"
            onClick={() => setShowGlobalNotes(!showGlobalNotes)}
            aria-expanded={showGlobalNotes}
            aria-label={`Genel Notlar${notes.length > 0 ? ` (${notes.length} not)` : ""}`}
          >
            <span className="flex items-center gap-2 font-medium text-sm text-stone-700">
              <StickyNote className="w-4 h-4 text-stone-400" aria-hidden="true" />
              Genel Notlar
              {notes.length > 0 && (
                <span className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-semibold">
                  {notes.length}
                </span>
              )}
              {editRequestCount > 0 && (
                <span className="text-[11px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-semibold">
                  {editRequestCount} talep
                </span>
              )}
            </span>
            <span className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${showGlobalNotes ? "bg-stone-100" : ""}`}>
              {showGlobalNotes
                ? <ChevronUp className="w-4 h-4 text-stone-400" aria-hidden="true" />
                : <ChevronDown className="w-4 h-4 text-stone-400" aria-hidden="true" />
              }
            </span>
          </button>

          {showGlobalNotes && (
            <div className="px-4 pb-4 border-t border-stone-50 pt-3 space-y-3">
              <NoteInput token={params.token!} onNoteAdded={handleNoteAdded} createNote={handleCreateNote} />
              <NotesList notes={notes} />
            </div>
          )}
        </div>

        {/* Search & Filter */}
        {filledGroups.length > 0 && (
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterMode={filterMode}
            onFilterChange={setFilterMode}
            filteredCount={filteredGroups.length}
            totalCount={filledGroups.length}
          />
        )}

        {/* Group list */}
        {filteredGroups.length > 0 ? (
          <Virtuoso
            useWindowScroll
            data={filteredGroups}
            defaultItemHeight={76}
            overscan={300}
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
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-10 text-center">
            <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="w-6 h-6 text-stone-300" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-stone-500">Henüz hayvan grubu oluşturulmamış</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 text-center">
            <p className="text-sm text-stone-400">Aramanızla eşleşen hayvan grubu bulunamadı</p>
          </div>
        )}

        <p className="text-[10px] text-stone-400 text-center mt-6 mb-2">
          Bir hayvan grubuna tıklayarak kesim kağıdı detayını görüntüleyin · Sayfa her 30 saniyede güncellenir
        </p>
      </div>

      {/* Bottom action bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-stone-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        aria-label="Hızlı eylemler"
      >
        <div className="max-w-lg mx-auto flex items-center gap-2 px-4 py-3">
          {pendingGroups.length > 0 && (
            <span className="text-[11px] text-stone-400 shrink-0 hidden sm:block font-medium">
              #{pendingGroups[0].animalNo}
            </span>
          )}
          <Button
            className={`flex-1 h-12 min-h-[48px] text-sm font-semibold rounded-xl shadow-sm transition-all ${
              pendingGroups.length === 0
                ? "bg-stone-100 text-stone-400 shadow-none"
                : "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-200"
            }`}
            onClick={handleMarkNextPendingDone}
            disabled={pendingGroups.length === 0 || (pendingGroups.length > 0 && toggling.has(pendingGroups[0].id))}
            aria-label={pendingGroups.length > 0
              ? `Hayvan ${pendingGroups[0].animalNo} kesildi olarak işaretle`
              : "Tüm hayvanlar kesildi"}
          >
            <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" aria-hidden="true" />
            {pendingGroups.length > 0
              ? `Kesildi İşaretle (${pendingGroups.length})`
              : "Tümü Kesildi ✓"
            }
          </Button>
          <Button
            variant="outline"
            className="h-12 min-h-[48px] px-4 text-sm rounded-xl border-stone-200 text-stone-600 hover:bg-stone-50"
            onClick={handleOpenNextPendingNotes}
            disabled={pendingGroups.length === 0}
            aria-label={pendingGroups.length > 0
              ? `Hayvan ${pendingGroups[0].animalNo} için not ekle`
              : "Bekleyen hayvan yok"}
          >
            <MessageSquarePlus className="w-4 h-4 mr-1" aria-hidden="true" />
            Not
          </Button>
          <Button
            variant="ghost"
            className="h-12 min-h-[48px] px-4 text-sm rounded-xl text-stone-500 hover:bg-stone-50"
            onClick={() => setShowSummaryReport(true)}
            aria-label="Durum raporunu görüntüle"
          >
            Rapor
          </Button>
        </div>
      </nav>

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
