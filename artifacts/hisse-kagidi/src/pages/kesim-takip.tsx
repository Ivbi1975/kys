import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { turkishNormalize } from "@/lib/utils";
import { useParams } from "wouter";
import { NoteType, NoteStatus } from "@/lib/constants";
import { assignTeamTracking, fetchTrackingNotificationLogs } from "@/lib/api";
import { KesimTakipSkeleton } from "@/components/skeletons/KesimTakipSkeleton";
import { useMinLoadingTime } from "@/hooks/useMinLoadingTime";
import type { TrackingGroup, TrackingNote } from "@/lib/api";
import { useOfflineSync } from "@/lib/useOfflineSync";
import { AlertTriangle, WifiOff, RefreshCw, Bell, CheckCircle2, X } from "lucide-react";
import { KesimKagidiOverlay } from "@/components/kesim-takip/KesimKagidiOverlay";
import { SummaryReportOverlay } from "@/components/kesim-takip/SummaryReportOverlay";
import { DashboardSidebar } from "@/components/kesim-takip/dashboard/DashboardSidebar";
import { DashboardTopbar } from "@/components/kesim-takip/dashboard/DashboardTopbar";
import { KpiCards } from "@/components/kesim-takip/dashboard/KpiCards";
import { AnimalTable } from "@/components/kesim-takip/dashboard/AnimalTable";
import { RightPanel } from "@/components/kesim-takip/dashboard/RightPanel";
import { DashboardToolbar } from "@/components/kesim-takip/dashboard/DashboardToolbar";

type FilterMode = "all" | "pending" | "done";

