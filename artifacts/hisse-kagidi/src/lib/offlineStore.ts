import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { TrackingData, TrackingNote } from "./api";

interface OfflineAction {
  id: string;
  token: string;
  type: "toggle_kesildi" | "create_note";
  payload: Record<string, unknown>;
  createdAt: string;
}

interface KesimTakipDB extends DBSchema {
  trackingData: {
    key: string;
    value: {
      token: string;
      data: TrackingData;
      notes: TrackingNote[];
      updatedAt: string;
    };
  };
  offlineQueue: {
    key: string;
    value: OfflineAction;
    indexes: { "by-token": string };
  };
}

let dbPromise: Promise<IDBPDatabase<KesimTakipDB>> | null = null;

function getDB(): Promise<IDBPDatabase<KesimTakipDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KesimTakipDB>("kesim-takip-offline", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("trackingData")) {
          db.createObjectStore("trackingData", { keyPath: "token" });
        }
        if (!db.objectStoreNames.contains("offlineQueue")) {
          const store = db.createObjectStore("offlineQueue", { keyPath: "id" });
          store.createIndex("by-token", "token");
        }
      },
    });
  }
  return dbPromise;
}

export async function saveTrackingDataOffline(
  token: string,
  data: TrackingData,
  notes: TrackingNote[]
): Promise<void> {
  const db = await getDB();
  await db.put("trackingData", {
    token,
    data,
    notes,
    updatedAt: new Date().toISOString(),
  });
}

export async function getTrackingDataOffline(
  token: string
): Promise<{ data: TrackingData; notes: TrackingNote[] } | null> {
  const db = await getDB();
  const record = await db.get("trackingData", token);
  if (!record) return null;
  return { data: record.data, notes: record.notes };
}

export async function queueOfflineAction(
  token: string,
  type: OfflineAction["type"],
  payload: Record<string, unknown>
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put("offlineQueue", {
    id,
    token,
    type,
    payload,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function getQueuedActions(token: string): Promise<OfflineAction[]> {
  const db = await getDB();
  const actions = await db.getAllFromIndex("offlineQueue", "by-token", token);
  actions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const deduped: OfflineAction[] = [];
  const lastToggleByGroup = new Map<string, number>();

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (action.type === "toggle_kesildi") {
      const groupId = action.payload.groupId as string;
      const existing = lastToggleByGroup.get(groupId);
      if (existing !== undefined) {
        deduped[existing] = action;
      } else {
        lastToggleByGroup.set(groupId, deduped.length);
        deduped.push(action);
      }
    } else {
      deduped.push(action);
    }
  }

  return deduped;
}

export async function removeQueuedAction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("offlineQueue", id);
}

export async function removeAllQueuedActions(token: string): Promise<void> {
  const db = await getDB();
  const actions = await db.getAllFromIndex("offlineQueue", "by-token", token);
  const tx = db.transaction("offlineQueue", "readwrite");
  for (const action of actions) {
    tx.store.delete(action.id);
  }
  await tx.done;
}

export async function getQueuedCount(token: string): Promise<number> {
  const db = await getDB();
  const actions = await db.getAllFromIndex("offlineQueue", "by-token", token);
  return actions.length;
}

export async function applyOfflineToggleToCache(
  token: string,
  groupId: string,
  kesildi: boolean
): Promise<void> {
  const db = await getDB();
  const record = await db.get("trackingData", token);
  if (!record) return;

  const prevGroup = record.data.groups.find((g) => g.id === groupId);
  const wasKesildi = prevGroup?.kesildi ?? false;
  const delta = wasKesildi === kesildi ? 0 : kesildi ? 1 : -1;

  record.data = {
    ...record.data,
    kesildiCount: Math.max(0, record.data.kesildiCount + delta),
    groups: record.data.groups.map((g) =>
      g.id === groupId
        ? { ...g, kesildi, kesildiAt: kesildi ? new Date().toISOString() : null }
        : g
    ),
  };
  record.updatedAt = new Date().toISOString();
  await db.put("trackingData", record);
}

export async function applyOfflineNoteToCache(
  token: string,
  note: TrackingNote
): Promise<void> {
  const db = await getDB();
  const record = await db.get("trackingData", token);
  if (!record) return;

  record.notes = [note, ...record.notes];
  record.updatedAt = new Date().toISOString();
  await db.put("trackingData", record);
}
