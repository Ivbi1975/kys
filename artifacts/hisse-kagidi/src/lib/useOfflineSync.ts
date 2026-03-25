import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  saveTrackingDataOffline,
  getTrackingDataOffline,
  queueOfflineAction,
  getQueuedActions,
  removeQueuedAction,
  removeAllQueuedActions,
  getQueuedCount,
  applyOfflineToggleToCache,
  applyOfflineNoteToCache,
} from "./offlineStore";
import {
  fetchTrackingData,
  fetchTrackingNotes,
  fetchTrackingDelta,
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
  const lastSyncTimeRef = useRef<string | null>(null);
  const dataRef = useRef<TrackingData | null>(null);
  const notesRef = useRef<TrackingNote[]>([]);
  dataRef.current = data;
  notesRef.current = notes;
  const saveCacheTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadFullData = useCallback(async () => {
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
        lastSyncTimeRef.current = result.serverTime || new Date().toISOString();
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

  const debouncedSaveCache = useCallback((t: string) => {
    if (saveCacheTimerRef.current) clearTimeout(saveCacheTimerRef.current);
    saveCacheTimerRef.current = setTimeout(() => {
      const d = dataRef.current;
      const n = notesRef.current;
      if (d) saveTrackingDataOffline(t, d, n);
    }, 1000);
  }, []);

  const loadDeltaData = useCallback(async () => {
    if (!token || !navigator.onLine || !lastSyncTimeRef.current || !dataRef.current) {
      return loadFullData();
    }
    try {
      const delta = await fetchTrackingDelta(token, lastSyncTimeRef.current);
      lastSyncTimeRef.current = delta.serverTime;

      if (!delta.hasChanges) return;

      const deletedGroupSet = new Set(delta.deletedGroupIds);
      const deletedNoteSet = new Set(delta.deletedNoteIds);

      setData((prev) => {
        if (!prev) return prev;
        const groupMap = new Map(prev.groups.map(g => [g.id, g]));
        for (const updatedGroup of delta.updatedGroups) {
          groupMap.set(updatedGroup.id, updatedGroup);
        }
        for (const id of deletedGroupSet) {
          groupMap.delete(id);
        }
        const mergedGroups = Array.from(groupMap.values());
        return {
          ...prev,
          totalGroups: delta.totalGroups,
          kesildiCount: delta.kesildiCount,
          groups: mergedGroups,
        };
      });

      setNotes((prev) => {
        const noteMap = new Map(prev.map(n => [n.id, n]));
        for (const updatedNote of delta.updatedNotes) {
          noteMap.set(updatedNote.id, updatedNote);
        }
        for (const id of deletedNoteSet) {
          noteMap.delete(id);
        }
        return Array.from(noteMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      setError(null);
      debouncedSaveCache(token);
    } catch {
      await loadFullData();
    }
  }, [token, loadFullData, debouncedSaveCache]);

  const loadData = useCallback(async () => {
    if (lastSyncTimeRef.current && dataRef.current) {
      return loadDeltaData();
    }
    return loadFullData();
  }, [loadFullData, loadDeltaData]);

  const syncQueue = useCallback(async () => {
    if (!token || syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncState((s) => ({ ...s, isSyncing: true, lastSyncError: null }));

    let allSucceeded = true;
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
          allSucceeded = false;
          setSyncState((s) => ({
            ...s,
            lastSyncError: err instanceof Error ? err.message : "Senkronizasyon hatası",
          }));
          break;
        }
      }
      if (allSucceeded) {
        await removeAllQueuedActions(token);
        lastSyncTimeRef.current = null;
        loadFullData();
      }
    } finally {
      syncingRef.current = false;
      setSyncState((s) => ({ ...s, isSyncing: false }));
      await updatePendingCount();
    }
  }, [token, updatePendingCount, loadFullData]);

  useEffect(() => {
    loadFullData();
    const interval = setInterval(() => {
      if (lastSyncTimeRef.current && dataRef.current) {
        loadDeltaData();
      } else {
        loadFullData();
      }
    }, 30000);
    return () => {
      clearInterval(interval);
      if (saveCacheTimerRef.current) clearTimeout(saveCacheTimerRef.current);
    };
  }, [loadFullData, loadDeltaData]);

  useEffect(() => {
    if (syncState.isOnline && syncState.pendingCount > 0) {
      syncQueue();
    }
  }, [syncState.isOnline, syncState.pendingCount, syncQueue]);

  const handleToggle = useCallback(
    async (groupId: string, kesildi: boolean) => {
      if (!token) return;

      setData((prev) => {
        if (!prev) return prev;
        const prevGroup = prev.groups.find((g) => g.id === groupId);
        const wasKesildi = prevGroup?.kesildi ?? false;
        const delta = wasKesildi === kesildi ? 0 : kesildi ? 1 : -1;
        return {
          ...prev,
          kesildiCount: Math.max(0, prev.kesildiCount + delta),
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
    loadData: loadFullData,
    handleToggle,
    handleCreateNote,
    syncQueue,
  };
}
