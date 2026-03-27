import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw } from "lucide-react";

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
    <>
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
              onClick={onRequestPermission}
            >
              Bildirimleri Aç
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