export default function KesimTakipPage() {
  const params = useParams<{ token: string }>();
  const {
    data, setData, notes, setNotes, loading: rawLoading, error,
    syncState, handleToggle: offlineToggle, handleCreateNote, syncQueue,
  } = useOfflineSync(params.token);

  const loading = useMinLoadingTime(rawLoading);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [overlayIndex, setOverlayIndex] = useState<number | null>(null);
  const [showSummaryReport, setShowSummaryReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNavAction, setActiveNavAction] = useState<"list" | "report" | "notes">("list");
  const [forceNotesOpen, setForceNotesOpen] = useState(0);

  const handleNavAction = useCallback((action: "list" | "report" | "notes") => {
    setActiveNavAction(action);
    if (action === "report") {
      setShowSummaryReport(true);
      setActiveNavAction("list");
    } else if (action === "notes") {
      setForceNotesOpen(n => n + 1);
    }
  }, []);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const lastNotifCheckRef = useRef<string>(new Date().toISOString());
  const seenNotifIdsRef = useRef<Set<string>>(new Set());

  const [highContrast, setHighContrast] = useState(() =>
    localStorage.getItem("hisse-kagidi-high-contrast") === "true"
  );

  useEffect(() => {
    const root = document.documentElement;
    highContrast ? root.classList.add("high-contrast") : root.classList.remove("high-contrast");
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
    const poll = async () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      if (!navigator.onLine) return;
      try {
        const logs = await fetchTrackingNotificationLogs(params.token!, lastNotifCheckRef.current);
        for (const log of logs) {
          if (!seenNotifIdsRef.current.has(log.id)) {
            seenNotifIdsRef.current.add(log.id);
            try { new Notification(`Hayvan ${log.animalNo || "?"} Kesildi`, { body: log.message }); } catch {}
          }
        }
        if (logs.length > 0) lastNotifCheckRef.current = new Date().toISOString();
      } catch {}
    };
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [params.token]);

  const handleNoteAdded = useCallback((note: TrackingNote) => {
    setNotes(prev => [note, ...prev]);
  }, [setNotes]);

  const filledGroups = useMemo(() =>
    data ? data.groups.filter(g => g.filledCount > 0) : [], [data]
  );

  const noteCountByGroup = useMemo(() => {
    const map: Record<string, number> = {};
    for (const n of notes) {
      if (n.animalGroupId) map[n.animalGroupId] = (map[n.animalGroupId] || 0) + 1;
    }
    return map;
  }, [notes]);

  const filteredGroups = useMemo(() => {
    let groups = filledGroups;
    if (filterMode === "pending") groups = groups.filter(g => !g.kesildi);
    else if (filterMode === "done") groups = groups.filter(g => g.kesildi);
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

  const handleSelectGroup = useCallback((idx: number) => setOverlayIndex(idx), []);

  async function handleTeamAssign(groupId: string, teamId: string | null) {
    if (!params.token) return;
    try {
      await assignTeamTracking(params.token, groupId, teamId);
      setData(prev => prev ? { ...prev, groups: prev.groups.map(g => g.id === groupId ? { ...g, teamId } : g) } : prev);
    } catch {}
  }

  async function handleToggle(group: TrackingGroup) {
    if (!params.token || toggling.has(group.id)) return;
    setToggling(prev => new Set(prev).add(group.id));
    try { await offlineToggle(group.id, !group.kesildi); }
    catch {}
    finally {
      setToggling(prev => { const n = new Set(prev); n.delete(group.id); return n; });
    }
  }

  const handleMarkNextPendingDone = useCallback(() => {
    if (pendingGroups.length === 0) return;
    handleToggle(pendingGroups[0]);
  }, [pendingGroups]);

  const handleOpenNextPendingNotes = useCallback(() => {
    if (pendingGroups.length === 0) return;
    const idx = filteredGroups.findIndex(g => g.id === pendingGroups[0].id);
    if (idx >= 0) setOverlayIndex(idx);
  }, [pendingGroups, filteredGroups]);

  if (loading) return <KesimTakipSkeleton />;

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#06111f" }} role="alert">
        <div
          className="rounded-2xl p-10 text-center max-w-sm w-full border"
          style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(239,68,68,0.14)" }}
          >
            <AlertTriangle className="w-7 h-7" style={{ color: "#ef4444" }} aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold mb-2" style={{ color: "#f8fafc" }}>Takip Linki Bulunamadı</h2>
          <p className="text-sm" style={{ color: "#94a3b8" }}>{error || "Geçersiz veya süresi dolmuş link"}</p>
        </div>
      </div>
    );
  }

  const emptyState = filledGroups.length === 0 ? "no-data" : "no-match";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#06111f", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeAction={activeNavAction}
        onNav={handleNavAction}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <DashboardTopbar
          kesimAlaniName={data.kesimAlaniName}
          projectName={data.projectName}
          highContrast={highContrast}
          onToggleHighContrast={() => setHighContrast(h => !h)}
          onShowReport={() => setShowSummaryReport(true)}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
        />

        {/* Status banners */}
        <StatusBanners
          syncState={syncState}
          syncQueue={syncQueue}
          notifPermission={notifPermission}
          onRequestPermission={() => Notification.requestPermission().then(p => setNotifPermission(p))}
        />

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          {/* KPI cards */}
          <KpiCards
            total={data.totalGroups}
            done={data.kesildiCount}
            pending={data.totalGroups - data.kesildiCount}
          />

          {/* Content grid */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
            {/* Left: toolbar + table */}
            <div className="min-w-0">
              {filledGroups.length > 0 && (
                <DashboardToolbar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  filterMode={filterMode}
                  onFilterChange={setFilterMode}
                  filteredCount={filteredGroups.length}
                  totalCount={filledGroups.length}
                />
              )}

              <AnimalTable
                groups={filteredGroups}
                toggling={toggling}
                noteCountByGroup={noteCountByGroup}
                teams={data.teams || []}
                onToggle={handleToggle}
                onSelect={handleSelectGroup}
                emptyState={emptyState}
                onClearFilter={() => { setSearchQuery(""); setFilterMode("all"); }}
              />

              <p className="text-[10px] text-center mt-4" style={{ color: "#94a3b8" }}>
                Bir hayvan satırına tıklayarak kesim kağıdı detayını görüntüleyin · Sayfa her 30 saniyede güncellenir
              </p>
            </div>

            {/* Right panel */}
            <div className="min-w-0">
              <RightPanel
                groups={data.groups}
                notes={notes}
                kesildiCount={data.kesildiCount}
                totalGroups={data.totalGroups}
                token={params.token!}
                onNoteAdded={handleNoteAdded}
                onMarkNextPending={handleMarkNextPendingDone}
                onOpenNextNotes={handleOpenNextPendingNotes}
                onShowReport={() => setShowSummaryReport(true)}
                pendingCount={pendingGroups.length}
                forceNotesOpen={forceNotesOpen > 0 ? forceNotesOpen : undefined}
                createNote={handleCreateNote as any}
              />
            </div>
          </div>
        </main>

        {/* Mobile floating action bar (only mobile) */}
        {pendingGroups.length > 0 && (
          <div
            className="xl:hidden shrink-0 flex items-center gap-2 px-4 py-3 border-t"
            style={{ background: "#06111f", borderColor: "rgba(148,163,184,0.10)" }}
          >
            <button
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all"
              style={{ background: "#00c986", color: "#02130d" }}
              onClick={handleMarkNextPendingDone}
              disabled={toggling.has(pendingGroups[0]?.id)}
              aria-label={`Hayvan ${pendingGroups[0]?.animalNo} kesildi işaretle`}
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              Kesildi İşaretle ({pendingGroups.length})
            </button>
          </div>
        )}
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

function StatusBanners({
  syncState, syncQueue, notifPermission, onRequestPermission,
}: {
  syncState: { isOnline: boolean; isSyncing: boolean; pendingCount: number; lastSyncError?: string | null };
  syncQueue: () => void;
  notifPermission: NotificationPermission;
  onRequestPermission: () => void;
}) {
  const [notifDismissed, setNotifDismissed] = useState(false);

  if (!syncState.isOnline && syncState.pendingCount === 0 && notifPermission !== "default") return null;

  return (
    <div className="shrink-0 px-5 pt-2 space-y-1.5">
      {!syncState.isOnline && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs border"
          style={{ background: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.20)", color: "#fbbf24" }}
          role="alert"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1 font-medium">Çevrimdışı — değişiklikler bağlantı gelince gönderilecek</span>
          {syncState.pendingCount > 0 && (
            <span style={{ color: "#f59e0b" }}>({syncState.pendingCount} bekliyor)</span>
          )}
        </div>
      )}
      {syncState.isOnline && syncState.pendingCount > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs border"
          style={{ background: "rgba(59,130,246,0.10)", borderColor: "rgba(59,130,246,0.20)", color: "#60a5fa" }}
        >
          <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${syncState.isSyncing ? "animate-spin" : ""}`} aria-hidden="true" />
          <span className="flex-1">
            {syncState.isSyncing ? "Senkronize ediliyor..." : `${syncState.pendingCount} bekleyen değişiklik`}
          </span>
          {!syncState.isSyncing && (
            <button className="font-semibold hover:opacity-80 transition-opacity" onClick={syncQueue}>Gönder</button>
          )}
        </div>
      )}
      {typeof Notification !== "undefined" && notifPermission === "default" && !notifDismissed && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs border"
          style={{ background: "rgba(148,163,184,0.08)", borderColor: "rgba(148,163,184,0.14)", color: "#94a3b8" }}
        >
          <Bell className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">Kesim bildirimlerini almak ister misiniz?</span>
          <button className="font-semibold hover:opacity-80 transition-opacity" style={{ color: "#00c986" }} onClick={onRequestPermission}>Aç</button>
          <button className="ml-1 hover:opacity-80" onClick={() => setNotifDismissed(true)} aria-label="Kapat">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
