import { useRef, useCallback } from "react";
import type { Donation, AnimalGroup } from "./types";
import type { GroupingProgress } from "./grouping";
import type { WorkerResponse } from "./grouping.worker";

let sharedWorker: Worker | null = null;
let workerSupported: boolean | null = null;

function getWorker(): Worker | null {
  if (workerSupported === false) return null;

  if (sharedWorker) return sharedWorker;

  try {
    sharedWorker = new Worker(
      new URL("./grouping.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerSupported = true;
    return sharedWorker;
  } catch {
    workerSupported = false;
    return null;
  }
}

class CancelledError extends Error {
  constructor() {
    super("Grouping cancelled");
    this.name = "CancelledError";
  }
}

export function useGroupingWorker() {
  const activeIdRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const runGrouping = useCallback(
    (
      donations: Donation[],
      onProgress?: (progress: GroupingProgress) => void
    ): Promise<AnimalGroup[]> => {
      const worker = getWorker();

      if (!worker) {
        return fallbackGrouping(donations, onProgress);
      }

      const id = crypto.randomUUID();
      activeIdRef.current = id;

      return new Promise<AnimalGroup[]>((resolve, reject) => {
        function handler(e: MessageEvent<WorkerResponse>) {
          const msg = e.data;
          if (msg.id !== id) return;

          if (msg.type === "progress") {
            onProgress?.({ current: msg.current, total: msg.total });
            return;
          }

          cleanup();

          if (msg.type === "result") {
            if (msg.cancelled) {
              reject(new CancelledError());
            } else {
              resolve(msg.groups);
            }
          } else if (msg.type === "error") {
            reject(new Error(msg.message));
          }
        }

        function cleanup() {
          worker!.removeEventListener("message", handler);
          activeIdRef.current = null;
          cleanupRef.current = null;
        }

        cleanupRef.current = () => {
          cleanup();
          reject(new CancelledError());
        };

        worker.addEventListener("message", handler);
        worker.postMessage({ type: "group", id, donations });
      });
    },
    []
  );

  const cancelGrouping = useCallback(() => {
    const worker = getWorker();
    if (worker && activeIdRef.current) {
      worker.postMessage({ type: "cancel", id: activeIdRef.current });
    }
    if (cleanupRef.current) {
      cleanupRef.current();
    }
  }, []);

  const isRunning = useCallback(() => activeIdRef.current !== null, []);

  const runIncrementalGrouping = useCallback(
    (
      donations: Donation[],
      existingGroups: AnimalGroup[],
      changedDonationIds: string[],
      lockedGroupIndices: number[]
    ): Promise<AnimalGroup[]> => {
      const worker = getWorker();

      if (!worker) {
        return fallbackIncrementalGrouping(donations, existingGroups, changedDonationIds, lockedGroupIndices);
      }

      const id = crypto.randomUUID();
      activeIdRef.current = id;

      return new Promise<AnimalGroup[]>((resolve, reject) => {
        function handler(e: MessageEvent<WorkerResponse>) {
          const msg = e.data;
          if (msg.id !== id) return;

          if (msg.type === "progress") return;

          cleanup();

          if (msg.type === "result") {
            if (msg.cancelled) {
              reject(new CancelledError());
            } else {
              resolve(msg.groups);
            }
          } else if (msg.type === "error") {
            reject(new Error(msg.message));
          }
        }

        function cleanup() {
          worker!.removeEventListener("message", handler);
          activeIdRef.current = null;
          cleanupRef.current = null;
        }

        cleanupRef.current = () => {
          cleanup();
          reject(new CancelledError());
        };

        worker.addEventListener("message", handler);
        worker.postMessage({
          type: "incrementalGroup",
          id,
          donations,
          existingGroups,
          changedDonationIds,
          lockedGroupIndices,
        });
      });
    },
    []
  );

  const runComputeShares = useCallback(
    (donations: Donation[]): Promise<Map<string, number>> => {
      const worker = getWorker();
      if (!worker) {
        return import("./grouping").then(m => m.computeEffectiveShares(donations));
      }
      const id = crypto.randomUUID();
      return new Promise<Map<string, number>>((resolve, reject) => {
        function handler(e: MessageEvent<WorkerResponse>) {
          const msg = e.data;
          if (msg.id !== id) return;
          worker!.removeEventListener("message", handler);
          if (msg.type === "sharesResult") {
            const map = new Map<string, number>();
            for (const [k, v] of Object.entries(msg.shares)) map.set(k, v);
            resolve(map);
          } else if (msg.type === "error") {
            reject(new Error(msg.message));
          }
        }
        worker.addEventListener("message", handler);
        worker.postMessage({ type: "computeShares", id, donations });
      });
    },
    []
  );

  const runCheckConflicts = useCallback(
    (groups: AnimalGroup[]): Promise<import("./grouping").ConflictInfo[]> => {
      const worker = getWorker();
      if (!worker) {
        return import("./grouping").then(m => m.checkGroupConflicts(groups));
      }
      const id = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        function handler(e: MessageEvent<WorkerResponse>) {
          const msg = e.data;
          if (msg.id !== id) return;
          worker!.removeEventListener("message", handler);
          if (msg.type === "conflictsResult") {
            resolve(msg.conflicts);
          } else if (msg.type === "error") {
            reject(new Error(msg.message));
          }
        }
        worker.addEventListener("message", handler);
        worker.postMessage({ type: "checkConflicts", id, groups });
      });
    },
    []
  );

  return { runGrouping, runIncrementalGrouping, cancelGrouping, isRunning, runComputeShares, runCheckConflicts };
}

async function fallbackGrouping(
  donations: Donation[],
  onProgress?: (progress: GroupingProgress) => void
): Promise<AnimalGroup[]> {
  const { autoGroupDonationsAsync } = await import("./grouping");
  return autoGroupDonationsAsync(donations, onProgress);
}

async function fallbackIncrementalGrouping(
  donations: Donation[],
  existingGroups: AnimalGroup[],
  changedDonationIds: string[],
  lockedGroupIndices: number[]
): Promise<AnimalGroup[]> {
  const { performIncrementalGroup } = await import("./grouping");
  return performIncrementalGroup(
    donations,
    existingGroups,
    new Set(changedDonationIds),
    new Set(lockedGroupIndices)
  );
}
