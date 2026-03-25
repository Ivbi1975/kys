import { useState, useEffect, useCallback, useRef } from "react";
import {
  saveTrackingDataOffline,
  getTrackingDataOffline,
  queueOfflineAction,
  getQueuedActions,
  removeQueuedAction,
  getQueuedCount,
  applyOfflineToggleToCache,
  applyOfflineNoteToCache,
} from "./offlineStore";
import {
  fetchTrackingData,
  fetchTrackingNotes,
  toggleKesildi,
  createTrackingNote,
} from "./api";
import type { TrackingData, TrackingNote } from "./api";

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncError: string | null;
}

export function useOfflineSync(token: string | undefined) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [notes, setNotes] = useState<TrackingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<OfflineSyncState>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncError: null,
  });
  const syncingRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => setSyncState((s) => ({ ...s, isOnline: true }));
    const handleOffline = () => setSyncState((s) => ({ ...s, isOnline: false }));
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const updatePendingCount = useCallback(async () => {
    if (!token) return;
    const count = await getQueuedCount(token);
    setSyncState((s) => ({ ...s, pendingCount: count }));
  }, [token]);

  const syncQueue = useCallback(async () => {
    if (!token || syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncState((s) => ({ ...s, isSyncing: true, lastSyncError: null }));

    try {
      const actions = await getQueuedActions(token);
      for (const action of actions) {
        try {
          if (action.type === "toggle_kesildi") {
            await toggleKesildi(
              token,
              action.payload.groupId as string,
              action.payload.kesildi as boolean
            );
          } else if (action.type === "create_note") {
            await createTrackingNote(token, action.payload as Parameters<typeof createTrackingNote>[1]);
          }
          await removeQueuedAction(action.id);
        } catch (err) {
          setSyncState((s) => ({
            ...s,
            lastSyncError: err instanceof Error ? err.message : "Senkronizasyon hatası",
          }));
          break;
        }
      }
    } finally {
      syncingRef.current = false;
      setSyncState((s) => ({ ...s, isSyncing: false }));
      await updatePendingCount();
    }
  }, [token, updatePendingCount]);

  useEffect(() => {
    if (syncState.isOnline && syncState.pendingCount > 0) {
      syncQueue();
    }
  }, [syncState.isOnline, syncState.pendingCount, syncQueue]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      if (navigator.onLine) {
        const [result, trackingNotes] = await Promise.all([
          fetchTrackingData(token),
          fetchTrackingNotes(token),
        ]);
        setData(result);
        setNotes(trackingNotes);
        setError(null);
        await saveTrackingDataOffline(token, result, trackingNotes);
      } else {
        const cached = await getTrackingDataOffline(token);
        if (cached) {
          setData(cached.data);
          setNotes(cached.notes);
          setError(null);
        } else {
          setError("Çevrimdışısınız ve önbellekte veri bulunamadı");
        }
      }
    } catch (err) {
      const cached = await getTrackingDataOffline(token);
      if (cached) {
        setData(cached.data);
        setNotes(cached.notes);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Veri yüklenemedi");
      }
    } finally {
      setLoading(false);
    }
    await updatePendingCount();
  }, [token, updatePendingCount]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleToggle = useCallback(
    async (groupId: string, kesildi: boolean) => {
      if (!token) return;

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          kesildiCount: prev.kesildiCount + (kesildi ? 1 : -1),
          groups: prev.groups.map((g) =>
            g.id === groupId
              ? { ...g, kesildi, kesildiAt: kesildi ? new Date().toISOString() : null }
              : g
          ),
        };
      });

      if (navigator.onLine) {
        try {
          await toggleKesildi(token, groupId, kesildi);
          await applyOfflineToggleToCache(token, groupId, kesildi);
        } catch {
          await queueOfflineAction(token, "toggle_kesildi", { groupId, kesildi });
          await applyOfflineToggleToCache(token, groupId, kesildi);
          await updatePendingCount();
        }
      } else {
        await queueOfflineAction(token, "toggle_kesildi", { groupId, kesildi });
        await applyOfflineToggleToCache(token, groupId, kesildi);
        await updatePendingCount();
      }
    },
    [token, updatePendingCount]
  );

  const handleCreateNote = useCallback(
    async (noteData: Parameters<typeof createTrackingNote>[1]): Promise<TrackingNote | null> => {
      if (!token) return null;

      if (navigator.onLine) {
        try {
          const note = await createTrackingNote(token, noteData);
          await applyOfflineNoteToCache(token, note);
          return note;
        } catch {
          const offlineNote: TrackingNote = {
            id: crypto.randomUUID(),
            kesimAlaniId: "",
            animalGroupId: noteData.animalGroupId || null,
            type: noteData.type,
            content: noteData.content || "",
            fieldName: noteData.fieldName || null,
            oldValue: noteData.oldValue || null,
            newValue: noteData.newValue || null,
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          await queueOfflineAction(token, "create_note", noteData as Record<string, unknown>);
          await applyOfflineNoteToCache(token, offlineNote);
          await updatePendingCount();
          return offlineNote;
        }
      } else {
        const offlineNote: TrackingNote = {
          id: crypto.randomUUID(),
          kesimAlaniId: "",
          animalGroupId: noteData.animalGroupId || null,
          type: noteData.type,
          content: noteData.content || "",
          fieldName: noteData.fieldName || null,
          oldValue: noteData.oldValue || null,
          newValue: noteData.newValue || null,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        await queueOfflineAction(token, "create_note", noteData as Record<string, unknown>);
        await applyOfflineNoteToCache(token, offlineNote);
        await updatePendingCount();
        return offlineNote;
      }
    },
    [token, updatePendingCount]
  );

  return {
    data,
    setData,
    notes,
    setNotes,
    loading,
    error,
    syncState,
    loadData,
    handleToggle,
    handleCreateNote,
    syncQueue,
  };
}
