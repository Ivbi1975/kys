import { WifiOff, RefreshCw, Bell } from "lucide-react";

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncError?: string | null;
}

interface StatusAlertsProps {
  syncState: SyncState;
  syncQueue: () => void;
  notifPermission: NotificationPermission;
  onRequestPermission: () => void;
}

export function StatusAlerts({
  syncState,
  syncQueue,
  notifPermission,
  onRequestPermission,
}: StatusAlertsProps) {
  return (
    <div className="space-y-2 mb-3">
      {!syncState.isOnline && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs">
          <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-amber-700">Çevrimdışı</span>
            <span className="text-amber-600"> — değişiklikler bağlantı gelince gönderilecek</span>
            {syncState.pendingCount > 0 && (
              <span className="text-amber-500 ml-1">({syncState.pendingCount} bekliyor)</span>
            )}
          </div>
        </div>
      )}

      {syncState.isOnline && syncState.pendingCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs">
          <RefreshCw
            className={`w-3.5 h-3.5 text-blue-500 shrink-0 ${syncState.isSyncing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span className="flex-1 text-blue-700">
            {syncState.isSyncing
              ? "Senkronize ediliyor..."
              : `${syncState.pendingCount} bekleyen değişiklik`}
          </span>
          {!syncState.isSyncing && (
            <button
              className="text-blue-600 font-semibold hover:text-blue-800 transition-colors ml-2 min-h-[32px] px-2"
              onClick={() => syncQueue()}
            >
              Gönder
            </button>
          )}
          {syncState.lastSyncError && (
            <span className="text-red-500 ml-1 truncate">{syncState.lastSyncError}</span>
          )}
        </div>
      )}

      {typeof Notification !== "undefined" && notifPermission === "default" && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-stone-50 border border-stone-100 rounded-xl text-xs">
          <Bell className="w-3.5 h-3.5 text-stone-400 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-stone-500">Kesim bildirimlerini almak ister misiniz?</span>
          <button
            className="text-teal-600 font-semibold hover:text-teal-700 transition-colors ml-2 min-h-[32px] px-2"
            onClick={onRequestPermission}
          >
            Aç
          </button>
        </div>
      )}
    </div>
  );
}
